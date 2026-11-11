// Minimal service worker. Its only job is to make the app installable (Android Chrome
// requires a registered service worker with a fetch handler). It does not cache anything,
// so it never serves stale pages or interferes with the live app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // No-op: fall through to the network. Present only so the app meets install criteria.
});
