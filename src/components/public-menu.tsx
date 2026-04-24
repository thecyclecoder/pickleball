"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/i18n";
import {
  getPushSubscriptionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus,
} from "@/lib/push";

export function PublicMenu({
  locale,
  signedIn,
  canAdmin,
}: {
  locale: Locale;
  signedIn: boolean;
  canAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("loading");
  const [pushBusy, setPushBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setStandalone(isStandalone);
    if (isStandalone) {
      getPushSubscriptionStatus().then(setPushStatus);
    }
  }, []);

  async function togglePush() {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (pushStatus === "subscribed") {
        const res = await unsubscribeFromPush();
        if (res.success) setPushStatus("not_subscribed");
      } else {
        const res = await subscribeToPush();
        if (res.success) setPushStatus("subscribed");
        else if (res.reason === "denied") setPushStatus("denied");
      }
    } finally {
      setPushBusy(false);
    }
  }

  const T =
    locale === "es"
      ? {
          open: "Abrir menú",
          tournaments: "Torneos",
          me: "Mi perfil",
          signIn: "Entrar",
          admin: "Admin",
          signOut: "Cerrar sesión",
          pushEnable: "Activar notificaciones",
          pushEnabled: "Notificaciones activadas",
          pushBlocked: "Notificaciones bloqueadas",
        }
      : {
          open: "Open menu",
          tournaments: "Tournaments",
          me: "My profile",
          signIn: "Sign in",
          admin: "Admin",
          signOut: "Sign out",
          pushEnable: "Allow notifications",
          pushEnabled: "Notifications on",
          pushBlocked: "Notifications blocked",
        };

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={T.open}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-white"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl"
        >
          <ul className="py-1 text-sm">
            <Item href="/tournaments" onNavigate={() => setOpen(false)}>
              {T.tournaments}
            </Item>
            {signedIn ? (
              <Item href="/me" onNavigate={() => setOpen(false)}>
                {T.me}
              </Item>
            ) : (
              <Item href="/login" onNavigate={() => setOpen(false)}>
                {T.signIn}
              </Item>
            )}
            {canAdmin && (
              <>
                <Divider />
                <Item href="/admin" onNavigate={() => setOpen(false)} highlight>
                  {T.admin}
                </Item>
              </>
            )}
            {standalone && signedIn && pushStatus !== "not_supported" && pushStatus !== "loading" && (
              <>
                <Divider />
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={togglePush}
                    disabled={pushBusy || pushStatus === "denied"}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden>{pushStatus === "subscribed" ? "🔔" : "🔕"}</span>
                      {pushStatus === "denied"
                        ? T.pushBlocked
                        : pushStatus === "subscribed"
                          ? T.pushEnabled
                          : T.pushEnable}
                    </span>
                    {pushStatus !== "denied" && (
                      <span
                        className={`relative h-4 w-7 flex-shrink-0 rounded-full transition-colors ${
                          pushStatus === "subscribed" ? "bg-emerald-600" : "bg-zinc-700"
                        }`}
                        aria-hidden
                      >
                        <span
                          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                            pushStatus === "subscribed" ? "left-3.5" : "left-0.5"
                          }`}
                        />
                      </span>
                    )}
                  </button>
                </li>
              </>
            )}
            {signedIn && (
              <>
                <Divider />
                <li>
                  <button
                    type="button"
                    onClick={signOut}
                    className="block w-full px-4 py-2.5 text-left text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    role="menuitem"
                  >
                    {T.signOut}
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Item({
  href,
  children,
  onNavigate,
  highlight,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate: () => void;
  highlight?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        role="menuitem"
        className={`block px-4 py-2.5 ${
          highlight
            ? "font-medium text-emerald-400 hover:bg-zinc-800 hover:text-emerald-300"
            : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
        }`}
      >
        {children}
      </Link>
    </li>
  );
}

function Divider() {
  return <li aria-hidden className="my-1 h-px bg-zinc-800" />;
}
