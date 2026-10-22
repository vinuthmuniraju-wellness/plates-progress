/* Plate & Progress — AI helper (Cloudflare Worker).
   Keeps your Anthropic API key secret and only answers people signed in to YOUR app with Google.

   Settings (Cloudflare dashboard → Worker → Settings → Variables):
     ANTHROPIC_API_KEY   (secret)  your key from console.anthropic.com
     GOOGLE_CLIENT_ID              the same client ID as in config.js
     ALLOWED_ORIGIN                your site, e.g. https://yourname.github.io
     MODEL                         optional, default claude-sonnet-5-5 (reading PDFs/photos, recipes)
     MODEL_QUICK                   optional, default claude-haiku-5-5 (quick nutrition lookups)
     ALLOWED_EMAILS                optional, comma-separated Gmail addresses allowed to use AI features
*/
export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGIN || "").replace(/\/$/, "");
    const cors = {
      "Access-Control-Allow-Origin": allowed || "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Vary": "Origin"
    };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return reply(405, { error: "POST only" });
    if (!allowed || origin.replace(/\/$/, "") !== allowed) return reply(403, { error: "Origin not allowed" });

    // Only people signed in to this app with Google may use it
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return reply(401, { error: "Sign in with Google" });
    const info = await fetch("https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" + encodeURIComponent(token)).then(r => r.ok ? r.json() : null).catch(() => null);
    if (!info || (info.aud !== env.GOOGLE_CLIENT_ID && info.azp !== env.GOOGLE_CLIENT_ID) || Number(info.expires_in || 0) <= 0) return reply(401, { error: "Google sign-in not valid for this app" });
    if (env.ALLOWED_EMAILS) {
      const list = env.ALLOWED_EMAILS.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      if (!list.includes(String(info.email || "").toLowerCase())) return reply(403, { error: "This account can't use AI features" });
    }

    let body;
    try { body = await req.json(); } catch { return reply(400, { error: "Bad request" }); }
    const images = Array.isArray(body.images) ? body.images.slice(0, 4) : [];
    const imgBlocks = images
      .filter(i => i && /^image\/(jpeg|png|webp|gif)$/.test(i.type) && typeof i.data === "string" && i.data.length < 7_000_000)
      .map(i => ({ type: "image", source: { type: "base64", media_type: i.type, data: i.data } }));

    // input is a prompt string or a list of {role, content} turns ending on a user turn
    let messages;
    if (typeof body.input === "string") {
      messages = [{ role: "user", content: [...imgBlocks, { type: "text", text: body.input.slice(0, 200000) }] }];
    } else if (Array.isArray(body.input) && body.input.length) {
      messages = body.input.slice(-20).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 50000) }));
      const last = messages[messages.length - 1];
      if (imgBlocks.length) last.content = [...imgBlocks, { type: "text", text: last.content }];
    } else return reply(400, { error: "Missing input" });

    const model = body.modelTier === "quick" ? (env.MODEL_QUICK || "claude-haiku-5-5") : (env.MODEL || "claude-sonnet-5-5");
    const system = body.json
      ? "You are the assistant inside a food and fitness tracking app. The reply will be parsed by a program: reply with only the JSON value asked for, no other text."
      : "You are the assistant inside a food and fitness tracking app.";
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 3000, system, messages })
    });
    if (r.status === 429) return reply(429, { error: "Busy" });
    if (!r.ok) return reply(502, { error: "AI service error " + r.status });
    const j = await r.json();
    const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
    return reply(200, { text, truncated: j.stop_reason === "max_tokens" });
  }
};
