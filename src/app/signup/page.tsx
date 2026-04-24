import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const qs = sp.next ? `?next=${encodeURIComponent(sp.next)}` : "";
  redirect(`/login${qs}`);
}
