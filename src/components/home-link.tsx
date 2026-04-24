import Link from "next/link";
import { Logo } from "./logo";

/** Clickable logo that routes to the marketing home. */
export function HomeLink({ height = 28 }: { height?: number }) {
  return (
    <Link href="/" aria-label="Buen Tiro" className="text-white">
      <Logo height={height} />
    </Link>
  );
}
