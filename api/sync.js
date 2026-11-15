// Vercel function: login check, pull and push of the app data in Supabase. No secret is typed by staff.
const L = require("./_lib");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!L.configured()) return res.status(500).json({ error: "Server is not configured (add the Vercel environment variables)" });
  let b;
  try { b = L.body(req); } catch (e) { return res.status(400).json({ error: "Bad request" }); }
  try {
    const row = await L.load();
    const data = row && row.data && Array.isArray(row.data.users) ? row.data : null;
    if (b.op === "users") {
      return res.status(200).json({ users: data ? data.users.map((u) => ({ id: u.id, name: u.name, role: u.role, site: u.site, cats: u.cats || [] })) : [] });
    }
    if (b.op === "login") {
      if (!data) return res.status(200).json({ ok: true, empty: true }); // first ever use: the app uploads its data after login
      if (!L.userOk(data, b.uid, b.pin)) { await L.sleep(600); return res.status(401).json({ error: "Wrong PIN" }); }
      return res.status(200).json({ ok: true, version: row.version, data });
    }
    if (b.op === "pull") {
      if (!data) return res.status(200).json({ version: row ? row.version : 0, data: null });
      if (!L.userOk(data, b.uid, b.pin)) { await L.sleep(600); return res.status(401).json({ error: "Wrong PIN" }); }
      return res.status(200).json({ version: row.version, data });
    }
    if (b.op === "push") {
      const nd = b.data;
      if (!nd || !Array.isArray(nd.users)) return res.status(400).json({ error: "Bad data" });
      if (data) { if (!L.userOk(data, b.uid, b.pin)) { await L.sleep(600); return res.status(401).json({ error: "Wrong PIN" }); } }
      else if (!L.userOk(nd, b.uid, b.pin)) return res.status(401).json({ error: "Wrong PIN" }); // first save: the user must be in the data
      const cur = row ? row.version : 0;
      if (Number(b.version) !== cur) return res.status(200).json({ ok: false, version: cur });
      const v = await L.save(row, nd, cur);
      if (v == null) return res.status(200).json({ ok: false, version: cur + 1 });
      await L.snapshot(nd, v);
      return res.status(200).json({ ok: true, version: v });
    }
    return res.status(400).json({ error: "Bad request" });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
