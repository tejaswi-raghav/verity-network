"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Braces, Check, CheckCircle2, ChevronDown, Copy, Cpu, DatabaseZap, Download, FileImage, FileVideo, Fingerprint, Gauge, GitBranch, Hash, KeyRound, Layers3, LoaderCircle, LockKeyhole, Network, RotateCcw, ScanSearch, ShieldCheck, Sparkles, UploadCloud, X } from "lucide-react";
import { LocalForensics, runLocalForensics } from "@/lib/client-forensics";

type Finding = { label: string; observation: string; significance: "low" | "medium" | "high" };
type Analysis = {
  verdict: "likely_authentic" | "uncertain" | "likely_manipulated";
  syntheticRisk: number; confidence: number; summary: string; findings: Finding[];
  counterEvidence: string[]; recommendedAction: string; limitations: string;
  framesAnalyzed: number; model: string;
  pipeline: { route: "standard" | "enhanced"; modules: Array<{ id: string; label: string; state: string; detail: string }> };
  receipt: { id: string; completedAt: string; evidenceDigest: string; fileDigest: string | null; retained: boolean; ledgerAnchored: boolean };
};

const MAX_FILE_BYTES = 80 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"]);

function waitFor(target: HTMLMediaElement, event: string) {
  return new Promise<void>((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("Could not read this media file.")); };
    const cleanup = () => { target.removeEventListener(event, done); target.removeEventListener("error", failed); };
    target.addEventListener(event, done, { once: true });
    target.addEventListener("error", failed, { once: true });
  });
}

function canvasFrame(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, 1280 / width, 960 / height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the image.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.76);
}

async function prepareImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Could not decode this image.")); });
    return [canvasFrame(image, image.naturalWidth, image.naturalHeight)];
  } finally { URL.revokeObjectURL(url); }
}

async function prepareVideo(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata"; video.muted = true; video.playsInline = true; video.src = url;
    await waitFor(video, "loadedmetadata");
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error("This video's duration could not be read.");
    const frames: string[] = [];
    for (const ratio of [0.15, 0.5, 0.85]) {
      video.currentTime = Math.min(video.duration - 0.05, Math.max(0, video.duration * ratio));
      await waitFor(video, "seeked");
      frames.push(canvasFrame(video, video.videoWidth, video.videoHeight));
    }
    return frames;
  } finally { URL.revokeObjectURL(url); }
}

const verdictCopy = {
  likely_authentic: { label: "No strong manipulation indicators", color: "text-[#8ee6bd]", ring: "stroke-[#76d5aa]" },
  uncertain: { label: "Inconclusive — verify the source", color: "text-[#ffd37a]", ring: "stroke-[#f5bd52]" },
  likely_manipulated: { label: "Manipulation indicators found", color: "text-[#ff9b82]", ring: "stroke-[#ff8666]" },
};

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<"idle" | "preparing" | "analyzing" | "done">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Analysis | null>(null);
  const [localReport, setLocalReport] = useState<LocalForensics | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseFile(next: File | undefined) {
    if (!next) return;
    setError(""); setResult(null); setLocalReport(null); setCopied(false); setStage("idle");
    if (!SUPPORTED_TYPES.has(next.type)) return setError("Choose a JPG, PNG, WEBP, MP4, MOV, or WEBM file.");
    if (next.size > MAX_FILE_BYTES) return setError("Please choose a file smaller than 80 MB.");
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(URL.createObjectURL(next));
  }

  async function analyze() {
    if (!file) return inputRef.current?.click();
    setError(""); setResult(null);
    try {
      setStage("preparing");
      const images = file.type.startsWith("video/") ? await prepareVideo(file) : await prepareImage(file);
      const localSignals = await runLocalForensics(file, images);
      setLocalReport(localSignals);
      setStage("analyzing");
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images, fileName: file.name, mediaType: file.type.startsWith("video/") ? "video" : "image", localSignals }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Analysis failed. Please try again.");
      setResult(payload); setStage("done");
    } catch (cause) { setStage("idle"); setError(cause instanceof Error ? cause.message : "Analysis failed. Please try again."); }
  }

  async function chooseDemo() {
    try {
      setError("");
      const response = await fetch("/verity-demo-synthetic.jpg");
      if (!response.ok) throw new Error("The demo media could not be loaded.");
      const blob = await response.blob();
      chooseFile(new File([blob], "verity-generated-demo.jpg", { type: "image/jpeg" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The demo media could not be loaded.");
    }
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(""); setResult(null); setLocalReport(null); setCopied(false); setError(""); setStage("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  function downloadReport() {
    if (!result) return;
    const report = {
      schema: "verity-report-v1",
      exportedAt: new Date().toISOString(),
      media: file ? { name: file.name, type: file.type, bytes: file.size } : null,
      assessment: result,
      edgeSignals: localReport,
      disclaimer: "AI-assisted decision support. This report is not proof of authenticity or manipulation.",
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `verity-report-${result.receipt.id.slice(0, 8)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function copyReceipt() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.receipt.evidenceDigest);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Your browser blocked clipboard access. Export the report to preserve the full digest.");
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }
  const busy = stage === "preparing" || stage === "analyzing";
  const stateCopy = stage === "preparing" ? "Running private edge checks…" : "Fusing visual evidence…";
  const verdict = result ? verdictCopy[result.verdict] : null;

  return (
    <main className="min-h-screen bg-[#080b0d] text-[#f4f7f6]">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Verity home"><span className="grid size-8 place-items-center rounded-[10px] bg-[#b8ff57] text-[#071008]"><Fingerprint className="size-[18px]" /></span><span className="text-sm font-semibold tracking-tight">VERITY</span><span className="hidden rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-400 sm:block">EDGE + CLOUD MVP</span></a>
        <div className="flex items-center gap-2 text-xs text-slate-400"><LockKeyhole className="size-3.5 text-[#b8ff57]" /> Raw file stays local</div>
      </header>

      <section id="top" className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#b8ff57]/20 bg-[#b8ff57]/5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[.14em] text-[#caff83]"><Sparkles className="size-3.5" /> Multi-layer verification workspace</div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-.045em] sm:text-6xl">A second opinion for suspicious media.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm leading-6 text-slate-400 sm:text-base">Verity runs private browser-side forensic checks, routes prepared evidence through AI review, and returns an explainable assessment with a digest-bound receipt.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2 text-[11px] text-slate-500"><span className="trust-pill"><Check className="size-3" /> No account required</span><span className="trust-pill"><Check className="size-3" /> No media storage</span><span className="trust-pill"><Check className="size-3" /> Evidence, not a verdict</span></div>
        </div>

        <div className="mx-auto mt-10 max-w-4xl">
          {!result ? (
            <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1216] shadow-[0_30px_90px_rgba(0,0,0,.35)]">
              {!file ? (
                <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} className={`m-3 grid min-h-[390px] place-items-center rounded-[21px] border border-dashed p-8 text-center transition ${dragging ? "border-[#b8ff57] bg-[#b8ff57]/5" : "border-white/15 bg-[#0a0e11]"}`}>
                  <div><button type="button" onClick={() => inputRef.current?.click()} className="group rounded-2xl px-6 py-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b8ff57]" aria-label="Choose an image or video to analyze"><span className="mx-auto grid size-16 place-items-center rounded-2xl border border-white/10 bg-white/[.035] text-[#b8ff57] transition group-hover:border-[#b8ff57]/25 group-hover:bg-[#b8ff57]/5"><UploadCloud className="size-7" /></span><h2 className="mt-6 text-lg font-medium">Drop media here</h2><p className="mt-2 text-sm text-slate-500">or press Enter to choose an image or short video</p></button><p className="mt-4 text-[11px] uppercase tracking-widest text-slate-600">JPG · PNG · WEBP · MP4 · MOV · WEBM · up to 80 MB</p><button type="button" onClick={() => void chooseDemo()} className="mx-auto mt-5 flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[.025] px-3 text-[11px] font-semibold text-slate-400 hover:border-[#b8ff57]/25 hover:text-[#dfffb2]"><Sparkles className="size-3.5" /> Try a generated demo</button><p className="mx-auto mt-4 max-w-md text-[11px] leading-5 text-slate-600">The original file stays in your browser. Compressed preview frames are sent securely to Groq for visual analysis and are not stored by Verity.</p></div>
                </div>
              ) : (
                <div className="grid gap-0 md:grid-cols-[1.3fr_.7fr]">
                  <div className="relative min-h-[390px] overflow-hidden bg-black">{file.type.startsWith("video/") ? <video src={preview} controls className="absolute inset-0 size-full object-contain" /> : <img src={preview} alt="Selected media preview" className="absolute inset-0 size-full object-contain" />}<button onClick={reset} aria-label="Remove file" className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur hover:bg-black"><X className="size-4" /></button></div>
                  <div className="flex flex-col justify-between p-6 sm:p-8">
                    <div><span className="grid size-11 place-items-center rounded-xl bg-white/5 text-slate-300">{file.type.startsWith("video/") ? <FileVideo className="size-5" /> : <FileImage className="size-5" />}</span><h2 className="mt-5 break-all text-base font-medium">{file.name}</h2><p className="mt-1 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB · {file.type.startsWith("video/") ? "3 frames will be sampled" : "image"}</p>{busy ? <div className="mt-6 space-y-2" aria-live="polite"><div className={`scan-step ${stage === "preparing" ? "scan-step-active" : "scan-step-done"}`}><span>01</span><p>Prepare privacy-safe frames</p>{stage !== "preparing" && <Check className="size-3.5" />}</div><div className={`scan-step ${stage === "analyzing" ? "scan-step-done" : ""}`}><span>02</span><p>Run edge forensic signals</p>{stage === "analyzing" && <Check className="size-3.5" />}</div><div className={`scan-step ${stage === "analyzing" ? "scan-step-active" : ""}`}><span>03</span><p>Fuse visual evidence</p>{stage === "analyzing" && <LoaderCircle className="size-3.5 animate-spin" />}</div></div> : <div className="mt-6 space-y-3 text-xs leading-5 text-slate-400"><p className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#b8ff57]" /> Computes SHA-256 and perceptual fingerprint locally</p><p className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#b8ff57]" /> Checks frequency, compression, temporal, and provenance hints</p><p className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#b8ff57]" /> Fuses signals with an explainable AI visual review</p></div>}</div>
                    <button disabled={busy} onClick={analyze} className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#b8ff57] text-sm font-semibold text-[#071008] transition hover:bg-[#c9ff7e] disabled:cursor-wait disabled:opacity-80">{busy ? <><LoaderCircle className="size-4 animate-spin" />{stateCopy}</> : <>Analyze media<ArrowRight className="size-4" /></>}</button>
                  </div>
                </div>
              )}
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0])} />
            </section>
          ) : verdict && (
            <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1216] shadow-[0_30px_90px_rgba(0,0,0,.35)]">
              <div className="grid md:grid-cols-[.72fr_1.28fr]">
                <div className="border-b border-white/8 p-7 md:border-b-0 md:border-r sm:p-9">
                  <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-slate-500">Assessment</p>
                  <div className="relative mx-auto my-7 grid size-48 place-items-center"><svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="6" /><circle cx="50" cy="50" r="43" fill="none" strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray={`${result.syntheticRisk} 100`} className={verdict.ring} /></svg><div className="text-center"><strong className="text-5xl font-semibold tracking-[-.06em]">{result.syntheticRisk}</strong><span className="text-lg text-slate-500">%</span><p className="mt-1 text-[11px] text-slate-500">AI triage risk</p></div></div>
                  <h2 className={`text-center text-base font-semibold ${verdict.color}`}>{verdict.label}</h2><p className="mt-3 text-center text-xs leading-5 text-slate-500">Assessment confidence: {result.confidence}%</p>
                  <div className="mt-5 rounded-xl border border-white/8 bg-white/[.02] p-3 text-xs"><div className="flex items-center justify-between"><span className="text-slate-500">Adaptive route</span><span className={`rounded-full px-2 py-0.5 font-semibold uppercase ${result.pipeline.route === "enhanced" ? "bg-[#f5bd52]/10 text-[#ffd37a]" : "bg-[#76d5aa]/10 text-[#8ee6bd]"}`}>{result.pipeline.route}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-slate-500">Evidence receipt</span><span className="font-mono text-[10px] text-slate-300">{result.receipt.id.slice(0, 8)}</span></div></div>
                  <p className="mt-4 text-center text-[10px] leading-4 text-slate-600">A prioritization signal, not a probability of truth.</p>
                  <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={downloadReport} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#b8ff57] text-xs font-semibold text-[#071008] hover:bg-[#c9ff7e]"><Download className="size-3.5" /> Export report</button><button onClick={reset} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:border-white/20 hover:text-white"><RotateCcw className="size-3.5" /> New scan</button></div>
                </div>
                <div className="p-7 sm:p-9">
                  <div className="flex items-start gap-3"><span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-white/5"><ShieldCheck className="size-[18px] text-[#b8ff57]" /></span><div><p className="text-sm font-medium">What the fused review found</p><p className="mt-1 text-sm leading-6 text-slate-400">{result.summary}</p></div></div>
                  <div className="mt-7"><h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Visible evidence</h3><div className="space-y-3">{result.findings.map((finding, index) => <article key={`${finding.label}-${index}`} className="rounded-xl border border-white/8 bg-white/[.018] p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">{finding.label}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${finding.significance === "high" ? "bg-[#ff8666]/10 text-[#ff9b82]" : finding.significance === "medium" ? "bg-[#f5bd52]/10 text-[#ffd37a]" : "bg-white/5 text-slate-400"}`}>{finding.significance}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{finding.observation}</p></article>)}</div></div>
                  {result.counterEvidence.length > 0 && <div className="mt-6"><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">What argues against manipulation</h3><ul className="mt-3 space-y-2">{result.counterEvidence.map((item, index) => <li key={index} className="flex gap-2 text-xs leading-5 text-slate-400"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#76d5aa]" />{item}</li>)}</ul></div>}
                  <div className="mt-6 rounded-xl border border-[#b8ff57]/15 bg-[#b8ff57]/[.04] p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#b8ff57]">Best next step</p><p className="mt-2 text-sm leading-6 text-slate-300">{result.recommendedAction}</p></div>
                  <details className="technical-details mt-6"><summary><span><Layers3 className="size-4" /> Technical evidence</span><span className="flex items-center gap-2 text-[10px] text-slate-600">{result.pipeline.modules.filter((module) => module.state === "complete").length}/{result.pipeline.modules.length} modules complete <ChevronDown className="size-3.5 disclosure-chevron" /></span></summary><div className="border-t border-white/8 p-4"><div className="grid gap-2 sm:grid-cols-2">{result.pipeline.modules.map((module, index) => <article key={module.id} className="rounded-xl border border-white/8 bg-white/[.018] p-3"><div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${module.state === "complete" ? "bg-[#76d5aa]" : module.state === "review" ? "bg-[#f5bd52]" : "bg-slate-600"}`} /><p className="text-xs font-medium text-slate-300">{String(index + 1).padStart(2, "0")} · {module.label}</p></div><p className="mt-2 text-[11px] leading-4 text-slate-600">{module.detail}</p></article>)}</div>{localReport && <div className="mt-4 rounded-xl border border-[#67e8f9]/12 bg-[#67e8f9]/[.025] p-4"><div className="flex items-center gap-2"><Cpu className="size-4 text-[#67e8f9]" /><h3 className="text-xs font-semibold uppercase tracking-wider text-[#8ceaf7]">Browser-edge signals</h3></div><div className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div className="result-row"><span>High-frequency energy</span><strong className="muted">{localReport.frequency.highFrequencyEnergy}/100</strong></div><div className="result-row"><span>Block-boundary ratio</span><strong className="muted">{localReport.frequency.blockBoundaryRatio}/100</strong></div><div className="result-row"><span>Frame variation</span><strong className="muted">{localReport.temporal.frameVariation === null ? "N/A" : `${localReport.temporal.frameVariation}/100`}</strong></div><div className="result-row"><span>C2PA marker</span><strong className="muted">{localReport.provenance.status === "marker_present" ? "Found, unvalidated" : localReport.provenance.status === "not_detected" ? "Not detected" : "Not checked"}</strong></div></div><p className="mt-3 text-[10px] leading-4 text-slate-600">Routing measurements only. These values are not authenticity probabilities.</p></div>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/10 p-3"><div><p className="text-[10px] uppercase tracking-wider text-slate-600">Evidence digest</p><p className="mt-1 font-mono text-[10px] text-slate-400">{result.receipt.evidenceDigest.slice(0, 20)}…</p></div><button onClick={copyReceipt} className="flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-[11px] font-semibold text-slate-400 hover:text-white">{copied ? <Check className="size-3.5 text-[#76d5aa]" /> : <Copy className="size-3.5" />}{copied ? "Copied" : "Copy digest"}</button></div></div></details>
                  <div className="mt-5 flex gap-2 text-[11px] leading-5 text-slate-600"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /><p>{result.limitations}</p></div><p className="mt-4 text-[10px] text-slate-700">Analyzed {result.framesAnalyzed} {result.framesAnalyzed === 1 ? "image" : "frames"} with {result.model}. No file retained by Verity.</p>
                </div>
              </div>
            </section>
          )}
          {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#ff8666]/20 bg-[#ff8666]/5 px-4 py-3 text-sm text-[#ffad98]"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</div>}
        </div>

        <section className="mx-auto mt-14 max-w-5xl border-t border-white/8 pt-12">
          <div className="text-center"><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#b8ff57]">Enhanced detection pipeline</p><h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Privacy first. Evidence fused. Claims bounded.</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">The MVP now combines useful local forensics with cloud visual reasoning while keeping production-only security capabilities clearly separated.</p></div>
          <div className="mt-8 grid gap-3 md:grid-cols-3"><div className="pipeline-column"><span><LockKeyhole /></span><div><p>Input ingestion</p><small>Browser privacy gate · image or sampled video</small></div></div><div className="pipeline-column"><span><Layers3 /></span><div><p>Multi-signal fusion</p><small>Local heuristics · visual reasoning · adaptive route</small></div></div><div className="pipeline-column"><span><ShieldCheck /></span><div><p>Verifiable evidence</p><small>Digest-bound receipt · limitations · next action</small></div></div></div>

          <div className="mt-9 flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Operational in this MVP</p><p className="mt-1 text-xs text-slate-600">Real checks that run during every scan.</p></div><span className="rounded-full border border-[#76d5aa]/20 bg-[#76d5aa]/5 px-2.5 py-1 text-[10px] font-semibold uppercase text-[#8ee6bd]">Available now</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="capability-card"><Cpu /><p>Edge privacy gate</p><small>Preparation, hashing, and lightweight signals stay in the browser.</small></div><div className="capability-card"><GitBranch /><p>Dynamic routing</p><small>Local conditions select a standard or enhanced evidence path.</small></div><div className="capability-card"><Hash /><p>Robust fingerprinting</p><small>SHA-256 receipt binding plus a perceptual dHash for similarity workflows.</small></div><div className="capability-card"><Gauge /><p>Explainable fusion</p><small>Signals, counter-evidence, confidence, and a human verification step.</small></div></div>

          <div className="mt-10 flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Production integration path</p><p className="mt-1 text-xs text-slate-600">Architecture targets, not capabilities claimed by this prototype.</p></div><span className="rounded-full border border-[#f5bd52]/20 bg-[#f5bd52]/5 px-2.5 py-1 text-[10px] font-semibold uppercase text-[#ffd37a]">Planned</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="future-card"><ScanSearch /><div><p>ONNX Runtime Web + WebGPU</p><small>Private landmark, blink, noise-frequency, and model-fingerprint inference at the edge.</small></div></div><div className="future-card"><KeyRound /><div><p>Signed C2PA + hardware trust</p><small>Full manifest validation with trusted capture keys, HSMs, and secure enclaves.</small></div></div><div className="future-card"><Braces /><div><p>TEE processing + zero-knowledge proofs</p><small>Confidential server execution and proofs of analysis without exposing media or model weights.</small></div></div><div className="future-card"><Network /><div><p>Federated threat graph</p><small>Differentially private learning and vector-signature search for coordinated campaigns.</small></div></div></div>

          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[.018] p-5"><DatabaseZap className="mt-0.5 size-5 shrink-0 text-slate-500" /><div><p className="text-sm font-medium">No immutable ledger claim yet</p><p className="mt-1 text-xs leading-5 text-slate-500">Each scan receives a digest-bound receipt, but it is not blockchain-anchored. Ledger timestamping should be added only with clear governance, retention, and threat-model requirements.</p></div></div>
        </section>
      </section>
    </main>
  );
}
