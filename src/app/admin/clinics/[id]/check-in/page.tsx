import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { ClinicCheckInList, type ClinicCheckInRow } from "./check-in-list";
import type { Clinic, ClinicRegistration } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClinicCheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;
  const { id } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("clinics")
    .select("id, title, workspace_id")
    .eq("id", id)
    .eq("workspace_id", res.member.workspace_id)
    .maybeSingle();
  if (!data) notFound();
  const clinic = data as Pick<Clinic, "id" | "title">;

  const { data: regs } = await admin
    .from("clinic_registrations")
    .select("*")
    .eq("clinic_id", id)
    .neq("status", "cancelled")
    .order("registered_at", { ascending: true });
  const rows: ClinicCheckInRow[] = ((regs ?? []) as ClinicRegistration[]).map((r) => ({
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    phone: r.phone,
    paid: !!r.paid_at,
    checked_in_at: r.checked_in_at ?? null,
  }));

  return (
    <div>
      <div className="mb-5">
        <Link
          href={`/admin/clinics/${id}`}
          className="text-xs text-zinc-400 hover:text-white"
        >
          ← {clinic.title}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Check-in</h1>
        <p className="text-xs text-zinc-500">
          Tap a registrant to check them in. WhatsApp confirmation sends if a phone is on
          file.
        </p>
      </div>
      <ClinicCheckInList clinicId={id} initialRows={rows} />
    </div>
  );
}
