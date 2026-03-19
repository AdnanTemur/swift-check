"use strict";

const $ = (id) => document.getElementById(id);

const ui = {
  dot: $("dot"),
  statusText: $("statusText"),
  lastTested: $("lastTested"),
  dialArc: $("dialArc"),
  dialTrack: $("dialTrack"),
  needle: $("needle"),
  needleLine: $("needleLine"),
  needlePoly: $("needlePoly"),
  pivotGlow: $("pivotGlow"),
  pivotDot: $("pivotDot"),
  speedVal: $("speedVal"),
  phaseLabel: $("phaseLabel"),
  valPing: $("valPing"),
  valDl: $("valDl"),
  valUl: $("valUl"),
  cardPing: $("cardPing"),
  cardDl: $("cardDl"),
  cardUl: $("cardUl"),
  progressPhase: $("progressPhase"),
  progressPct: $("progressPct"),
  barFill: $("barFill"),
  ratingLabel: $("ratingLabel"),
  ratingBadge: $("ratingBadge"),
  startBtn: $("startBtn"),
  btnText: $("btnText"),
  themeBtn: $("themeBtn"),
  themeEmoji: $("themeEmoji"),
};

// ─── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(light) {
  if (light) {
    document.documentElement.classList.add("light");
    ui.themeEmoji.textContent = "☀️";
    ui.dialTrack.style.stroke = "rgba(0,0,0,0.07)";
    ui.needleLine.style.stroke = "rgba(3,60,30,0.85)";
    ui.needlePoly.setAttribute("fill", "rgba(3,60,30,0.65)");
    ui.pivotGlow.style.fill = "rgba(5,150,105,0.22)";
    ui.pivotDot.style.fill = "#059669";
  } else {
    document.documentElement.classList.remove("light");
    ui.themeEmoji.textContent = "🌙";
    ui.dialTrack.style.stroke = "rgba(255,255,255,0.07)";
    ui.needleLine.style.stroke = "rgba(255,255,255,0.92)";
    ui.needlePoly.setAttribute("fill", "white");
    ui.pivotGlow.style.fill = "rgba(74,222,128,0.28)";
    ui.pivotDot.style.fill = "#4ade80";
  }
}

chrome.storage.local.get(["theme"], (res) => applyTheme(res.theme === "light"));
ui.themeBtn.addEventListener("click", () => {
  const isLight = document.documentElement.classList.contains("light");
  applyTheme(!isLight);
  chrome.storage.local.set({ theme: isLight ? "dark" : "light" });
});

// ─── Dial — dynamic linear scale ──────────────────────────────────────────────
const ARC_LEN = 314;
let dialCeiling = 10; // set after probe, reset on each new test

function pickCeiling(probedMbs) {
  const raw = probedMbs * 2;
  for (const s of [1, 2, 3, 5, 8, 10, 15, 20, 30, 50, 75, 100, 125, 200]) {
    if (s >= raw) return s;
  }
  return 200;
}

function fmtCeil(v) {
  return v >= 10 ? v.toFixed(0) : v.toFixed(1);
}

function setCeiling(mbs) {
  dialCeiling = mbs;
  // Redraw ticks for new scale
  const tg = $("ticks"),
    lg = $("scaleLabels");
  while (tg.firstChild) tg.removeChild(tg.firstChild);
  while (lg.firstChild) lg.removeChild(lg.firstChild);
  drawTicks();
  const el = $("dialMaxLabel");
  if (el) el.textContent = "MAX " + fmtCeil(mbs) + " MB/s";
}

// Linear ratio within ceiling — equal spacing, full needle travel
function mbsToRatio(mbs) {
  if (mbs <= 0) return 0;
  return Math.min(mbs / dialCeiling, 1);
}

function setDial(mbs) {
  // Use direct setter — jitter engine handles live updates during test
  const ratio = Math.min(Math.max(mbs / dialCeiling, 0), 1);
  ui.dialArc.style.strokeDashoffset = ARC_LEN - ratio * ARC_LEN;
  ui.needle.setAttribute("transform", `rotate(${-90 + ratio * 180} 114 114)`);
  ui.speedVal.textContent = mbs <= 0 ? "—" : fmtMbs(mbs);
}

function resetDial() {
  if (jitter.running) {
    jitter.running = false;
    if (jitter.rafId) cancelAnimationFrame(jitter.rafId);
  }
  jitter.target = 0;
  jitter.displayed = 0;
  jitter.running = false;
  // Restore transitions for the reset sweep
  ui.needle.style.transition = "transform 0.5s cubic-bezier(0.34,1.25,0.64,1)";
  ui.dialArc.style.transition =
    "stroke-dashoffset 0.45s cubic-bezier(0.4,0,0.2,1)";
  dialCeiling = 10;
  ui.dialArc.style.strokeDashoffset = ARC_LEN;
  ui.needle.setAttribute("transform", "rotate(-90 114 114)");
  ui.speedVal.textContent = "—";
  const el = $("dialMaxLabel");
  if (el) el.textContent = "";
}

function fmtMbs(mbs) {
  if (mbs >= 100) return mbs.toFixed(0);
  if (mbs >= 10) return mbs.toFixed(1);
  return mbs.toFixed(2);
}

function drawTicks() {
  const tg = $("ticks"),
    lg = $("scaleLabels");
  const cx = 114,
    cy = 114,
    r = 100;
  // 5 evenly spaced ticks from 0 to ceiling
  for (let i = 0; i <= 5; i++) {
    const v = (dialCeiling / 5) * i;
    const ratio = mbsToRatio(v);
    const rad = ((-180 + ratio * 180) * Math.PI) / 180;

    const ns = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ns.setAttribute("x1", cx + (r - 13) * Math.cos(rad));
    ns.setAttribute("y1", cy + (r - 13) * Math.sin(rad));
    ns.setAttribute("x2", cx + (r - 3) * Math.cos(rad));
    ns.setAttribute("y2", cy + (r - 3) * Math.sin(rad));
    ns.setAttribute("stroke", "rgba(255,255,255,0.45)");
    ns.setAttribute("stroke-width", "1.5");
    ns.setAttribute("stroke-linecap", "round");
    tg.appendChild(ns);

    const tx = document.createElementNS("http://www.w3.org/2000/svg", "text");
    tx.setAttribute("x", cx + (r - 26) * Math.cos(rad));
    tx.setAttribute("y", cy + (r - 26) * Math.sin(rad) + 3);
    tx.setAttribute("text-anchor", "middle");
    tx.setAttribute("fill", "rgba(255,255,255,0.38)");
    tx.setAttribute("font-size", "6.5");
    tx.setAttribute("font-family", "JetBrains Mono,monospace");
    tx.textContent = fmtCeil(v);
    lg.appendChild(tx);
  }
}

// ─── Live needle jitter engine ───────────────────────────────────────────────
// While a test is running, the needle fluctuates around the live reading
// using smooth Perlin-style noise — exactly like a real analog meter reacting
// to line variance. The number display updates on a slower 300ms interval
// so it's readable while the needle moves freely.

let jitter = {
  running: false,
  target: 0, // current real MB/s reading
  displayed: 0, // smoothed value for needle position
  rafId: null,
  lastNumUpdate: 0,
};

// Simple smooth noise: sum of two sine waves at irrational frequencies
function noiseAt(t) {
  return (
    Math.sin(t * 1.7) * 0.5 + Math.sin(t * 2.9) * 0.3 + Math.sin(t * 5.1) * 0.2
  );
}

function startJitter() {
  if (jitter.running) return;
  jitter.running = true;
  jitter.displayed = jitter.target;
  // Disable CSS transition — jitter loop drives the needle directly
  ui.needle.style.transition = "none";
  ui.dialArc.style.transition = "none";

  const startTime = performance.now();

  function frame(now) {
    if (!jitter.running) return;

    const t = (now - startTime) / 1000; // seconds elapsed

    // Wobble amplitude scales with speed — faster = more variance
    // At 0 speed: tiny flicker. At ceiling: ~8% swing.
    const amplitude = Math.max(dialCeiling * 0.06, 0.05);
    const wobble = noiseAt(t * 2.2) * amplitude;

    // Smooth displayed value toward target + wobble
    // lerp factor: fast approach, slow micro-adjustments
    const lerpSpeed = 0.08;
    jitter.displayed += (jitter.target + wobble - jitter.displayed) * lerpSpeed;
    const clamped = Math.max(0, Math.min(jitter.displayed, dialCeiling * 1.02));

    // Move needle and arc directly
    const ratio = Math.min(clamped / dialCeiling, 1);
    const offset = ARC_LEN - ratio * ARC_LEN;
    const angle = -90 + ratio * 180;
    ui.dialArc.style.strokeDashoffset = offset;
    ui.needle.setAttribute("transform", `rotate(${angle} 114 114)`);

    // Update number display at a calmer pace (every 300ms)
    if (now - jitter.lastNumUpdate > 300) {
      jitter.lastNumUpdate = now;
      ui.speedVal.textContent =
        jitter.target <= 0 ? "—" : fmtMbs(jitter.target);
    }

    jitter.rafId = requestAnimationFrame(frame);
  }

  jitter.rafId = requestAnimationFrame(frame);
}

function stopJitter(finalMbs) {
  jitter.running = false;
  if (jitter.rafId) {
    cancelAnimationFrame(jitter.rafId);
    jitter.rafId = null;
  }
  // Restore smooth CSS transition for the settle animation
  ui.needle.style.transition = "transform 0.6s cubic-bezier(0.34,1.1,0.64,1)";
  ui.dialArc.style.transition =
    "stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)";
  // Settle to final value
  setDialDirect(finalMbs);
  ui.speedVal.textContent = finalMbs <= 0 ? "—" : fmtMbs(finalMbs);
}

// Update jitter target without touching the needle (jitter loop handles that)
function setDialLive(mbs) {
  jitter.target = mbs;
}

// Direct dial set (used when jitter is stopped)
function setDialDirect(mbs) {
  const ratio = Math.min(Math.max(mbs / dialCeiling, 0), 1);
  ui.dialArc.style.strokeDashoffset = ARC_LEN - ratio * ARC_LEN;
  ui.needle.setAttribute("transform", `rotate(${-90 + ratio * 180} 114 114)`);
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function setStatus(state, text) {
  ui.dot.className = `dot ${state}`;
  ui.statusText.textContent = text;
}

function setProgress(phase, pct) {
  ui.progressPhase.textContent = phase;
  ui.progressPct.textContent = `${Math.round(pct)}%`;
  ui.barFill.style.width = `${pct}%`;
}

function setPhase(t) {
  ui.phaseLabel.textContent = t;
}

function highlightCard(id) {
  ["cardPing", "cardDl", "cardUl"].forEach((k) =>
    ui[k].classList.remove("active"),
  );
  if (id) ui[id].classList.add("active");
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Core measurement using PerformanceResourceTiming ─────────────────────────
//
// The browser's networking stack records precise transfer timing for every
// fetch at the OS/hardware level — not in JS. We read:
//
//   responseStart  = time first byte arrived at the NIC
//   responseEnd    = time last byte arrived at the NIC
//   transferSize   = actual compressed bytes over the wire
//
// This gives us pure wire throughput, unaffected by JS execution overhead,
// GC pauses, or setTimeout drift.
//
// Strategy:
//   1. One warmup fetch (1KB) — opens TCP+TLS connection, paid once
//   2. One probe fetch (256KB) — measures real speed, sizes the main fetch
//   3. One main fetch — sized to take ~3 seconds at measured speed
//   4. Read PerformanceResourceTiming for all three — use main fetch result
//
// Total: 3 fetches, ~5-8 seconds on slow lines, ~3s on fast lines.

const BASE = "https://speed.cloudflare.com/__down";

function getTimingMbs(url) {
  // Find the timing entry for this exact URL
  const entries = performance.getEntriesByName(url, "resource");
  if (!entries.length) return null;
  const e = entries[entries.length - 1]; // most recent

  // transferSize = bytes on the wire (compressed). Use encodedBodySize as fallback.
  const bytes = e.transferSize > 0 ? e.transferSize : e.encodedBodySize;
  if (!bytes || bytes < 100) return null;

  // responseStart→responseEnd = pure transfer window measured by browser network stack
  const transferMs = e.responseEnd - e.responseStart;
  if (transferMs < 10) return null; // too short to be meaningful

  return bytes / (transferMs / 1000) / 1_000_000; // MB/s
}

async function fetchSized(bytes, label) {
  const url = `${BASE}?bytes=${bytes}&_r=${Date.now()}`;
  // Clear any prior entry for this URL pattern
  performance.clearResourceTimings();
  const t0 = performance.now();
  const resp = await fetch(url, { cache: "no-store" });
  await resp.arrayBuffer(); // fully consume body so responseEnd is recorded
  const wallMs = performance.now() - t0;

  // Prefer hardware-level timing, fall back to JS wall clock
  const hwMbs = getTimingMbs(url);
  const wallMbs = bytes / (wallMs / 1000) / 1_000_000;

  return { mbs: hwMbs ?? wallMbs, wallMs, bytes };
}

async function measurePing() {
  const url = `${BASE}?bytes=1`;
  const times = [];
  for (let i = 0; i < 8; i++) {
    const t0 = performance.now();
    try {
      await fetch(`${url}&_r=${Date.now()}${i}`, { cache: "no-store" });
    } catch (_) {}
    times.push(performance.now() - t0);
    await delay(40);
  }
  times.sort((a, b) => a - b);
  // Median of middle 4 (drop 2 slowest, drop 2 fastest outliers)
  return Math.round(times.slice(2, 6).reduce((s, v) => s + v, 0) / 4);
}

async function measureDownload(onProgress) {
  // Step 1: warmup — open connection, don't time this
  setPhase("OPENING CONNECTION…");
  await fetchSized(1_000, "warmup");
  onProgress(0, 10);

  // Step 2: probe — 256KB to estimate speed
  setPhase("PROBING SPEED…");
  const probe = await fetchSized(256_000, "probe");
  const estimatedMbs = probe.mbs;
  onProgress(estimatedMbs, 35);

  // Set dynamic dial ceiling from probe result
  const ceiling = pickCeiling(estimatedMbs);
  setCeiling(ceiling);

  // Step 3: main fetch — target ~3 seconds of transfer at estimated speed
  const targetBytes = Math.min(
    Math.max(Math.round(estimatedMbs * 3 * 1_000_000), 512_000),
    8_000_000,
  );
  const sizeMb = (targetBytes / 1_000_000).toFixed(1);
  setPhase(`DOWNLOADING ${sizeMb} MB…`);
  const main = await fetchSized(targetBytes, "main");
  onProgress(main.mbs, 68);

  // Step 4: one confirmation fetch at same size
  setPhase("CONFIRMING…");
  const confirm = await fetchSized(targetBytes, "confirm");
  onProgress(confirm.mbs, 100);

  // Return median of probe + main + confirm
  return median([probe.mbs, main.mbs, confirm.mbs]);
}

async function measureUpload(onProgress) {
  // Upload: PerformanceResourceTiming doesn't give transferSize for POST bodies
  // so we use wall clock, but with a warm connection and small payload for speed

  // Warmup already done in download phase — connection is open
  const chunks = [
    { bytes: 200_000, label: "200 KB" },
    { bytes: 500_000, label: "500 KB" },
    { bytes: 1_000_000, label: "1 MB" },
  ];
  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    const { bytes, label } = chunks[i];
    try {
      const payload = makePayload(bytes);
      const t0 = performance.now();
      await fetch("https://speed.cloudflare.com/__up", {
        method: "POST",
        body: payload,
        headers: { "Content-Type": "application/octet-stream" },
        cache: "no-store",
      });
      const secs = (performance.now() - t0) / 1000;
      results.push(bytes / secs / 1_000_000);
      onProgress(median(results), label, (i + 1) / chunks.length);
    } catch (e) {
      console.warn("UL", e);
    }
  }
  return results.length ? median(results) : 0;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function makePayload(bytes) {
  const buf = new Uint8Array(bytes);
  const rand = new Uint8Array(Math.min(bytes, 65536));
  crypto.getRandomValues(rand);
  for (let i = 0; i < bytes; i++) buf[i] = rand[i % rand.length];
  return buf;
}

function rateConnection(ping, dl, ul) {
  // Thresholds in MB/s. 1.25 MB/s = 10 Mbps.
  let s = 0;
  if (dl > 12.5) s += 3;
  else if (dl > 3.1) s += 2;
  else if (dl > 0.6) s += 1;
  if (ul > 6.25) s += 3;
  else if (ul > 1.25) s += 2;
  else if (ul > 0.25) s += 1;
  if (ping < 20) s += 3;
  else if (ping < 60) s += 2;
  else if (ping < 120) s += 1;
  if (s >= 8) return { label: "EXCELLENT", cls: "excellent" };
  if (s >= 5) return { label: "GOOD", cls: "good" };
  if (s >= 3) return { label: "FAIR", cls: "fair" };
  return { label: "POOR", cls: "poor" };
}

// ─── Persist ──────────────────────────────────────────────────────────────────
function saveResult(d) {
  chrome.storage.local.set({ lastResult: d });
}
function loadResult() {
  return new Promise((r) =>
    chrome.storage.local.get(["lastResult"], (d) => r(d.lastResult || null)),
  );
}

function fmtAge(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function restoreResult(r) {
  if (!r) return;
  ui.valPing.textContent = r.ping;
  ui.valDl.textContent = r.dl;
  ui.valUl.textContent = r.ul;
  setDial(parseFloat(r.dl));
  setPhase(`↓ ${r.dl}  ↑ ${r.ul}  ⚡ ${r.ping}ms`);
  setStatus("done", "DONE");
  setProgress("COMPLETE", 100);
  ui.ratingBadge.textContent = r.rating.label;
  ui.ratingBadge.className = `rating-badge show ${r.rating.cls}`;
  ui.ratingLabel.style.opacity = "1";
  ui.btnText.textContent = "↺ Test Again";
  ui.lastTested.textContent = `Last tested ${fmtAge(r.ts)}`;
}

// ─── Main test ────────────────────────────────────────────────────────────────
let running = false;

async function runTest() {
  if (running) return;
  running = true;

  ui.startBtn.disabled = true;
  ui.btnText.textContent = "⏳ Testing…";
  ui.ratingBadge.className = "rating-badge";
  ui.ratingLabel.style.opacity = "0";
  ui.valPing.textContent = "—";
  ui.valDl.textContent = "—";
  ui.valUl.textContent = "—";
  ui.lastTested.textContent = "";
  highlightCard(null);
  resetDial();
  setProgress("STARTING", 0);
  setStatus("running", "TESTING");

  let ping = 0,
    dl = 0,
    ul = 0;

  try {
    // Ping
    setPhase("MEASURING LATENCY");
    highlightCard("cardPing");
    setProgress("PING", 5);
    ping = await measurePing();
    ui.valPing.textContent = ping;
    setProgress("PING DONE", 15);
    await delay(150);

    // Download — adaptive, uses hardware timing
    highlightCard("cardDl");
    dl = await measureDownload((live, pct) => {
      if (live > 0) {
        // First live reading: start jitter engine
        if (!jitter.running) startJitter();
        setDialLive(live);
        ui.valDl.textContent = fmtMbs(live);
      }
      setProgress("DOWNLOAD", 15 + pct * 0.53);
    });
    // Settle needle to final download value
    stopJitter(dl);
    ui.valDl.textContent = fmtMbs(dl);
    setProgress("DOWNLOAD DONE", 68);
    await delay(400);

    // Upload — restart jitter for upload phase
    jitter.target = 0;
    startJitter();
    setPhase("UPLOAD TEST");
    highlightCard("cardUl");
    ul = await measureUpload((live, label, frac) => {
      setDialLive(live);
      ui.valUl.textContent = fmtMbs(live);
      setProgress(`↑ ${label}`, 68 + frac * 28);
      setPhase(`UPLOADING · ${label}`);
    });
    // Settle to final upload value, then snap back to show download on dial
    stopJitter(ul);
    ui.valUl.textContent = fmtMbs(ul);
    await delay(400);
    setDial(dl);
    setProgress("COMPLETE", 100);

    await delay(150);
    const rating = rateConnection(ping, dl, ul);
    ui.ratingBadge.textContent = rating.label;
    ui.ratingBadge.className = `rating-badge show ${rating.cls}`;
    ui.ratingLabel.style.opacity = "1";
    highlightCard(null);
    setPhase(`↓ ${fmtMbs(dl)} MB/s  ↑ ${fmtMbs(ul)} MB/s  ⚡ ${ping}ms`);
    setStatus("done", "DONE");

    saveResult({
      ping,
      dl: fmtMbs(dl),
      ul: fmtMbs(ul),
      rating,
      ts: Date.now(),
    });
    ui.lastTested.textContent = "Just now";
  } catch (err) {
    setPhase("ERROR — CHECK CONNECTION");
    setStatus("error", "ERROR");
    console.error(err);
  }

  ui.startBtn.disabled = false;
  ui.btnText.textContent = "↺ Test Again";
  running = false;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
drawTicks();
loadResult().then((r) => {
  if (r) restoreResult(r);
});
ui.startBtn.addEventListener("click", runTest);
