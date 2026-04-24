import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-2xl font-bold text-white">Dashboard</h1>
        <p className="mb-8 text-sm text-zinc-400">Welcome, {user.email}</p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Tournament management coming soon.</p>
        </div>
      </div>
    </div>
  );
}
