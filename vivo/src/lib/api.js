// src/lib/api.js
// All Claude API calls go through our own Vercel serverless functions.
// The Anthropic API key is NEVER exposed to the browser.

// Stable session ID — generated once per browser session, sent with every
// request so the server can rate-limit per-session rather than per-IP.
function getSessionId() {
  const key = "vivo_session_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

export async function sendChatMessage(messages) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Id": getSessionId(),
    },
    body: JSON.stringify({ messages }),
  });
  if (res.status === 429) {
    throw new Error("rate_limited");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  const data = await res.json();
  return data.text || "";
}

export async function fetchAnalysis(profile, topRemedies) {
  // Send only the shape the server expects — no raw DB objects
  const slim = topRemedies.map(t => ({
    name:  t.remedy.name,
    abbr:  t.remedy.abbr,
    score: t.score,
  }));
  const res = await fetch("/api/analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, topRemedies: slim }),
  });
  if (res.status === 429) {
    throw new Error("rate_limited");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  const data = await res.json();
  return data.text || "";
}
