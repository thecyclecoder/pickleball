export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-2xl font-bold text-white">Tournament {id}</h1>
        <p className="text-sm text-zinc-400">Tournament details and signup form coming soon.</p>
      </div>
    </div>
  );
}
