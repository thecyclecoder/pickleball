import { TournamentForm } from "../tournament-form";

export default function NewTournamentPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-white">New tournament</h1>
      <TournamentForm mode="create" />
    </div>
  );
}
