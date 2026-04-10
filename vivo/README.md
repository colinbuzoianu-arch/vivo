# Vivo — Classical Homeopathic Consultation

AI-powered classical homeopathic intake interview + remedy matching from a 100-remedy database.

## Architecture

```
Browser (React + Vite)
    ↓  POST /api/chat      (intake conversation)
    ↓  POST /api/analysis  (clinical rationale)
Vercel Serverless Functions
    ↓  POST https://api.anthropic.com/v1/messages
Anthropic API  ← API key lives here only, never in browser
```

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/colinbuzoianu-arch/vivo.git
cd vivo
npm install
```

### 2. Set your API key

```bash
cp .env.example .env.local
# Edit .env.local and add your Anthropic API key:
# ANTHROPIC_API_KEY=sk-ant-...
```

Get your key at https://console.anthropic.com

### 3. Run locally with Vercel Dev (recommended)

Vercel Dev runs both the React frontend and the serverless API functions:

```bash
npm install -g vercel      # install Vercel CLI once
vercel dev                 # starts on http://localhost:3000
```

### 3b. Alternative: Vite only (no API functions)

```bash
npm run dev                # starts on http://localhost:5173
```

> ⚠️ Without `vercel dev`, calls to `/api/chat` and `/api/analysis` will fail
> because the serverless functions won't be running.

---

## Deploy to Vercel

### First deploy

```bash
vercel                     # follow prompts, link to your GitHub repo
```

Or connect via the Vercel dashboard:
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`

### Add your API key in Vercel

```
Vercel Dashboard → Your Project → Settings → Environment Variables

Name:  ANTHROPIC_API_KEY
Value: sk-ant-your-key-here
Environments: ✓ Production  ✓ Preview  ✓ Development
```

### Every subsequent deploy

```bash
git add .
git commit -m "your message"
git push origin main       # auto-deploys via Vercel GitHub integration
```

---

## Project Structure

```
vivo/
├── api/
│   ├── chat.js            # Intake conversation endpoint
│   └── analysis.js        # Clinical rationale endpoint
├── src/
│   ├── main.jsx           # React entry point
│   ├── App.jsx            # Main app + all UI components
│   ├── App.module.css     # Component styles
│   ├── index.css          # Global reset
│   └── lib/
│       ├── api.js         # Frontend API calls (→ /api/*)
│       ├── remedyDb.js    # 100-remedy database
│       └── scorer.js      # Weighted matching engine
├── public/
│   └── favicon.svg
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── .env.example           # Template — safe to commit
├── .env.local             # Your real key — NEVER commit
└── .gitignore
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Your Anthropic API key |
| `RATE_LIMIT_MAX` | Optional | Max requests per IP per hour (default: 10) |
| `ALLOWED_ORIGIN` | Optional | CORS origin (default: `*`, set to your domain in prod) |

---

## Upgrading Rate Limiting

The built-in rate limiter is in-memory and resets on cold starts.
For production with persistent limits, swap to **Upstash Redis** (free tier):

1. Create a free Redis database at https://upstash.com
2. `npm install @upstash/ratelimit @upstash/redis`
3. Replace the `isRateLimited` function in `api/chat.js` and `api/analysis.js`:

```js
import { Ratelimit } from "@upstash/ratelimit";
import { Redis }     from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis:     Redis.fromEnv(),
  limiter:   Ratelimit.slidingWindow(10, "1 h"),
  analytics: true,
});

// In handler:
const { success } = await ratelimit.limit(ip);
if (!success) return res.status(429).json({ error: "Too many requests." });
```

4. Add to Vercel env vars: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

---

## Recommended Add-ons (all free tiers available)

| Tool | Purpose | Link |
|---|---|---|
| Vercel Analytics | Usage stats, page views | Built into Vercel dashboard |
| Sentry | Error tracking & alerts | sentry.io |
| Namecheap / Cloudflare | Custom domain (~$10/yr) | namecheap.com |

---

## Disclaimer

This application is for **educational and wellness purposes only**.
It is not a substitute for professional medical advice, diagnosis, or treatment.
Always consult a qualified homeopath or healthcare practitioner before beginning
any treatment.
