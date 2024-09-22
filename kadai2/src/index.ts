/// <reference types="@fastly/js-compute" />

import MarkdownIt from "markdown-it";

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event: FetchEvent) {
  let req = event.request;
  let url = new URL(req.url);
  if (req.method == "POST" && url.pathname == "/markdown-to-html") {
    var md = new MarkdownIt();
    return new Response(md.render(await req.text()), {
      status: 200,
      headers: new Headers({ "Content-Type": "text/html; charset=utf-8" }),
    });
  } else {
    return await fetch(req, {
      backend: "backend_1",
    });
  }
}
