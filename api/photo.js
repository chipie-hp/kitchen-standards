// Vercel function: stores and serves photo evidence in a PRIVATE Supabase Storage bucket (bsg-evidence).
const BUCKET = "bsg-evidence";
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, BSG_ORG } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY || !BSG_ORG) return res.status(500).json({ error: "Server is not configured (missing environment variables)" });
  const base = SUPABASE_URL.replace(/\/+$/, "");
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const name = String(b.name || "");
  if (!b.secret || !/^[\w\-\/.]+$/.test(name) || name.includes("..") || name.startsWith("/")) return res.status(400).json({ error: "Bad request" });
  try {
    // check the sync code first (cheap function in the database)
    const ck = await fetch(base + "/rest/v1/rpc/bsg_check", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
      body: JSON.stringify({ p_org: BSG_ORG, p_secret: b.secret }),
    });
    if (!ck.ok) return res.status(401).json({ error: "Wrong sync code" });
    const svc = { apikey: SUPABASE_SERVICE_KEY, Authorization: "Bearer " + SUPABASE_SERVICE_KEY };
    if (b.op === "upload") {
      if (!b.b64 || b.b64.length > 1500000) return res.status(413).json({ error: "Photo too large" });
      const up = await fetch(base + "/storage/v1/object/" + BUCKET + "/" + name, {
        method: "POST",
        headers: { ...svc, "Content-Type": "image/jpeg", "x-upsert": "true" },
        body: Buffer.from(b.b64, "base64"),
      });
      if (!up.ok) return res.status(502).json({ error: "Upload failed: " + (await up.text()) });
      return res.status(200).json({ ok: true });
    }
    if (b.op === "sign") {
      const sg = await fetch(base + "/storage/v1/object/sign/" + BUCKET + "/" + name, {
        method: "POST",
        headers: { ...svc, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: 3600 }),
      });
      if (!sg.ok) return res.status(404).json({ error: "Photo not found" });
      const j = await sg.json();
      return res.status(200).json({ url: base + "/storage/v1" + j.signedURL });
    }
    return res.status(400).json({ error: "Bad request" });
  } catch (e) {
    return res.status(502).json({ error: "Could not reach Supabase" });
  }
};
