/// <reference types="@fastly/js-compute" />
import { env } from "fastly:env";
import { KVStore } from "fastly:kv-store";
import { includeBytes } from "fastly:experimental";

const editorPage = includeBytes("./src/editor.html");

const CFG_SHORT_ID_LEN = 8;
const CFG_PASSCODE = "BiRbc6Q4xkTHYGiM6ABhVon8mNmfiL";

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event: FetchEvent) {
  console.log(
    "FASTLY_SERVICE_VERSION:",
    env("FASTLY_SERVICE_VERSION") || "local"
  );

  let req = event.request;

  if (
    !["GET", "POST"].includes(req.method) ||
    !["JP"].includes(event.client.geo?.country_code || "") ||
    !Device.lookup(event.request.headers.get("user-agent") || "")?.isDesktop
  ) {
    return new Response("This method is not allowed", {
      status: 405,
    });
  }

  if (req.method == "POST") {
    let cookieVal = req.headers.get("Cookie") || "";
    if (cookieVal == "") {
      return new Response("No cookie found", {
        status: 500,
      });
    }
    let passcode = "";
    cookieVal.split(";").forEach((e) => {
      if (e.split("=")[0].trim() == "passcode") {
        passcode = e.split("=")[1].trim();
        return;
      }
    });
    if (passcode == "") {
      return new Response("No passcode found in cookie", {
        status: 500,
      });
    }
    if (
      passcode.split("=").length > 1 &&
      passcode.split("=")[1].trim() != CFG_PASSCODE
    ) {
      return new Response("Passcode not matching", {
        status: 500,
      });
    }
    let payload = JSON.parse((await req.text()) || "{}");
    let shortId = payload.short || null;
    if (!shortId) {
      shortId = crypto
        .randomUUID()
        .replaceAll("-", "")
        .slice(-1 * CFG_SHORT_ID_LEN);
    }
    const store = new KVStore("url-shortner-js");
    await store.put(shortId, payload.url);
    return new Response(`{"short":"${shortId}"}`, {
      status: 201,
      headers: new Headers({ "Access-Control-Allow-Origin": "*" }),
    });
  } else {
    let url = new URL(req.url);
    if (url.pathname == "/") {
      return new Response(editorPage, {
        status: 200,
        headers: new Headers({
          "Set-Cookie": `passcode=${CFG_PASSCODE}; Secure; HttpOnly; SameSite=Strict`,
        }),
      });
    } else {
      let path = url.pathname.slice(1);
      if (path.match(/^[0-9a-zA-Z]*/g)?.shift() != path) {
        return new Response("mal-formatted short id", {
          status: 500,
        });
      }
      const store = new KVStore("url-shortner-js");
      const location = (await (await store.get(path))?.text()) || "";
      if (location == "") {
        return new Response("redirect location not found", {
          status: 404,
        });
      }
      return new Response("", {
        status: 301,
        headers: new Headers({
          Location: location,
          "Access-Control-Allow-Origin": "*",
        }),
      });
    }
  }
}
