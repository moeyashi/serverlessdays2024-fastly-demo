/// <reference types="@fastly/js-compute" />

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event: FetchEvent) {
  let req = event.request;
  return await fetch(req, {
    backend: "backend_1",
  });
}
