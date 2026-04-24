import { redirect } from "next/navigation";

/** Placeholder route kept around for future PWA routing logic. For now
 *  it just forwards to the marketing home — no auth-based routing. */
export default function LaunchPage() {
  redirect("/");
}
