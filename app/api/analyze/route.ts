import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;
const MODEL = "qwen/qwen3.8-27b";
const MAX_BODY_BYTES = 4_200_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 12;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

type GroqPayload = { verdict?: string; syntheticRisk?: number; confidence?: number; summary?: string; findings?: Array<{ label?: string; observation?: string; significance?: string }>; counterEvidence?: string[]; recommendedAction?: string; limitations?: string };
type LocalSignals = {
  version?: string;
  sha256?: string;
  perceptualHash?: string;
  provenance?: { status?: string; detail?: string };
  frequency?: { highFrequencyEnergy?: number; blockBoundaryRatio?: number; detail?: string };
  temporal?: { frameVariation?: number | null; detail?: string };
  route?: string;
  routeReasons?: string[];
};
function clampScore(value: unknown, fallback: number) { const number = typeof value === "number" ? value : Number(value); return Number.isFinite(number) ? Math.min(100, Math.max(0, Math.round(number))) : fallback; }
function cleanText(value: unknown, fallback: string, max = 600) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback; }
function parseModelJson(raw: string) {
  try { return JSON.parse(raw) as GroqPayload; }
  catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("The model returned invalid JSON.");
    return JSON.parse(raw.slice(start, end + 1)) as GroqPayload;
  }
}
function rateLimit(request: NextRequest) {
  const now = Date.now();
  if (requestWindows.size > 1_000) {
    for (const [key, value] of requestWindows) if (value.resetAt <= now) requestWindows.delete(key);
  }
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const current = requestWindows.get(client);
  if (!current || current.resetAt <= now) {
    requestWindows.set(client, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }
  current.count += 1;
  if (current.count <= RATE_LIMIT_REQUESTS) return null;
  return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
}
function cleanLocalSignals(value: unknown): LocalSignals | null {
  if (!value || typeof value !== "object") return null;
  const input = value as LocalSignals;
  return {
    version: cleanText(input.version, "unknown", 40),
    sha256: typeof input.sha256 === "string" && /^[a-f0-9]{64}$/i.test(input.sha256) ? input.sha256.toLowerCase() : undefined,
    perceptualHash: typeof input.perceptualHash === "string" && /^[a-f0-9]{16}$/i.test(input.perceptualHash) ? input.perceptualHash.toLowerCase() : undefined,
    provenance: input.provenance ? {
      status: ["marker_present", "not_detected", "not_applicable"].includes(input.provenance.status || "") ? input.provenance.status : "not_applicable",
      detail: cleanText(input.provenance.detail, "No provenance signal supplied.", 260),
    } : undefined,
    frequency: input.frequency ? {
      highFrequencyEnergy: clampScore(input.frequency.highFrequencyEnergy, 0),
      blockBoundaryRatio: clampScore(input.frequency.blockBoundaryRatio, 0),
      detail: cleanText(input.frequency.detail, "Local signal heuristic.", 260),
    } : undefined,
    temporal: input.temporal ? {
      frameVariation: input.temporal.frameVariation === null ? null : clampScore(input.temporal.frameVariation, 0),
      detail: cleanText(input.temporal.detail, "Local temporal heuristic.", 260),
    } : undefined,
    route: input.route === "enhanced" ? "enhanced" : "standard",
    routeReasons: Array.isArray(input.routeReasons) ? input.routeReasons.slice(0, 3).map((item) => cleanText(item, "", 160)).filter(Boolean) : [],
  };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "The analysis service is not configured yet." }, { status: 503 });
  const retryAfter = rateLimit(request);
  if (retryAfter) return NextResponse.json({ error: "Too many scans from this connection. Please wait a minute and retry." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "The prepared media is too large. Try a smaller file." }, { status: 413 });
  try {
    const body = await request.json() as { images?: unknown; fileName?: unknown; mediaType?: unknown; localSignals?: unknown };
    const images = Array.isArray(body.images) ? body.images.filter((item): item is string => typeof item === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(item)).slice(0, 3) : [];
    if (!images.length) return NextResponse.json({ error: "No valid image data was received." }, { status: 400 });
    if (JSON.stringify(images).length > MAX_BODY_BYTES) return NextResponse.json({ error: "The prepared media is too large. Try a smaller file." }, { status: 413 });
    const mediaType = body.mediaType === "video" ? "video sampled at multiple points" : "image";
    const fileName = cleanText(body.fileName, "uploaded media", 160);
    const localSignals = cleanLocalSignals(body.localSignals);
    const localContext = localSignals ? `The browser also produced NON-DIAGNOSTIC routing signals: high-frequency energy ${localSignals.frequency?.highFrequencyEnergy ?? "unavailable"}/100, block-boundary ratio ${localSignals.frequency?.blockBoundaryRatio ?? "unavailable"}/100, frame variation ${localSignals.temporal?.frameVariation ?? "not applicable"}, provenance marker status ${localSignals.provenance?.status ?? "not applicable"}. These are signal-quality and routing hints, not deepfake probabilities. Do not treat them as proof or claim that cryptographic provenance was validated.` : "No browser-side routing signals were supplied.";
    const prompt = `You are an evidence-first synthetic-media triage assistant. Review this ${mediaType} named "${fileName}". Look only for VISUALLY OBSERVABLE clues: inconsistent lighting/shadows/reflections, face/hair/hand/anatomy artifacts, warped geometry, repeated textures, halos or compositing edges, unnatural text, implausible detail, and—when multiple frames are supplied—cross-frame identity or object inconsistencies.

${localContext}

Important: a vision-language model cannot prove whether media is AI-generated, inspect C2PA/EXIF metadata from these pixels, recover editing history, or replace a dedicated forensic model. Compression, screenshots, filters, low light, and motion blur can resemble manipulation. Calibrate conservatively. If evidence is weak, choose "uncertain". Never claim hidden metadata or model fingerprints were examined.

Return JSON only with exactly these fields: {"verdict":"likely_authentic|uncertain|likely_manipulated","syntheticRisk":0-100,"confidence":0-100,"summary":"2 concise sentences grounded in visible evidence","findings":[{"label":"short label","observation":"specific visible observation, or say no anomaly observed","significance":"low|medium|high"}],"counterEvidence":["1-3 visible facts or innocent explanations that reduce certainty"],"recommendedAction":"one concrete verification action a user should take next","limitations":"one concise, media-specific limitation"}. Provide 2-4 findings. Do not identify a real person or infer sensitive traits.`;
    const content = [{ type: "text", text: prompt }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))];
    const payload = JSON.stringify({ model: MODEL, messages: [{ role: "user", content }], temperature: 0.2, max_completion_tokens: 650, reasoning_effort: "none", include_reasoning: false, response_format: { type: "json_object" } });
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: payload, signal: AbortSignal.timeout(50_000) });
    const groq = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) {
      console.error("Groq analysis error", response.status, groq.error?.message);
      const atCapacity = response.status === 503 || /capacity/i.test(groq.error?.message || "");
      const error = atCapacity ? "Groq's vision model is temporarily at capacity. Please retry in a minute." : response.status === 429 ? "The analyzer is busy. Please wait a moment and retry." : "The AI analysis service could not complete this scan.";
      return NextResponse.json({ error }, { status: response.status === 429 ? 429 : 503 });
    }
    const raw = groq.choices?.[0]?.message?.content;
    if (!raw) throw new Error("The model returned an empty response.");
    const parsed = parseModelJson(raw);
    const allowedVerdicts = ["likely_authentic", "uncertain", "likely_manipulated"];
    const verdict = allowedVerdicts.includes(parsed.verdict || "") ? parsed.verdict : "uncertain";
    const findings = Array.isArray(parsed.findings) ? parsed.findings.slice(0, 4).map((finding) => ({ label: cleanText(finding.label, "Visual observation", 80), observation: cleanText(finding.observation, "No reliable observation was returned.", 420), significance: ["low", "medium", "high"].includes(finding.significance || "") ? finding.significance : "low" })) : [];
    const completedAt = new Date().toISOString();
    const receiptId = randomUUID();
    const evidenceDigest = createHash("sha256")
      .update(`${localSignals?.sha256 || "no-file-digest"}:${localSignals?.perceptualHash || "no-perceptual-hash"}:${completedAt}:${receiptId}`)
      .digest("hex");
    return NextResponse.json({
      verdict,
      syntheticRisk: clampScore(parsed.syntheticRisk, 50),
      confidence: clampScore(parsed.confidence, 50),
      summary: cleanText(parsed.summary, "The visual review was inconclusive."),
      findings: findings.length ? findings : [{ label: "Insufficient visual evidence", observation: "No dependable manipulation clue was isolated in the supplied pixels.", significance: "low" }],
      counterEvidence: Array.isArray(parsed.counterEvidence) ? parsed.counterEvidence.slice(0, 3).map((item) => cleanText(item, "", 260)).filter(Boolean) : [],
      recommendedAction: cleanText(parsed.recommendedAction, "Find the earliest available source and compare it with reporting from an independent trusted outlet.", 420),
      limitations: cleanText(parsed.limitations, "This is an AI-assisted visual review, not proof of authenticity or manipulation.", 420),
      framesAnalyzed: images.length,
      model: MODEL,
      pipeline: {
        route: localSignals?.route || "standard",
        modules: [
          { id: "privacy-gate", label: "Edge privacy gate", state: "complete", detail: "Preview frames and local signals were prepared in the browser." },
          { id: "fingerprint", label: "Perceptual fingerprint", state: localSignals?.perceptualHash ? "complete" : "unavailable", detail: localSignals?.perceptualHash ? `dHash ${localSignals.perceptualHash}` : "No local fingerprint was supplied." },
          { id: "frequency", label: "Frequency + compression", state: localSignals?.frequency ? "complete" : "unavailable", detail: localSignals?.frequency ? `HF ${localSignals.frequency.highFrequencyEnergy}/100 · block ${localSignals.frequency.blockBoundaryRatio}/100` : "No local frequency signal was supplied." },
          { id: "provenance", label: "Provenance discovery", state: localSignals?.provenance?.status === "marker_present" ? "review" : "limited", detail: localSignals?.provenance?.detail || "No provenance signal was supplied." },
          { id: "vision", label: "Visual reasoning", state: "complete", detail: `Reviewed ${images.length} prepared ${images.length === 1 ? "frame" : "frames"} with ${MODEL}.` },
          { id: "fusion", label: "Evidence fusion", state: "complete", detail: "The assessment combines visible evidence with non-diagnostic local routing signals." },
        ],
      },
      receipt: {
        id: receiptId,
        completedAt,
        evidenceDigest,
        fileDigest: localSignals?.sha256 || null,
        retained: false,
        ledgerAnchored: false,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Analysis route failed", error instanceof Error ? error.message : error);
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || /timeout/i.test(error.message));
    return NextResponse.json({ error: timedOut ? "Groq's vision model is taking too long right now. Please retry in a minute." : "The file could not be analyzed. Please try a different image or shorter video." }, { status: timedOut ? 503 : 500 });
  }
}
