import postgres from "postgres";

let database;

// Runs against the database, rather than just pinging the static app or Auth.
// No script content or user records are read or stored by this check.
export default async function remoteHealth(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false });
  }
  const connectionString = process.env.RELAY_POSTGRES_URL || process.env.POSTGRES_URL;
  if (!connectionString) return response.status(503).json({ ok: false });
  try {
    database ||= postgres(connectionString, {
      max: 1, idle_timeout: 20, connect_timeout: 8,
      connection: { statement_timeout: 5000 }, prepare: false
    });
    // A handful of small user queries each day generates measurable DB activity.
    for (let i = 0; i < 3; i += 1) await database`select 1 as healthy`;
    response.setHeader("Cache-Control", "public, s-maxage=60");
    return response.status(200).json({ ok: true });
  } catch {
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).json({ ok: false });
  }
}
