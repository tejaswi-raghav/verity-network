import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;
const MODEL = "qwen/qwen3.8-27b";
const MAX_BODY_BYTES = 4_200_000;

type GroqPayload = { verdict?: string; syntheticRisk?: number; confidence?: number; summary?: string; findings?: Array<{ label?: string; observation?: string; significance?: string }>; counterEvidence?: string[]; recommendedAction?: string; limitations?: string };
function clampScore(value: unknown, fallback: number) { const number = typeof value === "number" ? value : Number(value); return Number.isFinite(number) ? Math.min(100, Math.max(0, Math.round(number))) : fallback; }
function cleanText(value: unknown, fallback: string, max = 600) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback; }

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "The analysis service is not configured yet." }, { status: 503 });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "The prepared media is too large. Try a smaller file." }, { status: 413 });
  try {
    const body = await request.json() as { images?: unknown; fileName?: unknown; mediaType?: unknown };
    const images = Array.isArray(body.images) ? body.images.filter((item): item is string => typeof item === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(item)).slice(0, 3) : [];
    if (!images.length) return NextResponse.json({ error: "No valid image data was received." }, { status: 400 });
    if (JSON.stringify(images).length > MAX_BODY_BYTES) return NextResponse.json({ error: "The prepared media is too large. Try a smaller file." }, { status: 413 });
    const mediaType = body.mediaType === "video" ? "video sampled at multiple points" : "image";
    const fileName = cleanText(body.fileName, "uploaded media", 160);
    const prompt = `You are an evidence-first synthetic-media triage assistant. Review this ${mediaType} named "${fileName}". Look only for VISUALLY OBSERVABLE clues: inconsistent lighting/shadows/reflections, face/hair/hand/anatomy artifacts, warped geometry, repeated textures, halos or compositing edges, unnatural text, implausible detail, and—when multiple frames are supplied—cross-frame identity or object inconsistencies.

Important: a vision-language model cannot prove whether media is AI-generated, inspect C2PA/EXIF metadata from these pixels, recover editing history, or replace a dedicated forensic model. Compression, screenshots, filters, low light, and motion blur can resemble manipulation. Calibrate conservatively. If evidence is weak, choose "uncertain". Never claim hidden metadata or model fingerprints were examined.

Return JSON only with exactly these fields: {"verdict":"likely_authentic|uncertain|likely_manipulated","syntheticRisk":0-100,"confidence":0-100,"summary":"2 concise sentences grounded in visible evidence","findings":[{"label":"short label","observation":"specific visible observation, or say no anomaly observed","significance":"low|medium|high"}],"counterEvidence":["1-3 visible facts or innocent explanations that reduce certainty"],"recommendedAction":"one concrete verification action a user should take next","limitations":"one concise, media-specific limitation"}. Provide 2-4 findings. Do not identify a real person or infer sensitive traits.`;
    const content = [{ type: "text", text: prompt }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))];
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content }], temperature: 0.2, max_completion_tokens: 800, response_format: { type: "json_object" } }), signal: AbortSignal.timeout(28_000) });
    const groq = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) { console.error("Groq analysis error", response.status, groq.error?.message); return NextResponse.json({ error: response.status === 429 ? "The analyzer is busy. Please wait a moment and retry." : "The AI analysis service could not complete this scan." }, { status: response.status === 429 ? 429 : 502 }); }
    const raw = groq.choices?.[0]?.message?.content;
    if (!raw) throw new Error("The model returned an empty response.");
    const parsed = JSON.parse(raw) as GroqPayload;
    const allowedVerdicts = ["likely_authentic", "uncertain", "likely_manipulated"];
    const verdict = allowedVerdicts.includes(parsed.verdict || "") ? parsed.verdict : "uncertain";
    const findings = Array.isArray(parsed.findings) ? parsed.findings.slice(0, 4).map((finding) => ({ label: cleanText(finding.label, "Visual observation", 80), observation: cleanText(finding.observation, "No reliable observation was returned.", 420), significance: ["low", "medium", "high"].includes(finding.significance || "") ? finding.significance : "low" })) : [];
    return NextResponse.json({ verdict, syntheticRisk: clampScore(parsed.syntheticRisk, 50), confidence: clampScore(parsed.confidence, 50), summary: cleanText(parsed.summary, "The visual review was inconclusive."), findings: findings.length ? findings : [{ label: "Insufficient visual evidence", observation: "No dependable manipulation clue was isolated in the supplied pixels.", significance: "low" }], counterEvidence: Array.isArray(parsed.counterEvidence) ? parsed.counterEvidence.slice(0, 3).map((item) => cleanText(item, "", 260)).filter(Boolean) : [], recommendedAction: cleanText(parsed.recommendedAction, "Find the earliest available source and compare it with reporting from an independent trusted outlet.", 420), limitations: cleanText(parsed.limitations, "This is an AI-assisted visual review, not proof of authenticity or manipulation.", 420), framesAnalyzed: images.length, model: MODEL }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error("Analysis route failed", error instanceof Error ? error.message : error); return NextResponse.json({ error: "The file could not be analyzed. Please try a different image or shorter video." }, { status: 500 }); }
}
