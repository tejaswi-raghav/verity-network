# Verity MVP

Verity is a privacy-conscious, AI-assisted triage tool for suspicious images and videos. It uses Groq vision inference to surface visible manipulation indicators, counter-evidence, limitations, and a recommended verification step.

## What it does

- Accepts JPG, PNG, WEBP, MP4, MOV, and WEBM files.
- Compresses images locally and samples three video frames locally.
- Sends only those prepared pixels to a server-side Groq API route.
- Returns a structured assessment instead of an unsupported binary “fake” claim.
- Does not write uploads or results to a database.

Verity is decision support, not forensic proof. General-purpose vision models cannot inspect original-file provenance, reliably identify every generator, or certify authenticity.

## Local development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Add your Groq key to `.env.local`:

```bash
GROQ_API_KEY=your_key_here
```

Open http://localhost:3000.

The secret is read only by `app/api/analyze/route.ts` and must never use a `NEXT_PUBLIC_` prefix.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Add `GROQ_API_KEY` under Project Settings → Environment Variables.
3. Deploy. Future pushes to `main` will redeploy automatically.

## Stack

- Next.js 16 and React 19
- Tailwind CSS 4
- Groq Chat Completions API
- `qwen/qwen3.6-27b` vision model

## Privacy and limits

Verity does not persist media itself, but prepared frames are sent to Groq for inference and are subject to Groq's service terms. Add authentication, durable rate limiting, abuse controls, and a specialist forensic model before using this as a high-volume public service.

## License

MIT
