// Vercel function: forwards sync requests to Supabase. Keys stay here (environment variables), never in the app.
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { SUPABASE_URL, SUPABASE_ANON_KEY, BSG_ORG } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !BSG_ORG) return res.status(500).json({ error: "Server is not configured (missing environment variables)" });
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!b.secret || (b.op !== "pull" && b.op !== "push")) return res.status(400).json({ error: "Bad request" });
  const fn = b.op === "pull" ? "bsg_pull" : "bsg_push";
  const body = b.op === "pull"
    ? { p_org: BSG_ORG, p_secret: b.secret }
    : { p_org: BSG_ORG, p_secret: b.secret, p_data: b.data, p_version: b.version };
  try {
    const r = await fetch(SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
      body: JSON.stringify(body),
    });
    const t = await r.text();
    res.status(r.status).setHeader("Content-Type", "application/json").send(t);
  } catch (e) {
    res.status(502).json({ error: "Could not reach Supabase" });
  }
};
