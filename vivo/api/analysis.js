// api/analysis.js
// Vercel Serverless Function — generates clinical rationale for matched remedies.
// Called once per consultation after the intake is complete.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

// Same simple rate limiter — shared state does NOT persist between the two
// functions in production (each is its own Lambda). That's fine — they have
// separate limits. For cross-function limits use Upstash Redis.
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "10", 10);
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const { profile, topRemedies } = req.body || {};
  if (!profile || !topRemedies || !Array.isArray(topRemedies)) {
    return res.status(400).json({ error: "profile and topRemedies are required" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const prompt = `You are a classical homeopath. Based on this patient profile:
${JSON.stringify(profile, null, 2)}

The algorithmic remedy analysis has identified these top 3 candidates:
${topRemedies.map((t, i) => `${i + 1}. ${t.name} (${t.abbr}) — Score: ${t.score}`).join("\n")}

Write a concise but warm clinical rationale (3-4 sentences) explaining WHY these three remedies fit this particular patient's totality of symptoms. Focus on the most characteristic features that point to each remedy. Be specific to THIS patient's case, not generic descriptions.`;

  try {
    const upstream = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("Anthropic API error:", upstream.status, errText);
      return res.status(502).json({ error: "AI service error. Please try again." });
    }

    const data = await upstream.json();
    const text = data.content?.map((b) => b.text || "").join("") || "";
    return res.status(200).json({ text });
  } catch (err) {
    console.error("Unexpected error in /api/analysis:", err);
    return res.status(500).json({ error: "Unexpected server error." });
  }
}
