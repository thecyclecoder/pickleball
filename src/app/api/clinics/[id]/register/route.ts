import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { CLINIC_RATING_OPTIONS, type ClinicRating } from "@/lib/types";
import { generateMagicLink, sendClinicRegistrationEmail } from "@/lib/email";
import { sendPushToUsers } from "@/lib/push-server";
import { formatTournamentDate, formatTime } from "@/lib/format";

type Body = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  rating_self?: string;
  age?: number | string;
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const admin = createAdminClient();
  const body = (await req.json().catch(() => ({}))) as Body;

  const first = (body.first_name ?? "").trim();
  const last = (body.last_name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const phone = (body.phone ?? "").trim() || null;
  const rating = (body.rating_self ?? "").toString().trim();
  const age = Number(body.age);

  if (!first) return NextResponse.json({ error: "First name is required" }, { status: 400 });
  if (!last) return NextResponse.json({ error: "Last name is required" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!(CLINIC_RATING_OPTIONS as readonly string[]).includes(rating)) {
    return NextResponse.json({ error: "Pick a skill level" }, { status: 400 });
  }
  if (!Number.isFinite(age) || age <= 0) {
    return NextResponse.json({ error: "Age is required" }, { status: 400 });
  }

  const cLookup = isUuid
    ? admin.from("clinics").select("*").eq("id", id).limit(1)
    : admin.from("clinics").select("*").eq("slug", id).limit(1);
  const { data: cRows, error: cErr } = await cLookup;
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  const clinic = cRows?.[0];
  if (!clinic || clinic.status !== "published") {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }
  if (!clinic.registration_open) {
    return NextResponse.json({ error: "Registration is closed" }, { status: 400 });
  }

  // Reject duplicate email for this clinic (excluding cancelled rows)
  const { data: dup } = await admin
    .from("clinic_registrations")
    .select("id, status")
    .eq("clinic_id", clinic.id)
    .ilike("email", email)
    .neq("status", "cancelled");
  if (dup && dup.length > 0) {
    return NextResponse.json(
      { error: "This email is already registered for this clinic" },
      { status: 409 }
    );
  }

  // Capacity check → waitlist if at-cap; reject if waitlist also at-cap.
  let assignedStatus: "registered" | "waitlisted" = "registered";
  if (clinic.capacity != null) {
    const { data: liveRegs } = await admin
      .from("clinic_registrations")
      .select("status")
      .eq("clinic_id", clinic.id)
      .neq("status", "cancelled");
    const registeredCount = (liveRegs ?? []).filter((r) => r.status === "registered").length;
    const waitlistCount = (liveRegs ?? []).filter((r) => r.status === "waitlisted").length;
    if (registeredCount >= clinic.capacity) {
      if (
        clinic.waitlist_capacity != null &&
        waitlistCount >= clinic.waitlist_capacity
      ) {
        return NextResponse.json(
          { error: "This clinic is full. Registration is closed." },
          { status: 409 }
        );
      }
      assignedStatus = "waitlisted";
    }
  }

  const currentUser = await getCurrentUser();
  const matchedSelfId =
    currentUser && currentUser.email && currentUser.email.toLowerCase() === email
      ? currentUser.id
      : null;

  const { data: reg, error: regErr } = await admin
    .from("clinic_registrations")
    .insert({
      clinic_id: clinic.id,
      first_name: first,
      last_name: last,
      email,
      phone,
      rating_self: rating as ClinicRating,
      age,
      status: assignedStatus,
      user_id: matchedSelfId,
    })
    .select()
    .single();
  if (regErr || !reg) {
    return NextResponse.json({ error: regErr?.message ?? "Failed to register" }, { status: 500 });
  }

  // Best-effort side effects
  await Promise.all([
    sendClinicRegistrationConfirmation({ clinic, reg, first, last, email }).catch((e) =>
      console.error("Clinic confirmation email failed:", e)
    ),
    notifyAdminsOfClinicSignup({ clinic, reg, first, last, rating, age }).catch((e) =>
      console.error("Clinic signup push failed:", e)
    ),
  ]);

  return NextResponse.json({ registration_id: reg.id, status: assignedStatus });
}

async function sendClinicRegistrationConfirmation(args: {
  clinic: {
    id: string;
    slug: string;
    title: string;
    start_date: string;
    end_date: string | null;
    start_time: string;
    timezone: string;
    location: string;
  };
  reg: { id: string; status: string };
  first: string;
  last: string;
  email: string;
}) {
  const { clinic, reg, first, email } = args;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";
  const dateLabel = formatTournamentDate(clinic.start_date, clinic.end_date, clinic.timezone);
  const timeLabel = formatTime(clinic.start_time, clinic.timezone);

  const link = await generateMagicLink(email).catch((e) => {
    console.error("magic link clinic failed:", e);
    return `${siteUrl}/login`;
  });

  await sendClinicRegistrationEmail({
    toEmail: email,
    toFirstName: first,
    clinicTitle: clinic.title,
    clinicStartDateLabel: dateLabel,
    clinicTimeLabel: timeLabel,
    clinicLocation: clinic.location,
    clinicUrl: `${siteUrl}/clinics/${clinic.slug}`,
    confirmLink: link,
    waitlisted: reg.status === "waitlisted",
  });
}

async function notifyAdminsOfClinicSignup(args: {
  clinic: { id: string; slug: string; title: string; workspace_id: string };
  reg: { id: string; status: string };
  first: string;
  last: string;
  rating: string;
  age: number;
}) {
  const admin = createAdminClient();
  const { data: members } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", args.clinic.workspace_id)
    .in("role", ["owner", "admin"])
    .not("user_id", "is", null);
  const userIds = (members ?? [])
    .map((m) => m.user_id as string | null)
    .filter((v): v is string => !!v);
  if (userIds.length === 0) return;

  const waitlisted = args.reg.status === "waitlisted";
  await sendPushToUsers(userIds, {
    title: waitlisted
      ? `Waitlist: ${args.clinic.title}`
      : `New clinic signup: ${args.clinic.title}`,
    body: `${args.first} ${args.last} — ${args.rating === "beginner" ? "Beginner" : args.rating} · age ${args.age}`,
    tag: `clinic_registration:${args.clinic.id}`,
    url: `/admin/clinics/${args.clinic.id}`,
  });
}
