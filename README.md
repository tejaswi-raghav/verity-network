# Verity Network MVP

Verity is a privacy-conscious, multi-layer triage tool for suspicious images and videos. It combines browser-side signal checks with Groq vision inference to surface visible manipulation indicators, counter-evidence, limitations, and a recommended verification step.

## What it does

- Accepts JPG, PNG, WEBP, MP4, MOV, and WEBM files.
- Includes a clearly labeled generated demo so first-time users can test the workflow immediately.
- Compresses images locally and samples three video frames locally.
- Computes a local SHA-256 digest and perceptual dHash.
- Measures lightweight high-frequency, compression-boundary, and temporal signals in the browser.
- Discovers C2PA-related byte markers without claiming cryptographic signature validation.
- Selects a standard or enhanced review route from the available local context.
- Sends only prepared pixels and bounded, non-diagnostic signal summaries to the server-side Groq API route.
- Returns a structured assessment instead of an unsupported binary “fake” claim.
- Produces a digest-bound analysis receipt without claiming blockchain anchoring.
- Exports a portable JSON report containing the assessment, receipt, and local evidence summary.
- Does not write uploads or results to a database.

Verity is decision support, not forensic proof. The local heuristics are routing and explainability signals, not authenticity probabilities. General-purpose vision models cannot reliably identify every generator or certify authenticity.

## Detection pipeline

1. **Browser privacy gate** prepares compressed image data or sampled video frames.
2. **Local signal extraction** calculates cryptographic and perceptual fingerprints, frequency/compression heuristics, temporal variation, and a C2PA marker hint.
3. **Dynamic routing** labels the review standard or enhanced based on signal availability and media complexity.
4. **Groq visual review** evaluates only visible evidence with conservative instructions and explicit limitations.
5. **Evidence fusion** returns the model assessment beside every local layer, counter-evidence, and a human verification action.
6. **Receipt generation** binds the file digest, perceptual fingerprint, timestamp, and request identifier into an evidence digest.

The result view prioritizes plain-language evidence, counter-evidence, and the recommended human action. Detailed module output is available in a collapsed technical-evidence section.

## Production integration path

The interface also documents future enterprise architecture without presenting it as active functionality:

- ONNX Runtime Web and WebGPU forensic models
- signed C2PA manifest validation with hardware-backed trust
- confidential TEE execution and zero-knowledge proofs
- federated learning and vector-signature threat graphs
- governed decentralized timestamping

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
- `qwen/qwen3.8-27b` vision model

## Privacy and limits

Verity does not persist media itself, but prepared frames are sent to Groq for inference and are subject to Groq's service terms. C2PA marker discovery does not validate a manifest or its signer. The generated receipt is not signed, notarized, or ledger-anchored. The API includes best-effort per-instance throttling, but a durable distributed limiter and authentication are still required before high-volume deployment. Add specialist forensic models, calibration datasets, and independent security review before using this in high-stakes contexts.

## License

MIT
