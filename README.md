# JEE Console — web app

A JEE practice app with an AI tutor (hints + step-by-step explanations) and photo-to-question
import, deployed as a website. Installable on phones via "Add to Home Screen" — no app store
needed, no build tools, no APK signing.

**Your Google Gemini API key lives only on the server** (`api/ai.js`), never in the browser.
Gemini's free tier (Flash / Flash-Lite models) is used, so there's no Anthropic billing involved.
Each device still gets a free daily allowance of AI calls (default 15/day, configurable), tracked
by a small Redis database — this protects Gemini's own free-tier quota from being exhausted by a
single popular week, since that quota is shared across every visitor to your app.

> Note: free-tier limits and terms are set by Google and can change without notice (they already
> cut Gemini's free quota once in late 2025). Also, on the free tier Google may use your prompts
> to improve their models unless you're in the EU/UK/EEA — worth knowing since users upload photos
> of their own work.

---

## How the AI tutor explains things

The **Hint** and **Full solution** buttons don't fetch content from any outside coaching site —
they ask Gemini directly, with a prompt that instructs it to teach like a patient tutor helping a
struggling Class 11 student: short sentences, one idea per line, plain words before symbols,
technical terms explained inline, everyday analogies where useful. No jargon-heavy textbook
language.

If explanations still come out too complex or too simple for your students after testing, the
wording to tune lives in `public/index.html`, inside the `hintBtn` and `explainBtn` click
handlers (search for `const prompt =`). You can hand a few example outputs to an AI assistant and
ask it to adjust that prompt text.

---

## JEE / NEET mode

A toggle in the header switches the whole app between **JEE** and **NEET**:

- **Physics and Chemistry** questions are shared between both modes (add a Physics question once,
  see it whichever mode you're in).
- **Maths** only shows up in JEE mode; **Biology** only shows up in NEET mode.
- Photo import, hints, and explanations all pick up the current mode automatically — the AI
  tutor's prompt shifts wording between "JEE (IIT-JEE)" and "NEET (medical entrance)" depending
  on which is selected.
- The chosen mode is remembered per device (stored the same way as everything else, in the
  browser's local storage) — it doesn't need a server change.

If you want to keep JEE-only Physics/Chemistry questions from ever showing up in NEET mode (or
vice versa) because the style of question differs too much between the two exams, the simplest
fix is to add a small "exam" tag to each question rather than relying on subject-name overlap —
ask an AI assistant to add that if you find you need it.

---

## What's in this project

```
jee-webapp/
  public/
    index.html       ← the whole app (UI + logic)
    manifest.json     ← PWA metadata (name, icons, colors)
    sw.js              ← service worker (offline app-shell caching)
    icons/             ← app icons
  api/
    ai.js              ← proxies hint/explanation/photo-extraction calls to Gemini
    usage.js           ← reports today's usage count to the app
    _lib/quota.js       ← per-device daily limit, backed by Upstash Redis
  vercel.json
  package.json
```

---

## 1. Get a Gemini API key

Go to https://aistudio.google.com/app/apikey → **Create API key** (no credit card needed). Copy
it — you'll paste it into Vercel's dashboard in step 4, never into any file in this project.

## 2. Create a free Upstash Redis database (for the daily quota)

This is what stops one popular week from exhausting Gemini's free-tier quota unexpectedly — it
caps each device to N free AI calls/day.

1. Go to https://upstash.com → sign up free → **Create Database** (any region close to your
   users is fine).
2. On the database page, find **REST API** → copy the `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` values.
3. Free tier covers far more requests/day than this app will use at small-to-medium scale.

*(If you skip this step, the app still works, but with no quota enforcement — anyone could run
up unlimited API calls on your key. Don't skip it before publishing.)*

## 3. Push this project to GitHub

```bash
cd jee-webapp
git init
git add .
git commit -m "JEE Console web app"
```
Create a new repo on GitHub and push it there (or use GitHub Desktop if you prefer a GUI).

## 4. Deploy on Vercel (free tier)

1. Go to https://vercel.com → sign up free → **Add New Project** → import your GitHub repo.
2. Vercel auto-detects the `api/` folder as serverless functions and `public/` as the static
   site — no build configuration needed.
3. Before clicking Deploy, open **Environment Variables** and add:
   | Name | Value |
   |---|---|
   | `GEMINI_API_KEY` | your key from step 1 |
   | `UPSTASH_REDIS_REST_URL` | from step 2 |
   | `UPSTASH_REDIS_REST_TOKEN` | from step 2 |
   | `DAILY_AI_LIMIT` | e.g. `15` (optional, defaults to 15) |
4. Click **Deploy**. In about a minute you'll get a live URL like
   `https://jee-console.vercel.app`.

That's it — the app is live. Every visitor gets their own device ID (generated automatically,
stored in their browser) and their own daily AI allowance, all served through your single
Gemini key.

## 5. Install it like an app

Open the Vercel URL on a phone:
- **Android (Chrome)**: menu (⋮) → "Add to Home screen" / "Install app"
- **iPhone (Safari)**: Share button → "Add to Home Screen"

It launches full-screen with its own icon, no browser bar.

## 6. Updating the app later

Just push new commits to GitHub — Vercel redeploys automatically. No app store review, no
waiting.

## 7. (Later) Wrapping it for the Play Store

Once this is live and working, you can list it on the Play Store with minimal extra work using
a **Trusted Web Activity** (TWA) — it wraps your existing hosted PWA in a thin native shell that
opens the same URL. Tools like [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) or
[PWABuilder](https://www.pwabuilder.com) automate this. Ask me when you're ready and I'll walk
you through it — the web app itself won't need to change.

---

## Notes on cost & abuse protection

- The Upstash-backed daily limit is the main safety net — with a free provider, it protects your
  shared quota from being exhausted by one busy day, not your wallet.
- Consider adding Vercel's built-in Web Application Firewall / rate limiting for extra
  protection against bots hammering `/api/ai` before quota check even runs, if this gets real
  traffic.
- Check https://aistudio.google.com for your current Gemini free-tier limits — they're not fixed
  and can be lowered by Google at any time. If you outgrow them, Gemini also has a paid tier with
  the same API shape (just billing enabled on the same key).
