import { permanentRedirect } from "next/navigation";

// Shortlink for sharing — e.g. buentiro.app/c/dylan-ralston points at the
// coach's full /coaches/<slug> page. Permanent redirect so the canonical
// URL is what gets indexed for SEO; the short form is just for "link in
// bio" use on social media.
export default async function CoachShortlinkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/coaches/${slug}`);
}
