export {};

declare let self: ServiceWorkerGlobalScope;

const domains = ["api.mapbox.com"];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", () => self.clients.claim());

self.addEventListener("fetch", event => {
  const { request } = event;
  const response = doFetch(request);
  if (response) event.respondWith(response);
});

const doFetch = (request: Request) => {
  const { url } = request;
  if (domains.includes(new URL(url).hostname)) return doCacheFetch(request);
};

const doCacheFetch = async (request: Request) => {
  const cache = await caches.open("cache");

  const cached = await cache.match(request, {
    ignoreVary: true,
  });

  if (cached) return cached;

  const response = await fetch(request);

  await cache.put(request, response.clone());

  return response;
};
