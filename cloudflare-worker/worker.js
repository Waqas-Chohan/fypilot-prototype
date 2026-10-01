/**
 * FYPilot — Cloudflare Worker: Turnstile siteverify proxy (free)
 * ------------------------------------------------------------------
 * Deployment (free — Workers free tier = 100,000 requests/day):
 *
 *   1. npm i -g wrangler
 *   2. cd cloudflare-worker
 *   3. wrangler login
 *   4. wrangler deploy            (deploys worker.js to your account)
 *   5. wrangler secret put TURNSTILE_SECRET_KEY   <-- paste your Turnstile SECRET key
 *
 * That gives you a URL like:  https://fypilot-turnstile-verify.<subdomain>.workers.dev
 * Paste it into `TURNSTILE.verifyUrl` in assets/js/login.js.
 *
 * Security notes (Cloudflare best practice):
 *  - The SECRET key never leaves the Worker — it is read from env at runtime,
 *    so it can never be extracted from the browser.
 *  - Only your login page origin may call this Worker (origin allow-list below).
 *  - The siteverify token is single-use and expires after 300 seconds.
 */

export default {
  async fetch(request, env) {
    // 1) Accept only POST with JSON
    if (request.method !== "POST") {
      return json({ success: false, error: "method-not-allowed" }, 405);
    }

    // 2) Allow only the real deployment origin(s) of the prototype.
    const ALLOWED_ORIGINS = [
      "https://fypilot-prototype.vercel.app",
      "http://localhost:8080",
      "http://127.0.0.1:8080"
    ];
    const origin = request.headers.get("Origin") || "";
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return json({ success: false, error: "origin-not-allowed" }, 403);
    }

    // 3) Parse the token sent by login.js
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return json({ success: false, error: "invalid-json" }, 400);
    }
    const token = body.token || body.response;
    if (!token || typeof token !== "string" || token.length > 2048) {
      return json({ success: false, error: "missing-token" }, 400);
    }

    // 4) Call Cloudflare's mandatory server-side validation endpoint
    const form = new FormData();
    form.append("secret", env.TURNSTILE_SECRET_KEY);
    form.append("response", token);
    const remoteIp = request.headers.get("CF-Connecting-IP");
    if (remoteIp) form.append("remoteip", remoteIp);

    let data;
    try {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: form
      });
      data = await r.json();
    } catch (err) {
      return json({ success: false, error: "siteverify-unreachable" }, 502);
    }

    // 5) Optional hardening: only accept tokens issued for our login hostname
    if (data.success && body.hostname && data.hostname !== body.hostname) {
      return json({ success: false, error: "hostname-mismatch" }, 400);
    }

    return json({
      success: data.success === true,
      "error-codes": data["error-codes"] || []
    });
  }
};

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}