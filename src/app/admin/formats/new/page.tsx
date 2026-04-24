import Link from "next/link";
import { FormatForm } from "../format-form";

export default function NewFormatPage() {
  return (
    <div>
      <Link href="/admin/formats" className="mb-2 inline-block text-xs text-zinc-400 hover:text-white">
        ← Formats
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-white">New format</h1>
      <FormatForm mode="create" />
    </div>
  );
}
