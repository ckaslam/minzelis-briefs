// Cloudflare Pages Function — POST /api/run-sweep
// Fires the "Daily Stage 0 Intent-Engine Sweep" Claude Code Routine on demand
// (the dashboard's "Run Sweep Now" button). Keeps the routine's bearer token
// server-side: it's read from the SWEEP_TRIGGER_TOKEN secret, never shipped
// to the browser or committed to the repo.

const ROUTINE_FIRE_URL = "https://api.anthropic.com/v1/claude_code/routines/trig_01A2HDJkbPA2ehzmXSkB3k9b/fire";

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin") || "";
  if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) {
    return json({ error: "forbidden" }, 403);
  }

  const token = env.SWEEP_TRIGGER_TOKEN;
  if (!token) {
    return json({ error: "SWEEP_TRIGGER_TOKEN not configured" }, 500);
  }

  let requestedBy = "";
  try {
    const body = await request.json();
    requestedBy = typeof body?.requestedBy === "string" ? body.requestedBy.slice(0, 200) : "";
  } catch {
    // no body — fine, requestedBy stays blank
  }

  const upstream = await fetch(ROUTINE_FIRE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "anthropic-beta": "experimental-cc-routine-2026-04-01",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: requestedBy
        ? `Manual "Run Sweep Now" triggered from the dashboard by ${requestedBy}.`
        : `Manual "Run Sweep Now" triggered from the dashboard.`,
    }),
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return json({ error: data?.error?.message || `upstream ${upstream.status}` }, upstream.status);
  }

  return json({
    session_id: data.claude_code_session_id,
    session_url: data.claude_code_session_url,
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
