/// <reference types="@fastly/js-compute" />
import { Device } from "fastly:device";
import { env } from "fastly:env";
import { KVStore } from "fastly:kv-store";
import { includeBytes } from "fastly:experimental";

const editorPage = includeBytes("./src/editor.html");
const listPage = includeBytes("./src/list.html");

const CFG_SHORT_ID_LEN = 8;
const CFG_PASSCODE = "BiRbc6Q4xkTHYGiM6ABhVon8mNmfiL";

const KV_NAME = "url-shortner-js";
const KV_KEY_LIST = "list";

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

const handleRequest = (event: FetchEvent) => {
  console.log(
    "FASTLY_SERVICE_VERSION:",
    env("FASTLY_SERVICE_VERSION") || "local"
  );
  const url = new URL(event.request.url);
  switch (url.pathname) {
    case "/":
      return handleIndex(event);
    case "/list":
      return handleList(event);
    default:
      // 定義していないパスは短縮URLとして扱う
      return handleIndex(event);
  }
};

async function handleIndex(event: FetchEvent) {
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
    const store = new KVStore(KV_NAME);
    // const list = await store.get(KV_KEY_LIST);
    // const oldList = list ? await list.json() : [];
    // const newList = [...(Array.isArray(oldList) ? oldList : []), shortId];
    // await store.put(KV_KEY_LIST, JSON.stringify(newList));
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
      const store = new KVStore(KV_NAME);
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

const handleList = async (event: FetchEvent) => {
  let req = event.request;
  if (req.method != "GET") {
    return new Response("This method is not allowed", {
      status: 405,
    });
  }
  const store = new KVStore(KV_NAME);
  let keys = (await store.get(KV_KEY_LIST))?.json() || [];
  let data = [];
  for (let key of Array.isArray(keys) ? keys : []) {
    data.push({
      short: key,
      url: (await (await store.get(key))?.text()) || "",
    });
  }
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: new Headers({ "Access-Control-Allow-Origin": "*" }),
  });
};
