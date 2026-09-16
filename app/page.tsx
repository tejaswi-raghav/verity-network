"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Braces, Check, ChevronRight, CircleHelp, Code2, Eye, FileVideo, Fingerprint, Gauge, Globe2, History, Layers3, LockKeyhole, Menu, Radio, ScanFace, ShieldCheck, Sparkles, Upload, Users, Waves, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

const signals = [
  { icon: Fingerprint, label: "Model fingerprint", detail: "Diffusion residuals detected", value: 91, tone: "high" },
  { icon: ScanFace, label: "Biological signals", detail: "Inconsistent skin perfusion", value: 74, tone: "medium" },
  { icon: Waves, label: "Temporal coherence", detail: "Jawline drift across 12 frames", value: 86, tone: "high" },
  { icon: ShieldCheck, label: "Content provenance", detail: "No trusted C2PA signature", value: 62, tone: "medium" },
];
const bars = [22, 48, 37, 68, 53, 87, 73, 95, 76, 89, 66, 72, 42, 61, 35, 28, 51, 70, 84, 63, 31, 45, 24, 38];

export default function Home() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [fileName, setFileName] = useState("election-address.mp4");
  const [scanning, setScanning] = useState(false);
  const [copied, setCopied] = useState(false);

  const runScan = () => {
    setScanning(true);
    window.setTimeout(() => setScanning(false), 1600);
  };
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "start_media_verification",
      title: "Start media verification",
      description: "Start the visible synthetic-media scan for the current or named media file and return the displayed verdict.",
      inputSchema: { type: "object", properties: { fileName: { type: "string", minLength: 1, maxLength: 160 } }, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input: unknown) {
        const value = input as { fileName?: unknown };
        if (value.fileName !== undefined && typeof value.fileName !== "string") throw new Error("fileName must be a string");
        if (typeof value.fileName === "string") setFileName(value.fileName.trim());
        setScanning(true);
        await new Promise((resolve) => window.setTimeout(resolve, 1600));
        setScanning(false);
        return { verdict: "likely_synthetic", confidence: 0.87, evidenceLayers: 4, retention: "none" };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);
  const copyCode = async () => {
    await navigator.clipboard?.writeText(`curl -X POST https://api.verity.network/v1/analyze \\\n+  -H "Authorization: Bearer $VERITY_API_KEY" \\\n+  -F "media=@${fileName}"`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <main className="min-h-screen bg-[#070b0f] text-[#f3f7f6]">
      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-white/8 bg-[#070b0f]/90 px-4 backdrop-blur-xl md:px-6">
        <button aria-label="Open navigation" onClick={() => setMobileNav(true)} className="mr-3 rounded-lg p-2 text-slate-400 hover:bg-white/5 md:hidden"><Menu className="size-5" /></button>
        <a href="#workspace" className="flex items-center gap-2.5" aria-label="Verity home">
          <span className="grid size-8 place-items-center rounded-[10px] bg-[#b8ff57] text-[#071008] shadow-[0_0_25px_rgba(184,255,87,.18)]"><Fingerprint className="size-[18px]" strokeWidth={2.2} /></span>
          <span className="text-[15px] font-semibold tracking-tight">VERITY<span className="ml-1 text-slate-500">NETWORK</span></span>
        </a>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/[.03] px-3 py-1.5 text-xs text-slate-400 sm:flex"><span className="size-1.5 rounded-full bg-[#b8ff57] shadow-[0_0_8px_#b8ff57]" /> Global defense online</span>
          <button className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-white/20 hover:text-white" aria-label="Help"><CircleHelp className="size-[18px]" /></button>
          <button className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-xs font-semibold ring-1 ring-white/15">RM</button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        {mobileNav && <button aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={() => setMobileNav(false)} />}
        <aside className={`fixed inset-y-0 left-0 z-50 w-[246px] border-r border-white/8 bg-[#0a0f14] p-4 transition-transform md:sticky md:top-16 md:z-20 md:h-[calc(100vh-4rem)] md:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="mb-5 flex items-center justify-between md:hidden"><span className="text-sm font-semibold">Navigation</span><button onClick={() => setMobileNav(false)} aria-label="Close navigation" className="p-2 text-slate-400"><X className="size-5" /></button></div>
          <nav aria-label="Primary" className="space-y-1">
            <a className="nav-item nav-active" href="#workspace"><Gauge />Verify media</a>
            <a className="nav-item" href="#evidence"><Layers3 />Evidence layers</a>
            <a className="nav-item" href="#history"><History />Scan history</a>
            <a className="nav-item" href="#network"><Globe2 />Defense network</a>
          </nav>
          <p className="mb-2 mt-7 px-3 text-[11px] font-semibold uppercase tracking-[.15em] text-slate-600">Build with Verity</p>
          <nav className="space-y-1" aria-label="Developer">
            <a className="nav-item" href="#api"><Braces />API console</a>
            <a className="nav-item" href="#extension"><Sparkles />Browser extension</a>
          </nav>
          <div className="absolute inset-x-4 bottom-4 overflow-hidden rounded-2xl border border-[#b8ff57]/15 bg-[#b8ff57]/[.035] p-4">
            <div className="mb-3 flex items-center justify-between"><Radio className="size-4 text-[#b8ff57]" /><span className="text-[10px] font-semibold uppercase tracking-widest text-[#b8ff57]">Live network</span></div>
            <p className="text-2xl font-semibold tracking-tight">18.4M</p><p className="mt-1 text-xs text-slate-500">signatures compared today</p>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400"><Users className="size-3.5" /> 146 detection nodes</div>
          </div>
        </aside>

        <section id="workspace" className="min-w-0 flex-1 px-4 py-5 md:px-7 md:py-7 xl:px-9">
          <div className="mx-auto max-w-[1480px]">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[.13em] text-[#b8ff57]"><Activity className="size-3.5" /> Analysis workspace</div><h1 className="text-2xl font-semibold tracking-[-.03em] sm:text-[30px]">Synthetic media verification</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-400">Inspect what the model sees. Every verdict includes traceable evidence and provenance checks.</p></div>
              <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[.025] p-1.5 text-xs text-slate-400"><LockKeyhole className="ml-1.5 size-3.5 text-[#b8ff57]" /><span>Zero-retention analysis</span><span className="rounded-md bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500">Edge secured</span></div>
            </div>

            <Tabs defaultValue="verifier" className="gap-5">
              <TabsList className="h-10 w-full justify-start gap-1 rounded-xl border border-white/8 bg-[#0d1318] p-1 sm:w-fit">
                <TabsTrigger value="verifier" className="rounded-lg px-4 text-[13px] data-[state=active]:bg-[#1a2229] data-[state=active]:text-white"><Eye className="size-4" /> Visual verifier</TabsTrigger>
                <TabsTrigger value="api" className="rounded-lg px-4 text-[13px] data-[state=active]:bg-[#1a2229] data-[state=active]:text-white"><Code2 className="size-4" /> API console</TabsTrigger>
              </TabsList>

              <TabsContent value="verifier">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,.85fr)]">
                  <div className="space-y-5">
                    <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0c1217] shadow-[0_20px_70px_rgba(0,0,0,.22)]">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3.5 sm:px-5">
                        <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5"><FileVideo className="size-[17px] text-slate-300" /></span><div className="min-w-0"><p className="truncate text-sm font-medium">{fileName}</p><p className="mt-0.5 text-[11px] text-slate-500">00:42 · 1080p · 24 FPS</p></div></div>
                        <div className="flex gap-2"><input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,audio/*" onChange={(event) => event.target.files?.[0] && setFileName(event.target.files[0].name)} /><button onClick={() => fileRef.current?.click()} className="secondary-button"><Upload className="size-3.5" /> Replace</button><button onClick={runScan} className="primary-button"><ScanFace className={`size-3.5 ${scanning ? "animate-pulse" : ""}`} />{scanning ? "Scanning…" : "Run scan"}</button></div>
                      </div>
                      <div className="relative aspect-[16/9] min-h-[310px] overflow-hidden bg-[#05090c]">
                        <div className="absolute inset-0 media-grid opacity-50" />
                        <div className="absolute inset-x-[8%] top-[12%] bottom-[14%] rounded-[24px] border border-cyan-300/10 bg-[radial-gradient(circle_at_52%_40%,rgba(66,173,179,.19),transparent_24%),radial-gradient(circle_at_48%_58%,rgba(184,255,87,.10),transparent_33%),linear-gradient(135deg,#101b22,#071014_55%,#0b1719)] shadow-[inset_0_0_100px_rgba(0,0,0,.5)]">
                          <div className="absolute left-[23%] top-[17%] h-[62%] w-[43%] rounded-[48%_52%_46%_54%] border border-white/10 bg-[radial-gradient(circle_at_62%_34%,rgba(225,255,244,.25),transparent_8%),radial-gradient(circle_at_42%_34%,rgba(225,255,244,.18),transparent_8%),linear-gradient(108deg,rgba(108,148,149,.23),rgba(9,20,25,.12))] blur-[.2px]" />
                          <div className="absolute left-[35%] top-[25%] size-4 rounded-full border border-[#b8ff57]/70"><span className="absolute -inset-3 rounded-full border border-[#b8ff57]/15" /></div><div className="absolute left-[53%] top-[25%] size-4 rounded-full border border-[#b8ff57]/70"><span className="absolute -inset-3 rounded-full border border-[#b8ff57]/15" /></div>
                          <div className="absolute left-[43%] top-[55%] h-[1px] w-[14%] bg-[#ffbf66]/80 shadow-[0_0_9px_#ffbf66]" /><div className="absolute left-[17%] top-[40%] h-[1px] w-[66%] bg-cyan-300/40 shadow-[0_0_12px_rgba(103,232,249,.4)]" />
                          <div className="absolute bottom-4 left-4 rounded-md border border-white/10 bg-black/45 px-2 py-1 font-mono text-[10px] text-slate-300">FRAME 0648 / FACE REGION 01</div><div className="absolute right-4 top-4 rounded-md border border-[#ff8666]/30 bg-[#ff8666]/10 px-2 py-1 text-[10px] font-semibold tracking-wider text-[#ff9c82]">TEMPORAL DRIFT</div>
                        </div>
                        <div className="absolute inset-x-4 bottom-3 flex h-9 items-end gap-[3px] rounded-lg bg-black/50 px-3 py-2 backdrop-blur-sm" aria-label="Audio anomaly waveform">{bars.map((height, i) => <span key={i} className={`flex-1 rounded-t-sm ${i > 5 && i < 14 ? "bg-[#ff9b72]" : "bg-cyan-300/55"}`} style={{ height: `${Math.max(18, height)}%` }} />)}<span className="absolute right-3 top-1.5 text-[9px] font-medium uppercase tracking-widest text-slate-500">audio sync</span></div>
                        {scanning && <div className="scan-line absolute inset-x-0 top-0 h-px bg-[#b8ff57] shadow-[0_0_18px_#b8ff57]" />}
                      </div>
                    </section>

                    <section id="evidence" className="rounded-[20px] border border-white/8 bg-[#0c1217] p-4 sm:p-5">
                      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-[15px] font-semibold">Forensic evidence layers</h2><p className="mt-1 text-xs text-slate-500">Independent signals contributing to this result</p></div><span className="hidden text-xs text-slate-500 sm:block">4 / 4 checks complete</span></div>
                      <div className="grid gap-3 md:grid-cols-2">{signals.map((signal) => <article key={signal.label} className="evidence-card"><div className="flex items-start gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-lg ${signal.tone === "high" ? "bg-[#ff8666]/10 text-[#ff9c82]" : "bg-[#ffc85f]/10 text-[#ffd177]"}`}><signal.icon className="size-[17px]" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">{signal.label}</h3><span className="font-mono text-xs text-slate-300">{signal.value}%</span></div><p className="mt-1 text-xs text-slate-500">{signal.detail}</p><Progress value={signal.value} className={`mt-3 h-1 ${signal.tone === "high" ? "[&_[data-slot=progress-indicator]]:bg-[#ff8666]" : "[&_[data-slot=progress-indicator]]:bg-[#ffc85f]"}`} /></div></div></article>)}</div>
                    </section>
                  </div>

                  <aside className="space-y-5">
                    <section className="relative overflow-hidden rounded-[22px] border border-[#ff8666]/20 bg-[linear-gradient(145deg,rgba(255,134,102,.09),rgba(12,18,23,.9)_55%)] p-5 sm:p-6">
                      <div className="absolute -right-8 -top-8 size-40 rounded-full bg-[#ff8666]/5 blur-2xl" /><div className="relative flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.13em] text-[#ff9c82]"><AlertTriangle className="size-4" /> Likely synthetic</span><span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] text-slate-400">High confidence</span></div>
                      <div className="relative my-7 flex items-end gap-3"><span className="text-[68px] font-semibold leading-none tracking-[-.075em] text-white">87</span><div className="pb-1"><span className="text-xl text-slate-400">%</span><p className="mt-1 text-[11px] text-slate-500">synthetic probability</p></div></div>
                      <div className="relative mb-6 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full w-[87%] rounded-full bg-gradient-to-r from-[#ffc85f] to-[#ff755b] shadow-[0_0_18px_rgba(255,117,91,.45)]" /></div>
                      <div className="relative space-y-3 border-t border-white/8 pt-5"><div className="result-row"><span>Visual manipulation</span><strong>Detected</strong></div><div className="result-row"><span>Audio cloning</span><strong>Probable</strong></div><div className="result-row"><span>Trusted provenance</span><strong className="muted">Absent</strong></div></div>
                    </section>
                    <section className="rounded-[20px] border border-white/8 bg-[#0c1217] p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Why it was flagged</h2><button className="text-[11px] font-medium text-[#b8ff57] hover:underline">Full report</button></div><ol className="space-y-4"><li className="insight-item"><span>01</span><div><p>Diffusion fingerprint cluster</p><small>Noise residuals match 3 known video model families.</small></div></li><li className="insight-item"><span>02</span><div><p>Face boundary instability</p><small>Lighting shifts independently from the background.</small></div></li><li className="insight-item"><span>03</span><div><p>Unverified origin</p><small>No camera signature or C2PA assertion was found.</small></div></li></ol></section>
                    <section id="extension" className="group rounded-[20px] border border-[#b8ff57]/15 bg-[#b8ff57]/[.035] p-5 transition hover:border-[#b8ff57]/25"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#b8ff57] text-[#071008]"><ShieldCheck className="size-5" /></span><div><h2 className="text-sm font-semibold">Verify while you browse</h2><p className="mt-1 text-xs leading-5 text-slate-400">The lightweight extension checks media locally and reveals this evidence panel in context.</p><button className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#b8ff57]">Get the extension <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" /></button></div></div></section>
                  </aside>
                </div>
              </TabsContent>

              <TabsContent value="api" id="api">
                <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
                  <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0c1217]"><div className="flex items-center justify-between border-b border-white/8 px-5 py-4"><div><h2 className="text-[15px] font-semibold">Analyze media via REST API</h2><p className="mt-1 text-xs text-slate-500">Zero-retention is enabled by default.</p></div><span className="rounded-md bg-[#b8ff57]/10 px-2 py-1 font-mono text-[10px] text-[#b8ff57]">POST /v1/analyze</span></div>
                    <div className="relative m-4 overflow-auto rounded-xl border border-white/8 bg-[#05080b] p-5 font-mono text-[13px] leading-7 text-slate-300 sm:m-5"><button onClick={copyCode} className="absolute right-3 top-3 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-400 hover:text-white">{copied ? "Copied" : "Copy"}</button><span className="text-[#b8ff57]">curl</span> -X POST https://api.verity.network/v1/analyze \<br /><span className="pl-4 text-cyan-300">-H</span> <span className="text-[#ffd177]">&quot;Authorization: Bearer $VERITY_API_KEY&quot;</span> \<br /><span className="pl-4 text-cyan-300">-F</span> <span className="text-[#ffd177]">&quot;media=@{fileName}&quot;</span></div>
                    <div className="border-t border-white/8 p-5"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Example response</p><pre className="overflow-auto text-[12px] leading-6 text-slate-400">{`{
  "verdict": "likely_synthetic",
  "confidence": 0.87,
  "signals": ["diffusion_fingerprint", "temporal_drift"],
  "provenance": { "c2pa": false },
  "retention": "none"
}`}</pre></div></section>
                  <div className="space-y-5"><section className="rounded-[22px] border border-white/8 bg-[#0c1217] p-5"><h2 className="text-sm font-semibold">Pipeline status</h2><div className="mt-5 grid grid-cols-2 gap-3"><div className="metric-card"><small>p95 latency</small><strong>1.8s</strong></div><div className="metric-card"><small>uptime</small><strong>99.98%</strong></div><div className="metric-card"><small>scans today</small><strong>248k</strong></div><div className="metric-card"><small>regions</small><strong>12</strong></div></div></section><section className="rounded-[22px] border border-white/8 bg-[#0c1217] p-5"><h2 className="text-sm font-semibold">Integration flow</h2><div className="mt-5 space-y-3"><div className="flow-step"><span>1</span><p>Submit image, audio, or video</p><Check /></div><div className="flow-step"><span>2</span><p>Run ensemble forensic checks</p><Check /></div><div className="flow-step"><span>3</span><p>Receive explainable evidence JSON</p><Check /></div></div><button className="primary-button mt-5 w-full justify-center">Open API documentation <ChevronRight className="size-3.5" /></button></section></div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </div>
    </main>
  );
}
