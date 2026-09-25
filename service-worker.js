/* ==========================================================================
   service-worker.js  —  OPTIONAL
   ==========================================================================

   You do not need this file. Delete it and the website still works perfectly
   well. What you lose is:
     - the app opening when there is no internet, and
     - the "add to home screen" install prompt.

   WHAT IT IS
   A small script the browser keeps running in the background. It sits between
   the app and the network, and can answer requests from a saved copy when the
   connection is down.

   ==========================================================================
   WHY THE LIST BELOW IS SAFE
   ==========================================================================
   An earlier version of this file used cache.addAll(), which fails as a
   group: if ONE file in the list was missing, the whole installation was
   rejected and offline support died silently, with no error on screen. That
   is a nasty failure mode, because nothing looks broken.

   This version caches the files ONE AT A TIME, so a missing file is simply
   skipped. The list is also generated from the real project folder, so it
   cannot drift out of step with what actually exists.

   ==========================================================================
   IF YOU DEPLOY CHANGES AND THEY DO NOT APPEAR
   ==========================================================================
   Bump the version below, e.g. helpdesk-plus-v3.1.0 -> v3.1.1. That tells
   every browser to discard its saved copy and download fresh.

   Get into the habit. It prevents the most confusing problem in the whole
   system: you fix something, and returning visitors keep seeing the old
   version and think the fix did not work.
   ========================================================================== */

const CACHE_VERSION = "helpdesk-plus-v3.1.0";

/* Files saved for offline use. Generated from the real project folder. */
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./assets/brand/logo.webp",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-32.png",
];

/* --- Install: save a copy of each file, skipping any that are missing --- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch(() => {
            /* This file is not present. Skip it, rather than letting one
               missing file break offline support altogether. */
            console.warn("[HelpDesk+] not cached (file not found):", url);
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

/* --- Activate: delete caches left over from older versions --- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* --- Fetch: network first, saved copy as the safety net --- */
self.addEventListener("fetch", (event) => {
  const request = event.request;

  /* Only handle simple GET requests. */
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  /* Never cache or interfere with Google Apps Script. That is live data and
     must always go straight to the network. */
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        /* Keep a fresh copy of anything that loaded successfully. */
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          /* For a page navigation, fall back to the saved page so the app
             still opens offline instead of showing a browser error. */
          if (request.mode === "navigate") return caches.match("./index.html");
          return new Response("", { status: 504, statusText: "Offline" });
        })
      )
  );
});
