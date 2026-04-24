import { NextResponse } from "next/server";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const locale = body.locale as string;
  if (!(LOCALES as readonly string[]).includes(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }
  const res = NextResponse.json({ locale: locale as Locale });
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
