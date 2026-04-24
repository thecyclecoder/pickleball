"use client";

import { useEffect } from "react";

/** Registers /sw.js and auto-reloads the tab as soon as a new SW takes
 *  control, so UI deploys propagate without the user having to do a
 *  hard refresh. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.log("SW registration failed:", err);
    });

    // Fires when a newer SW activates (skipWaiting + clients.claim).
    // First install of the SW also fires this — guard so we don't reload
    // on first load when there wasn't one before.
    let didReload = false;
    const controllerAtMount = navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (!controllerAtMount) return; // first-ever registration on this page
      if (didReload) return;
      didReload = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
