import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950">
      <h1 className="mb-4 text-4xl font-bold text-white">Pickleball Tournaments</h1>
      <p className="mb-8 text-lg text-zinc-400">Find and register for upcoming tournaments</p>
      <Link
        href="/tournaments"
        className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
      >
        View Tournaments
      </Link>
    </div>
  );
}
