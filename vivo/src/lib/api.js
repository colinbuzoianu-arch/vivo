// src/lib/api.js
// All Claude API calls go through our own Vercel serverless functions.
// The Anthropic API key is NEVER exposed to the browser.

export async function sendChatMessage(messages) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
