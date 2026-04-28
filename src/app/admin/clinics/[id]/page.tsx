import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { formatTournamentDate } from "@/lib/format";
import { ClinicForm } from "../clinic-form";
import { ClinicRegistrationsPanel } from "./clinic-registrations-panel";
import { ClinicDangerZone } from "./clinic-danger-zone";
import type { Clinic, ClinicCoach, ClinicRegistration } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminClinicEditPage({
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
    .select(`*, coaches:clinic_coaches (*), registrations:clinic_registrations (*)`)
    .eq("id", id)
    .eq("workspace_id", res.member.workspace_id)
    .limit(1)
    .single();

  if (!data) notFound();
  const clinic = data as Clinic & {
    coaches: ClinicCoach[];
    registrations: ClinicRegistration[];
  };

  const sortedCoaches = [...clinic.coaches].sort((a, b) => a.sort_order - b.sort_order);
  const sortedRegs = [...clinic.registrations].sort((a, b) =>
    a.registered_at.localeCompare(b.registered_at)
  );
  const publicUrl = `/clinics/${clinic.slug}`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/clinics" className="text-xs text-zinc-400 hover:text-white">
            ← All clinics
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">{clinic.title}</h1>
          <p className="text-xs text-zinc-500">
            {formatTournamentDate(clinic.start_date, clinic.end_date, clinic.timezone)} ·{" "}
            {clinic.status}
          </p>
        </div>
        {clinic.status === "published" && (
          <Link
            href={publicUrl}
            target="_blank"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-700 hover:text-white"
          >
            View public page →
          </Link>
        )}
      </div>

      <ClinicRegistrationsPanel
        clinicId={clinic.id}
        capacity={clinic.capacity}
        registrations={sortedRegs}
      />

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">Edit</h2>
        <ClinicForm
          mode="edit"
          initialClinic={{
            id: clinic.id,
            title: clinic.title,
            title_es: clinic.title_es ?? "",
            description: clinic.description ?? "",
            description_es: clinic.description_es ?? "",
            details: clinic.details ?? "",
            details_es: clinic.details_es ?? "",
            start_date: clinic.start_date,
            end_date: clinic.end_date ?? "",
            start_time: clinic.start_time.slice(0, 5),
            timezone: clinic.timezone,
            location: clinic.location,
            location_es: clinic.location_es ?? "",
            address: clinic.address ?? "",
            address_es: clinic.address_es ?? "",
            google_maps_url: clinic.google_maps_url ?? "",
            status: clinic.status,
            registration_open: clinic.registration_open,
            capacity: clinic.capacity,
            waitlist_capacity: clinic.waitlist_capacity,
            images: clinic.images ?? [],
            payment_qr_url: clinic.payment_qr_url ?? "",
            payment_instructions: clinic.payment_instructions ?? "",
            payment_instructions_es: clinic.payment_instructions_es ?? "",
          }}
          initialCoaches={sortedCoaches.map((c) => ({
            id: c.id,
            name: c.name,
            title: c.title ?? "",
            image_url: c.image_url ?? "",
            sort_order: c.sort_order,
          }))}
        />
      </div>

      <div className="mt-10">
        <ClinicDangerZone clinicId={clinic.id} clinicTitle={clinic.title} />
      </div>
    </div>
  );
}
