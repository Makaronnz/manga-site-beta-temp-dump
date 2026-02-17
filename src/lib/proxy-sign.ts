// /src/lib/proxy-sign.ts
// Uses WebCrypto (Edge/Node 20+) to compute HMAC-SHA256 for signed proxy URLs.

const SECRET = process.env.PROXY_HMAC_SECRET!;
const enc = new TextEncoder();

function base64urlFromBytes(buf: ArrayBuffer) {
  let b64 = "";
  if (typeof Buffer !== "undefined") {
    b64 = Buffer.from(buf).toString("base64");
  } else {
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    // @ts-ignore
    b64 = btoa(binary);
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlFromString(s: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  } else {
    // @ts-ignore
    const b64 = btoa(s);
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
}

async function hmac(inputB64Url: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(inputB64Url));
  return base64urlFromBytes(sigBuf);
}

/** Create a signed internal proxy URL for a remote image URL */
export async function signProxyUrl(rawUrl: string) {
  const u = base64urlFromString(rawUrl);
  const sig = await hmac(u);
  return `/api/proxy?u=${u}&sig=${sig}`;
}

/** Verify u+sig pair */
export async function verifyProxyParams(u: string, sig: string) {
  const good = await hmac(u);
  // timing-safe compare isn't available in Web Crypto; strings are fine for this use
  return good === sig;
}
