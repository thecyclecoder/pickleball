import { ClinicForm } from "../clinic-form";

export default function NewClinicPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-white">New clinic</h1>
      <ClinicForm mode="create" />
    </div>
  );
}
