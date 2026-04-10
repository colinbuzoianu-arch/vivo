// api/chat.js
// Vercel Serverless Function — handles intake conversation
// The API key never leaves the server.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (resets when function cold-starts).
// For persistent rate limiting across deployments, swap this for Upstash Redis:
// https://upstash.com — free tier handles ~10k requests/day
// ---------------------------------------------------------------------------
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "10", 10);
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

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

// ---------------------------------------------------------------------------
// System prompt — identical to what was in the frontend before
// ---------------------------------------------------------------------------
const INTAKE_SYSTEM = `You are an experienced classical homeopath conducting an initial patient intake. Your role is to gather a complete homeopathic profile through thoughtful, empathetic conversation.

INTERVIEW STRUCTURE — follow this progression naturally:
1. Chief complaint (what brings them in today)
2. Symptom details: location, sensation, character, intensity (1-10)
3. Modalities: what makes it BETTER or WORSE (temperature, movement, time of day, pressure, weather, position, food/drink, etc.)
4. Onset & history: when did it start, what happened before
5. Concomitants: what else appears alongside the main complaint
6. Mental/emotional state: mood, anxieties, fears, irritability, weeping, grief
7. Sleep: position, dreams, quality, what time they wake
8. Appetite & thirst: cravings, aversions, thirst (hot/cold drinks)
9. Temperature & energy: hot/chilly, sweat patterns, energy levels
10. Constitution & history: past illnesses, family patterns, major life events

CONVERSATION RULES:
- Ask ONE focused question at a time
- Follow interesting threads before moving on
- Use classical homeopathic inquiry style
- Be warm, unhurried, and deeply curious
- When you have covered at least 8 of the 10 areas above, output this JSON at the very end of your message on a new line:
  PROFILE_COMPLETE:{"chiefComplaint":"...","symptoms":{"description":"...","location":"...","sensation":"...","intensity":0,"modalities":{"better":[],"worse":[]}},"mentalEmotional":{"mood":"...","fears":[],"anxieties":"..."},"sleep":{"quality":"...","position":"...","dreams":"..."},"appetite":{"cravings":[],"aversions":[],"thirst":"..."},"constitution":{"temperature":"chilly/hot/mixed","energy":"...","perspiration":"..."},"history":"...","keyNotes":[]}
- Never mention the JSON or the profile to the patient
- Start with a warm greeting and question about their chief complaint`;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  // CORS — tighten origin in production to your actual domain
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Rate limiting
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  // Validate body
  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  // Sanitise — only pass role + content, nothing else
  const safeMessages = messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content).slice(0, 4000), // cap per-message length
  }));

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

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
        max_tokens: 1000,
        system: INTAKE_SYSTEM,
        messages: safeMessages,
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
    console.error("Unexpected error in /api/chat:", err);
    return res.status(500).json({ error: "Unexpected server error." });
  }
}
