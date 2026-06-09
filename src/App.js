// Warfarin Maintenance Dose-Adjustment Calculator — single-file React component.
// SOURCE: KSUMC Anticoagulation Clinic Guideline (March 2022), §4.2. Educational only — NOT for clinical use.
import React, { useState, useMemo } from "react";

const WF_UI_CSS = `html,body,#root{background:#f5f7f8;}body{margin:0;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;color:#0f1f2e;}::selection{background:rgba(14,116,144,0.18);}*{box-sizing:border-box;}button{font-family:inherit;}input::placeholder{color:#aab6c0;}select{font-family:'Inter',system-ui,sans-serif;}select:focus{outline:none;border-color:#0e7490;box-shadow:0 0 0 3px rgba(14,116,144,0.14);}::-webkit-scrollbar{width:11px;height:11px;}::-webkit-scrollbar-thumb{background:#cdd6dd;border-radius:999px;border:3px solid #f5f7f8;}::-webkit-scrollbar-thumb:hover{background:#aab6c0;}[class~="flex"]{display:flex !important;}[class~="grid"]{display:grid !important;}[class~="flex-wrap"]{flex-wrap:wrap !important;}[class~="items-baseline"]{align-items:baseline !important;}[class~="items-center"]{align-items:center !important;}[class~="items-end"]{align-items:flex-end !important;}[class~="items-start"]{align-items:flex-start !important;}[class~="justify-between"]{justify-content:space-between !important;}[class~="justify-center"]{justify-content:center !important;}[class~="gap-1.5"]{gap:6px !important;}[class~="gap-2"]{gap:8px !important;}[class~="gap-3"]{gap:12px !important;}[class~="mb-2"]{margin-bottom:8px !important;}[class~="mb-3"]{margin-bottom:12px !important;}[class~="mb-4"]{margin-bottom:16px !important;}[class~="mb-5"]{margin-bottom:20px !important;}[class~="mt-3"]{margin-top:12px !important;}[class~="mt-4"]{margin-top:16px !important;}[class~="pt-3"]{padding-top:12px !important;}[class~="p-4"]{padding:16px !important;}[class~="px-2"]{padding-left:8px !important;padding-right:8px !important;}[class~="px-2.5"]{padding-left:10px !important;padding-right:10px !important;}[class~="px-3"]{padding-left:12px !important;padding-right:12px !important;}[class~="px-4"]{padding-left:16px !important;padding-right:16px !important;}[class~="py-1"]{padding-top:4px !important;padding-bottom:4px !important;}[class~="py-2"]{padding-top:8px !important;padding-bottom:8px !important;}[class~="py-2.5"]{padding-top:10px !important;padding-bottom:10px !important;}[class~="py-3"]{padding-top:12px !important;padding-bottom:12px !important;}[class~="overflow-hidden"]{overflow:hidden !important;}[class~="relative"]{position:relative !important;}[class~="rounded-md"]{border-radius:8px !important;}[class~="rounded-lg"]{border-radius:11px !important;}[class~="rounded-xl"]{border-radius:14px !important;}[class~="transition-colors"]{transition:background-color .15s,border-color .15s,color .15s !important;}[class~="w-full"]{width:100% !important;}`;

// --- UI: font + base style injection (presentation only; no clinical content) ---
if (typeof document !== "undefined") {
  if (!document.getElementById("wf-ui-fonts")) {
    const l = document.createElement("link");
    l.id = "wf-ui-fonts";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(l);
  }
  let st = document.getElementById("wf-ui-style");
  if (!st) { st = document.createElement("style"); st.id = "wf-ui-style"; document.head.appendChild(st); }
  st.textContent = WF_UI_CSS;
}


const CONFIG = {
  status: "pending-signoff",
  guideline: {
    name: "KSUMC Anticoagulation Clinic Guideline — Practice Guide (March 2022), \u00a74.2 (nomograms adapted from Hadlock 2018)",
    note: "Transcribed from PPC-approved protocol. Verify this transcription against the PDF, then a clinician signs off the tool before status:'verified'.",
  },
  indications: [
    { label: "Atrial fibrillation", lo: 2.0, hi: 3.0 },
    { label: "VTE (DVT / PE)", lo: 2.0, hi: 3.0 },
    { label: "Mechanical aortic valve", lo: 2.0, hi: 3.0 },
    { label: "Mechanical mitral valve", lo: 2.5, hi: 3.5 },
    { label: "Bioprosthetic valve", lo: 2.0, hi: 3.0 },
    { label: "Antiphospholipid syndrome", lo: 2.0, hi: 3.0 },
    { label: "Other", lo: 2.0, hi: 3.0 },
  ],
  tablets: [1, 2, 2.5, 5],
  allowHalves: true,
  limits: { inrMin: 0.8, inrMax: 15, weeklyMax: 200 },
  nomogram: [
    { id: "S1", regLo: -Infinity, highLo: -Infinity, dir: "increase", pctMin: 10, pctMax: 20, conditionalNoChange: false, supplemental: true, holdOneDose: false, holdUntilTherapeutic: false, bridge: "mvr", vitK: null, level: "none", label: "Subtherapeutic (markedly low)", action: "Increase weekly maintenance dose by 10\u201320%. Consider a one-time supplemental dose (1.5\u20132\u00d7 the daily maintenance dose). For mechanical valve replacement, consider LMWH bridging for 3\u20135 days (see bridging)." },
    { id: "S2", regLo: 1.5, highLo: 2.0, dir: "increase", pctMin: 5, pctMax: 15, conditionalNoChange: false, supplemental: true, holdOneDose: false, holdUntilTherapeutic: false, bridge: "mvr-or-vte", vitK: null, level: "none", label: "Subtherapeutic", action: "Increase weekly maintenance dose by 5\u201315%. Consider a one-time supplemental dose (1.5\u20132\u00d7 the daily maintenance dose). Consider LMWH bridging for 3\u20135 days for mechanical valve, recent VTE, or prior VTE on warfarin (see bridging)." },
    { id: "S3", regLo: 1.8, highLo: 2.3, dir: "increase", pctMin: 5, pctMax: 10, conditionalNoChange: true, supplemental: true, holdOneDose: false, holdUntilTherapeutic: false, bridge: null, vitK: null, level: "none", label: "Marginally subtherapeutic", action: "No adjustment necessary if the last 2 INRs were in range, there is no clear explanation, and clinician judgment finds no increased thromboembolic risk (consider additional monitoring). If adjustment is needed, increase weekly maintenance dose by 5\u201310%. Consider a one-time supplemental dose (1.5\u20132\u00d7 the daily maintenance dose)." },
    { id: "R", regLo: 2.0, highLo: 2.5, dir: "none", pctMin: 0, pctMax: 0, conditionalNoChange: false, supplemental: false, holdOneDose: false, holdUntilTherapeutic: false, bridge: null, vitK: null, level: "none", label: "In therapeutic range", action: "INR within therapeutic range \u2014 no dose adjustment needed." },
    { id: "P1", regLo: 3.1, highLo: 3.6, dir: "decrease", pctMin: 5, pctMax: 10, conditionalNoChange: true, supplemental: false, holdOneDose: false, holdUntilTherapeutic: false, bridge: null, vitK: null, level: "none", label: "Marginally supratherapeutic", action: "No adjustment needed if the last 2 INRs were in range, there is no clear explanation, and clinician judgment finds no increased hemorrhage risk (consider additional monitoring). If adjustment is needed, decrease weekly maintenance dose by 5\u201310%." },
    { id: "P2", regLo: 3.3, highLo: 3.8, dir: "decrease", pctMin: 5, pctMax: 10, conditionalNoChange: false, supplemental: false, holdOneDose: false, holdUntilTherapeutic: false, bridge: null, vitK: null, level: "none", label: "Supratherapeutic", action: "Decrease weekly maintenance dose by 5\u201310%." },
    { id: "P3", regLo: 3.5, highLo: 4.0, dir: "decrease", pctMin: 5, pctMax: 15, conditionalNoChange: false, supplemental: false, holdOneDose: true, holdUntilTherapeutic: false, bridge: null, vitK: null, level: "caution", label: "Supratherapeutic (consider holding 1 dose)", action: "Consider holding 1 dose. Decrease weekly maintenance dose by 5\u201315%." },
    { id: "P4", regLo: 4.0, highLo: 4.5, dir: "decrease", pctMin: 5, pctMax: 20, conditionalNoChange: false, supplemental: false, holdOneDose: false, holdUntilTherapeutic: true, bridge: null, vitK: "If the patient is at significant risk for bleeding, consider low-dose oral vitamin K (single dose of 1\u20132.5 mg orally).", level: "high", label: "Markedly supratherapeutic, no bleeding (INR >4 / >4.5 to \u226410)", action: "Hold warfarin until INR is below the upper limit of the therapeutic range. Decrease weekly maintenance dose by 5\u201320%. If the patient is at significant risk for bleeding, consider low-dose oral vitamin K (1\u20132.5 mg orally)." },
    { id: "P5", regLo: 10.0001, highLo: 10.0001, dir: "decrease", pctMin: 5, pctMax: 20, conditionalNoChange: false, supplemental: false, holdOneDose: false, holdUntilTherapeutic: true, bridge: null, vitK: "Consider oral vitamin K 2.5\u20135 mg; recheck INR in 12\u201324 h and repeat if needed. For mechanical valve replacement, use a lower oral vitamin K dose (1\u20132.5 mg) to avoid overcorrection.", level: "critical", label: "Critically elevated, no bleeding (INR >10)", action: "Hold warfarin until INR is below the upper limit of the therapeutic range. Consider oral vitamin K 2.5\u20135 mg (recheck in 12\u201324 h; may repeat). For mechanical valve replacement, use lower oral vitamin K (1\u20132.5 mg) to avoid overcorrection. Decrease weekly maintenance dose by 5\u201320%." },
  ],
  bridging: {
    s1: "For mechanical valve replacement, consider adding LMWH for 3\u20135 days as bridging until the INR reaches target with the new warfarin dose. (On-X bileaflet aortic valve: only consider LMWH if within 3 months of valve insertion.)",
    s2: "Consider LMWH for 3\u20135 days if the patient has a mechanical valve replacement, a VTE event within the last 4 weeks, or a previous VTE while on warfarin.",
    note: "Bridging uses treatment-dose LMWH per the clinician / institutional protocol; the maintenance nomogram does not specify the LMWH dose.",
  },
  bridgeFactors: [
    { key: "mvr", label: "Mechanical valve replacement" },
    { key: "onx", label: "On-X bileaflet aortic valve (within 3 months of insertion)" },
    { key: "vteRecent", label: "VTE within the last 4 weeks" },
    { key: "vtePrior", label: "Previous VTE while on warfarin" },
  ],
  bleeding: {
    minor: ["Subconjunctival hemorrhage", "Small bruising / lacerations", "Dental / gum bleeding", "Anterior epistaxis (nosebleed)", "Hemorrhoidal bleeding"],
    major: ["Intracranial hemorrhage (severe headache, vision change, weakness, confusion)", "Massive or overt GI bleeding", "Hematemesis / coffee-ground emesis", "Hemoptysis (coughing up blood)", "Gross hematuria (red / cola urine)", "Retroperitoneal / intraspinal / intra-ocular / intra-articular bleeding", "Bleeding with Hb drop \u226520 g/L or \u22652 units RBCs"],
  },
  contributors: [
    { label: "Missed dose(s)", deny: "missed doses" },
    { label: "Started / stopped interacting drug or food", deny: "new or discontinued medications" },
    { label: "Recent antibiotic course", deny: "recent antibiotic use" },
    { label: "Acute illness / infection", deny: "acute illness or infection" },
    { label: "Acute alcohol ingestion", deny: "alcohol binge" },
    { label: "Significant vitamin K (diet) change", deny: "any change in dietary vitamin K (leafy greens) intake" },
  ],
  safety: {
    bleedingMajor: "Life-threatening / severe bleeding or hemodynamic compromise: EMERGENCY. Hold warfarin; urgent ED / physician; reversal per physician / institutional protocol.",
    bleedingMinor: "Minor (self-limited) bleeding, patient stable: manage outpatient \u2014 hold / lower dose per INR band, counsel on warning signs, arrange closer INR follow-up. ED not required unless it worsens.",
    source: "KSUMC Anticoagulation Clinic Guideline (March 2022), \u00a72.3 & \u00a74.2. Major-bleeding reversal agents/doses are not specified in this nomogram \u2014 follow physician / institutional direction.",
  },
  followUp: {
    stable: "every 4\u201312 weeks if stable; every 1\u20132 weeks if unstable/unreliable",
    adjusted: "within 1\u20132 weeks (dose adjusted today)",
    held: "in 1\u20132 days (dose held for supratherapeutic INR without bleeding)",
    shortenNote: "shortened for bleeding / transient cause / non-adherence",
  },
};

const round1 = (x) => Math.round(x * 100) / 100;
const roundMg = (x) => Math.round(x);
function weeklyTotal(rows) { return round1(rows.reduce((s, r) => s + (Number(r.dose) || 0) * (Number(r.days) || 0), 0)); }
function totalDays(rows) { return rows.reduce((s, r) => s + (Number(r.days) || 0), 0); }
function applyAdjustment(weekly, direction, pct) { if (direction === "none") return weekly; const f = direction === "increase" ? 1 + pct / 100 : 1 - pct / 100; return roundMg(weekly * f); }
function gridStep(inStock, allowHalves) { return (allowHalves && inStock.includes(1)) ? 0.5 : 1; }
function buildSchedule(targetWeekly, step) {
  if (!targetWeekly || targetWeekly <= 0) return null;
  const mean = targetWeekly / 7;
  const low = Math.floor(mean / step + 1e-9) * step;
  const high = round1(low + step);
  let nH = Math.round((targetWeekly - 7 * low) / step); nH = Math.max(0, Math.min(7, nH));
  const nL = 7 - nH;
  const days = Array(7).fill(low);
  for (let k = 0; k < nH; k++) days[Math.round((k + 0.5) * 7 / Math.max(nH, 1)) % 7] = high;
  const achieved = round1(days.reduce((a, b) => a + b, 0));
  return { low, high, nL, nH, days, achieved, deviation: round1(achieved - targetWeekly) };
}
function makeDose(dose, inStock, allowHalves) {
  const T = Math.round(dose * 2); const halfOK = allowHalves && inStock.includes(1);
  const coins = inStock.map((s) => s * 2); const INF = 1e9;
  const dp = Array(T + 1).fill(INF); const back = Array(T + 1).fill(-1); dp[0] = 0;
  for (let v = 1; v <= T; v++) for (const c of coins) if (c <= v && dp[v - c] + 1 < dp[v]) { dp[v] = dp[v - c] + 1; back[v] = c; }
  const recon = (v) => { const m = {}; while (v > 0) { const c = back[v]; if (c < 0) break; m[c / 2] = (m[c / 2] || 0) + 1; v -= c; } return m; };
  let best = null;
  if (dp[T] < INF) best = { m: recon(T), half: false, n: dp[T] };
  if (halfOK && T >= 1 && dp[T - 1] < INF) { const alt = { m: recon(T - 1), half: true, n: dp[T - 1] + 1 }; if (!best || alt.n < best.n) best = alt; }
  if (!best) return { ok: false, parts: [] };
  const parts = Object.entries(best.m).sort((a, b) => Number(b[0]) - Number(a[0])).map(([s, n]) => `${n}\u00d7${s}`);
  if (best.half) parts.push("\u00bd\u00d71");
  return { ok: true, parts };
}
function blockedDirection(currentINR, lo, hi) { const inr = Number(currentINR); if (!inr) return null; if (inr > Number(hi)) return "increase"; if (inr < Number(lo)) return "decrease"; return null; }
function intensityFor(lo, hi) { const l = Number(lo), h = Number(hi); if (l === 2.0 && h === 3.0) return "regular"; if (l === 2.5 && h === 3.5) return "high"; return "custom"; }
function nomogramBand(currentINR, intensity) {
  const inr = Number(currentINR); if (!inr || intensity === "custom") return null;
  const key = intensity === "high" ? "highLo" : "regLo"; let match = null;
  for (const b of CONFIG.nomogram) { if (inr >= b[key]) { if (!match || b[key] > match[key]) match = b; } }
  return match;
}
function bridgingAdvice(band, f) {
  if (!band) return null;
  if (band.bridge === "mvr") { if (f.mvr || f.onx) return { text: CONFIG.bridging.s1, note: CONFIG.bridging.note }; return null; }
  if (band.bridge === "mvr-or-vte") { if (f.mvr || f.onx || f.vteRecent || f.vtePrior) return { text: CONFIG.bridging.s2, note: CONFIG.bridging.note }; return null; }
  return null;
}
const round05 = (x) => Math.round(x * 2) / 2;
function supplementalDose(weekly) { if (!weekly || weekly <= 0) return null; const daily = weekly / 7; return { lo: round05(daily * 1.5), hi: round05(daily * 2), daily: round1(daily) }; }
function resolveSafety(currentINR, signs, unstable, intensity) {
  const hasMajor = signs.major.length > 0, hasMinor = signs.minor.length > 0;
  if (hasMajor || unstable) return { level: "emergency", er: true, suppress: true, text: CONFIG.safety.bleedingMajor };
  const band = nomogramBand(currentINR, intensity);
  if (band && band.level === "critical") return { level: "critical", er: true, suppress: true, text: band.action };
  if (band && band.level === "high") return { level: "high", er: false, suppress: false, text: band.action };
  if (band && band.level === "caution") return { level: "caution", er: false, suppress: false, text: band.action };
  if (hasMinor) return { level: "caution", er: false, suppress: false, text: CONFIG.safety.bleedingMinor };
  return null;
}
function inrStatusText(currentINR, intensity) {
  const inr = Number(currentINR); if (!inr) return null;
  const band = nomogramBand(currentINR, intensity); if (!band) return null;
  if (band.id === "P5") return "critically elevated (>10)";
  if (band.id === "P4") return "markedly supratherapeutic (>4 / >4.5)";
  if (band.id === "P3" || band.id === "P2" || band.id === "P1") return "supratherapeutic (above target)";
  if (band.id === "R") return "within target range";
  return "subtherapeutic (below target)";
}
function followUpText(band, compliance, transient, hasBleeding) {
  const f = CONFIG.followUp; let base = f.stable;
  if (band) { if (band.holdOneDose || band.holdUntilTherapeutic) base = f.held; else if (band.dir !== "none") base = f.adjusted; else base = f.stable; }
  const shorten = compliance === "no" || transient || hasBleeding;
  return shorten ? `${base} \u2014 ${f.shortenNote}` : base;
}
function regimenStr(rows) { return rows.filter((r) => r.dose !== "" && r.days !== "").map((r) => `${r.dose} mg \u00d7 ${r.days} d`).join(", "); }
function regimenProse(rows) { return rows.filter((r) => r.dose !== "" && r.days !== "").map((r) => `${r.dose} mg \u00d7 ${r.days} day${Number(r.days) > 1 ? "s" : ""}`).join(" + "); }
function schedText(s) { if (s.low === s.high || s.nH === 0) return `${s.low} mg daily`; if (s.nL === 0) return `${s.high} mg daily`; return `${s.low} mg \u00d7 ${s.nL} day${s.nL > 1 ? "s" : ""} + ${s.high} mg \u00d7 ${s.nH} day${s.nH > 1 ? "s" : ""}`; }
function listJoin(items) { if (items.length === 0) return ""; if (items.length === 1) return items[0]; if (items.length === 2) return `${items[0]} and ${items[1]}`; return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`; }
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
function buildSOAP(st) {
  const { indication, lo, hi, intensity, lastINR, currentINR, rows, weekly, weekComplete, band, adj, newWeekly, schedule, bridging, supplemental, contributors, compliance, signs, unstable, safety, followUp, holdDays } = st;
  const cur = Number(currentINR), prev = Number(lastINR);
  const sub = !!cur && cur < Number(lo);
  const supra = !!cur && cur > Number(hi);
  const transient = contributors.length > 0;
  const ind = indication ? indication.toLowerCase() : "";
  const valve = /valve|mechanical/.test(ind);
  const missedKey = "Missed dose(s)";
  const missed = contributors.includes(missedKey);
  const chosenAll = CONFIG.contributors.filter((c) => contributors.includes(c.label));
  const pool = CONFIG.contributors.filter((c) => c.label !== missedKey);
  const chosen = pool.filter((c) => contributors.includes(c.label));
  const notChosen = pool.filter((c) => !contributors.includes(c.label));

  const s = [];
  s.push(`Patient on warfarin${ind ? ` for ${ind}` : ""}${weekComplete ? ", on an established maintenance regimen" : ""}.`);
  if (compliance === "no" || missed) s.push("Reports suboptimal adherence with missed doses.");
  else if (compliance === "yes") s.push("Reports good adherence with no missed doses.");
  if (chosen.length) s.push(`Reports ${listJoin(chosen.map((c) => c.deny))}.`);
  if (notChosen.length) s.push(`Denies ${listJoin(notChosen.map((c) => c.deny))}.`);
  const allSigns = [...signs.major, ...signs.minor];
  if (allSigns.length) s.push(`Reports ${listJoin(allSigns.map((x) => x.toLowerCase()))}.`);
  else s.push("No signs or symptoms of bleeding or thromboembolism reported.");
  const S = s.join(" ");

  const o = [];
  if (lo && hi) o.push(`Indication: ${ind || "warfarin therapy"} \u2014 ${intensity !== "custom" ? `${intensity}-intensity ` : ""}target INR ${lo}\u2013${hi}.`);
  const ib = [];
  if (lastINR) ib.push(`prior INR ${lastINR}`);
  if (currentINR) ib.push(`current INR ${currentINR}`);
  if (ib.length) o.push(capFirst(ib.join("; ")) + ".");
  if (weekComplete) o.push(`Current regimen: ${regimenProse(rows)} = ${weekly} mg/week.`);
  if (unstable === true) o.push("Hemodynamically unstable.");
  else if (unstable === false) o.push("Hemodynamically stable.");
  const O = o.join(" ");

  const a = [];
  if (band) {
    const status = band.id === "R" ? "within the therapeutic range" : band.id === "P5" ? "critically elevated" : band.id === "P4" ? "markedly supratherapeutic" : supra ? "supratherapeutic" : "subtherapeutic";
    const risk = (sub && valve) ? ", and clinically meaningful given the thromboembolic risk of a mechanical valve" : "";
    a.push(`INR ${currentINR} \u2014 ${status}${band.id !== "R" ? ` (KSUMC band ${band.id})` : ""}${risk}.`);
    if (band.id === "R") {
      a.push("The current maintenance regimen appears appropriate; no dose adjustment is indicated.");
    } else {
      const dir = supra ? "supratherapeutic" : "subtherapeutic";
      const motion = supra ? "rise" : "dip";
      const shortfall = supra ? "excess" : "shortfall";
      const sameSide = !!prev && ((sub && prev < Number(lo)) || (supra && prev > Number(hi)));
      const prevInRange = !!prev && prev >= Number(lo) && prev <= Number(hi);
      if (transient) {
        a.push(`A transient precipitant (${listJoin(chosenAll.map((c) => c.deny))}) may account for the out-of-range INR, which would favour addressing the cause and repeating the INR over an immediate maintenance change.`);
      } else if (sameSide) {
        a.push(`Two consecutive ${dir} readings (${lastINR} \u2192 ${currentINR}) with no precipitant identified on questioning point toward a genuine maintenance ${shortfall} rather than a transient cause; a one-off precipitant would more typically produce an isolated ${motion}, not a sustained shift.`);
      } else if (prevInRange) {
        a.push(`The prior INR was in range; this isolated ${dir} result with no clear precipitant is reasonably managed with a modest adjustment and an earlier recheck.`);
      } else {
        a.push("No clear precipitant was identified on questioning.");
      }
      if (band.conditionalNoChange) a.push("Per protocol, holding the dose unchanged is defensible if the last two INRs were in range with no clear explanation; otherwise a modest adjustment applies.");
    }
  } else if (cur) {
    a.push(`INR ${currentINR} \u2014 ${supra ? "supratherapeutic" : sub ? "subtherapeutic" : "within target"}.`);
  }
  if (safety && safety.level === "emergency") a.push("Active major bleeding / hemodynamic instability \u2014 an emergency that overrides routine dose management.");
  else if (safety && safety.level === "critical") a.push("The degree of elevation carries a meaningful hemorrhage risk and warrants holding warfarin with vitamin K per protocol.");
  else if (safety && safety.level === "high") a.push("The elevation warrants holding warfarin, with vitamin K reserved for patients at significant bleeding risk.");
  const A = a.join(" ");

  const P = [];
  if (safety && safety.er) P.push("Refer to ED / urgent physician now; hold warfarin and reverse per physician / institutional protocol.");
  if (holdDays > 0) P.push(`Hold warfarin \u00d7 ${holdDays} day${holdDays > 1 ? "s" : ""}, then resume at the dose below.`);
  if (adj && adj.direction === "none" && (weekComplete || schedule)) {
    P.push(`Continue the current maintenance dose (${weekly} mg/week)${weekComplete ? `, delivered as ${regimenProse(rows)}` : ""}.`);
  } else if (adj && schedule && newWeekly) {
    const verb = adj.direction === "increase" ? "Increase" : "Reduce";
    const range = band ? `${band.pctMin}\u2013${band.pctMax}%` : "5\u201320%";
    P.push(`${verb} maintenance dose ~${adj.pct}% \u2192 ${newWeekly} mg/week, delivered as ${schedText(schedule)}. This sits within the ACCP/ASHP-endorsed ${range} weekly adjustment range.`);
  }
  if (supplemental && band && band.supplemental && adj && adj.direction === "increase") {
    P.push(`One-time supplemental ("booster") dose of approximately ${supplemental.lo}\u2013${supplemental.hi} mg today (1.5\u20132\u00d7 the new daily maintenance dose of ${supplemental.daily} mg) to accelerate return to range while the adjusted regimen reaches steady state.`);
  }
  if (band && band.vitK) P.push(band.vitK);
  if (bridging) P.push(`Consider LMWH bridging: ${bridging.text}`);
  if (adj && adj.direction !== "none") {
    if (transient) P.push("Contingency: given the possible transient precipitant, repeating the INR at the current dose before committing to the maintenance change is a reasonable alternative.");
    else P.push("Contingency: if a clear transient precipitant is later identified, the maintenance change may be reconsidered in favour of repeating the INR at the current dose.");
  }
  if (followUp) P.push(`Follow-up INR ${followUp}.`);
  P.push("Reinforce warfarin education \u2014 adherence, consistent dietary vitamin K intake, and prompt reporting of new medications, illness, or bleeding/clotting symptoms.");
  return { S, O, A, P };
}

function Ico({ size = 16, style, children }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>{children}</svg>);
}
const ShieldAlert = (p) => (<Ico {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></Ico>);
const CircleCheck = (p) => (<Ico {...p}><circle cx="12" cy="12" r="10" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></Ico>);
const CheckCircle2 = CircleCheck;
const FlaskConical = (p) => (<Ico {...p}><path d="M9 3h6M10 3v6.5L4.8 18.4A2 2 0 0 0 6.5 21.5h11A2 2 0 0 0 19.2 18.4L14 9.5V3" /><line x1="7" y1="15" x2="17" y2="15" /></Ico>);
const ChevronDown = (p) => (<Ico {...p}><path d="M6 9l6 6 6-6" /></Ico>);
const AlertTriangle = (p) => (<Ico {...p}><path d="M12 3 2.5 20h19L12 3z" /><line x1="12" y1="10" x2="12" y2="14" /><line x1="12" y1="18" x2="12.01" y2="18" /></Ico>);
const Siren = (p) => (<Ico {...p}><path d="M7 19v-7a5 5 0 0 1 10 0v7" /><line x1="4" y1="21" x2="20" y2="21" /><line x1="12" y1="2" x2="12" y2="4" /><line x1="19" y1="6" x2="20.5" y2="4.5" /><line x1="5" y1="6" x2="3.5" y2="4.5" /></Ico>);
const CalendarClock = (p) => (<Ico {...p}><rect x="3" y="4.5" width="18" height="17" rx="2" /><line x1="3" y1="9.5" x2="21" y2="9.5" /><line x1="8" y1="2.5" x2="8" y2="6" /><line x1="16" y1="2.5" x2="16" y2="6" /><path d="M12 13v3l2 1.2" /></Ico>);
const Pill = (p) => (<Ico {...p}><path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z" /><line x1="8.5" y1="8.5" x2="15.5" y2="15.5" /></Ico>);
const Activity = (p) => (<Ico {...p}><path d="M22 12h-4l-3 8L9 4l-3 8H2" /></Ico>);
const BookText = (p) => (<Ico {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="16" y2="11" /></Ico>);

const T = {
  paper: "#f5f7f8",
  panel: "#ffffff",
  ink: "#0f1f2e",
  muted: "#4a5a68",
  faint: "#8595a3",
  hair: "#e4e9ed",
  brand: "#0e7490",
  brandDeep: "#0b5a72",
  serif: "'Newsreader', Georgia, 'Times New Roman', serif",
  sans: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
};;
const RISK = {
  low: { fg: "#2f7d4f", bg: "#e7f2ea", ring: "#9cc7ad" },
  mod: { fg: "#b07d12", bg: "#f7efda", ring: "#dcc486" },
  high: { fg: "#b3322c", bg: "#f6e1de", ring: "#d99c97" },
};

function NumField({ label, value, onChange, placeholder, suffix, error }) {
  const [focus, setFocus] = useState(false);
  return (
    <label style={{ display: "block" }}>
      <span style={{
        display: "block", fontFamily: T.sans, color: T.muted,
        fontSize: 12.5, fontWeight: 600, letterSpacing: "0.02em",
        textTransform: "uppercase", marginBottom: 7,
      }}>{label}</span>
      <div style={{
        display: "flex", alignItems: "center",
        border: "1px solid " + (error ? "#dc2626" : (focus ? T.brand : T.hair)),
        background: T.panel, borderRadius: 11,
        boxShadow: focus ? "0 0 0 3px rgba(14,116,144,0.14)" : "none",
        transition: "border-color .15s, box-shadow .15s",
        overflow: "hidden",
      }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          inputMode="decimal"
          style={{
            flex: 1, border: "none", outline: "none", background: "transparent",
            fontFamily: T.mono, fontSize: 16, color: T.ink,
            padding: "12px 14px",
          }}
        />
        {suffix ? (
          <span style={{
            fontFamily: T.sans, color: T.faint, fontSize: 12.5,
            fontWeight: 600, padding: "0 14px", whiteSpace: "nowrap",
          }}>{suffix}</span>
        ) : null}
      </div>
    </label>
  );
}
function Segmented({ label, options, value, onChange }) {
  return (
    <div>
      {label ? (
        <div style={{
          fontFamily: T.sans, color: T.muted, fontSize: 12.5,
          fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase",
          marginBottom: 8,
        }}>{label}</div>
      ) : null}
      <div style={{
        display: "flex", gap: 8, flexWrap: "wrap",
      }}>
        {options.map((o) => {
          const active = value === o.v;
          const danger = o.danger;
          const activeBg = danger ? "#dc2626" : T.brand;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(o.v)}
              style={{
                flex: "1 1 0", minWidth: 110,
                fontFamily: T.sans, fontSize: 14, fontWeight: 600,
                padding: "11px 16px", cursor: "pointer",
                borderRadius: 10,
                border: "1px solid " + (active ? activeBg : T.hair),
                background: active ? activeBg : T.panel,
                color: active ? "#ffffff" : T.muted,
                boxShadow: active ? "0 2px 8px -2px rgba(15,31,46,0.25)" : "none",
                transition: "all .14s ease",
              }}
            >{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}
function CheckChip({ label, active, onClick, danger }) {
  const activeBg = danger ? "#fef2f2" : "#ecfeff";
  const activeBorder = danger ? "#dc2626" : T.brand;
  const activeColor = danger ? "#b91c1c" : T.brandDeep;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        fontFamily: T.sans, fontSize: 13.5, fontWeight: 500,
        padding: "9px 14px", cursor: "pointer",
        borderRadius: 999,
        border: "1px solid " + (active ? activeBorder : T.hair),
        background: active ? activeBg : T.panel,
        color: active ? activeColor : T.muted,
        transition: "all .14s ease",
      }}
    >
      <span style={{
        width: 15, height: 15, borderRadius: 5, flexShrink: 0,
        border: "1.5px solid " + (active ? activeBorder : T.faint),
        background: active ? activeBorder : "transparent",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: 10, lineHeight: 1,
      }}>{active ? "✓" : ""}</span>
      {label}
    </button>
  );
}
function StatusBanner() {
  if (CONFIG.status === "verified") return null;
  return (
    <div className="flex gap-3 p-4 rounded-lg mb-5" style={{ background: RISK.mod.bg, border: `1px solid ${RISK.mod.ring}` }}>
      <ShieldAlert size={20} style={{ color: RISK.mod.fg, flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontFamily: T.sans, fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
        <b style={{ color: RISK.mod.fg, letterSpacing: "0.06em" }}>PENDING SIGN-OFF.</b> The dose engine, directional lock, and validation are enforced and tested.
        The <b>clinical bands are transcribed from PPC-approved KSUMC protocol</b> (March 2022, §4.2). Before clinical use, verify this transcription
        against the PDF and have a clinician sign off the tool. Until then, <b>not for clinical use.</b>
      </div>
    </div>
  );
}

function runTests() {
  const t = []; const ALL = CONFIG.tablets;
  const push = (n, pass, got) => t.push({ n, pass, got });
  push("weekly 5.5×3 + 6.5×4 = 42.5", weeklyTotal([{ dose: 5.5, days: 3 }, { dose: 6.5, days: 4 }]) === 42.5, weeklyTotal([{ dose: 5.5, days: 3 }, { dose: 6.5, days: 4 }]));
  push("↓15% of 42.5 → 36", applyAdjustment(42.5, "decrease", 15) === 36, applyAdjustment(42.5, "decrease", 15));
  push("↓20% of 42.5 → 34", applyAdjustment(42.5, "decrease", 20) === 34, applyAdjustment(42.5, "decrease", 20));
  push("maintain keeps 42.5 exactly", applyAdjustment(42.5, "none", 0) === 42.5, applyAdjustment(42.5, "none", 0));
  const s = buildSchedule(36, 0.5);
  push("36 (½ grid) → 5×5 + 5.5×2", s.achieved === 36 && s.low === 5 && s.high === 5.5 && s.nH === 2, `${s.low}×${s.nL}+${s.high}×${s.nH}`);
  const sw = buildSchedule(36, 1);
  push("36 (whole grid) → 5×6 + 6×1", sw.achieved === 36 && sw.low === 5 && sw.high === 6 && sw.nH === 1, `${sw.low}×${sw.nL}+${sw.high}×${sw.nH}`);
  push("5.5 mg deliverable from full stock", makeDose(5.5, ALL, true).ok, makeDose(5.5, ALL, true).parts.join("+"));
  push("6 mg deliverable w/o 1mg stock", makeDose(6, [2, 2.5, 3, 4, 5, 10], true).ok, makeDose(6, [2, 2.5, 3, 4, 5, 10], true).parts.join("+"));
  push("5 mg NOT deliverable from only 10mg", makeDose(5, [10], true).ok === false, String(makeDose(5, [10], true).ok));
  push("INR>target blocks INCREASE", blockedDirection(3.5, 2, 3) === "increase", String(blockedDirection(3.5, 2, 3)));
  push("INR<target blocks DECREASE", blockedDirection(1.6, 2, 3) === "decrease", String(blockedDirection(1.6, 2, 3)));
  const NOF = { mvr: false, onx: false, vteRecent: false, vtePrior: false };
  const b1 = nomogramBand(1.4, "regular");
  push("INR 1.4 (reg) → S1 ↑10–20%", b1.id === "S1" && b1.pctMin === 10 && b1.pctMax === 20, `${b1.id} ${b1.pctMin}-${b1.pctMax}`);
  const b2 = nomogramBand(1.6, "regular");
  push("INR 1.6 (reg) → S2 ↑5–15%", b2.id === "S2" && b2.pctMin === 5 && b2.pctMax === 15, `${b2.id} ${b2.pctMin}-${b2.pctMax}`);
  push("INR 1.85 (reg) → S3 conditional", nomogramBand(1.85, "regular").conditionalNoChange === true, "ok");
  push("INR 2.5 → R (in range)", nomogramBand(2.5, "regular").dir === "none", nomogramBand(2.5, "regular").id);
  push("INR 3.35 (reg) → P2 ↓5–10%", nomogramBand(3.35, "regular").id === "P2", nomogramBand(3.35, "regular").id);
  push("INR 3.7 (reg) → P3 hold 1 dose", nomogramBand(3.7, "regular").holdOneDose === true, "ok");
  push("INR 5 (reg) → P4 high, ↓5–20%", (() => { const b = nomogramBand(5, "regular"); return b.id === "P4" && b.level === "high" && b.pctMax === 20; })(), "ok");
  push("INR 11 (reg) → P5 critical", nomogramBand(11, "regular").level === "critical", "ok");
  push("high intensity 4.2 → P3 (not P4)", nomogramBand(4.2, "high").id === "P3", nomogramBand(4.2, "high").id);
  push("bridging shows: S2 + recent VTE", !!bridgingAdvice(b2, { ...NOF, vteRecent: true }), "shown");
  push("bridging hidden: S2 + none", bridgingAdvice(b2, NOF) === null, "hidden");
  push("bridging hidden on supratherapeutic", bridgingAdvice(nomogramBand(5, "regular"), { ...NOF, mvr: true }) === null, "hidden");
  push("supplemental 35mg/wk → 7.5–10mg", (() => { const s = supplementalDose(35); return s.lo === 7.5 && s.hi === 10; })(), "7.5-10");
  push("INR 11 → critical (KSUMC)", resolveSafety(11, { major: [], minor: [] }, false, "regular").level === "critical", "ok");
  push("INR 5 → vit K only if bleeding risk", /significant risk for bleeding/i.test(resolveSafety(5, { major: [], minor: [] }, false, "regular").text), "ok");
  const sx = resolveSafety(2.5, { major: ["x"], minor: [] }, false, "regular");
  push("major sign → emergency + ER", sx.level === "emergency" && sx.er, sx.level);
  push("formulary 1/2/2.5/5 mg (KSUMC)", JSON.stringify(CONFIG.tablets) === JSON.stringify([1, 2, 2.5, 5]), CONFIG.tablets.join("/"));
  const soapM = buildSOAP({ indication: "Atrial fibrillation", lo: 2, hi: 3, intensity: "regular", lastINR: "", currentINR: "2.5", rows: [{ dose: 5, days: 7 }], weekly: 35, weekComplete: true, band: nomogramBand(2.5, "regular"), adj: { direction: "none", pct: 0 }, newWeekly: 35, schedule: buildSchedule(35, 0.5), bridging: null, supplemental: null, contributors: [], compliance: "yes", signs: { major: [], minor: [] }, unstable: false, safety: null, followUp: "4–12 weeks", holdDays: 0 });
  push("SOAP maintain → continue current dose", soapM.P.join(" ").includes("Continue the current maintenance dose"), `${soapM.P.length} lines`);
  return t;
}
function SelfTest() {
  const [open, setOpen] = useState(false);
  const r = useMemo(runTests, []);
  const all = r.every((x) => x.pass);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.hair}` }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3" style={{ background: T.panel }}>
        <span className="flex items-center gap-2">
          <FlaskConical size={15} style={{ color: all ? RISK.low.fg : RISK.high.fg }} />
          <span style={{ fontFamily: T.sans, fontSize: 13, color: T.ink }}>Engine self-test</span>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: all ? RISK.low.fg : RISK.high.fg }}>{r.filter((x) => x.pass).length}/{r.length} passing</span>
        </span>
        <ChevronDown size={16} style={{ color: T.faint, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && (
        <div style={{ background: T.paper, borderTop: `1px solid ${T.hair}` }}>
          {r.map((x, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2" style={{ borderBottom: i < r.length - 1 ? `1px solid ${T.hair}` : "none" }}>
              <span className="flex items-center gap-2" style={{ fontFamily: T.sans, fontSize: 12, color: T.muted }}>
                {x.pass ? <CircleCheck size={13} style={{ color: RISK.low.fg }} /> : <ShieldAlert size={13} style={{ color: RISK.high.fg }} />}{x.n}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: x.pass ? T.faint : RISK.high.fg }}>{String(x.got)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SoapSummary({ soap }) {
  const [copied, setCopied] = useState(false);
  const text = ["S \u2014 Subjective: " + soap.S, "", "O \u2014 Objective: " + soap.O, "", "A \u2014 Assessment: " + soap.A, "", "P \u2014 Plan:", ...soap.P.map((l, i) => `  ${i + 1}. ${l}`)].join("\n");
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { } };
  const Para = ({ letter, title, body, color }) => (
    <div style={{ marginBottom: 12 }}>
      <div className="flex items-baseline gap-2" style={{ marginBottom: 4 }}>
        <span style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 700, color, width: 16 }}>{letter}</span>
        <span style={{ fontFamily: T.sans, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: T.faint }}>{title}</span>
      </div>
      <div style={{ fontFamily: T.sans, fontSize: 13, color: body ? T.ink : T.faint, lineHeight: 1.6, paddingLeft: 24 }}>{body || "\u2014"}</div>
    </div>
  );
  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: T.panel, border: `1px solid ${T.hair}` }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <span style={{ fontFamily: T.serif, fontSize: 15, color: T.ink }}>Case summary (SOAP)</span>
        <button type="button" onClick={copy} className="px-3 py-1 rounded-md" style={{ fontFamily: T.sans, fontSize: 12, background: copied ? RISK.low.bg : T.paper, color: copied ? RISK.low.fg : T.brand, border: `1px solid ${copied ? RISK.low.ring : T.hair}` }}>{copied ? "Copied \u2713" : "Copy"}</button>
      </div>
      <Para letter="S" title="Subjective" body={soap.S} color={T.brand} />
      <Para letter="O" title="Objective" body={soap.O} color={T.brand} />
      <Para letter="A" title="Assessment" body={soap.A} color={RISK.mod.fg} />
      <div style={{ marginBottom: 12 }}>
        <div className="flex items-baseline gap-2" style={{ marginBottom: 4 }}>
          <span style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 700, color: T.brandDeep, width: 16 }}>P</span>
          <span style={{ fontFamily: T.sans, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: T.faint }}>Plan</span>
        </div>
        <ol style={{ margin: 0, paddingLeft: 42, listStyle: "decimal" }}>
          {soap.P.map((l, i) => <li key={i} style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, lineHeight: 1.6, marginBottom: 5 }}>{l}</li>)}
        </ol>
      </div>
      <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.faint, marginTop: 4, paddingTop: 8, borderTop: `1px solid ${T.hair}` }}>Auto-generated from entries. The Plan reflects the tool's recommendation — still <span style={{ fontFamily: T.mono, fontSize: 11 }}>pending sign-off</span>.</div>
    </div>
  );
}

function AppInner({ onSnapshot }) {
  const [indIdx, setIndIdx] = useState(0);
  const ind = CONFIG.indications[indIdx];
  const [lo, setLo] = useState(ind.lo);
  const [hi, setHi] = useState(ind.hi);
  const [lastINR, setLastINR] = useState("");
  const [currentINR, setCurrentINR] = useState("");
  const [rows, setRows] = useState([{ dose: "", days: "" }]);
  const [adj, setAdj] = useState(null);
  const [stock, setStock] = useState(CONFIG.tablets.reduce((m, t) => ({ ...m, [t]: true }), {}));
  const [compliance, setCompliance] = useState("");
  const [contributors, setContributors] = useState([]);
  const [signs, setSigns] = useState({ major: [], minor: [] });
  const [unstable, setUnstable] = useState(null);
  const [holdDays, setHoldDays] = useState("");
  const [bridge, setBridge] = useState({ mvr: false, onx: false, vteRecent: false, vtePrior: false });

  const setIndication = (i) => { setIndIdx(i); setLo(CONFIG.indications[i].lo); setHi(CONFIG.indications[i].hi); };
  const toggleSign = (cat, label) => setSigns((s) => ({ ...s, [cat]: s[cat].includes(label) ? s[cat].filter((x) => x !== label) : [...s[cat], label] }));
  const toggleContrib = (label) => setContributors((c) => c.includes(label) ? c.filter((x) => x !== label) : [...c, label]);

  const visibleRows = useMemo(() => {
    const r = [...rows];
    const filledDays = totalDays(r.filter((x) => x.dose !== "" && x.days !== ""));
    const lastComplete = r.length === 0 || (r[r.length - 1].dose !== "" && r[r.length - 1].days !== "");
    if (filledDays < 7 && lastComplete) r.push({ dose: "", days: "" });
    return r;
  }, [rows]);
  const remainingDays = Math.max(0, 7 - totalDays(visibleRows.filter((x) => x.dose !== "" && x.days !== "")));
  const updateRow = (i, key, val) => {
    const r = [...visibleRows]; r[i] = { ...r[i], [key]: val };
    setRows(r.filter((x, idx) => x.dose !== "" || x.days !== "" || idx === r.length - 1));
  };

  const weekly = weeklyTotal(rows);
  const weekComplete = totalDays(rows) === 7;

  const inrNum = currentINR === "" ? null : Number(currentINR);
  const inrMissing = inrNum === null || Number.isNaN(inrNum);
  const inrInvalid = !inrMissing && (inrNum < CONFIG.limits.inrMin || inrNum > CONFIG.limits.inrMax);
  const lastInrInvalid = lastINR !== "" && (Number(lastINR) < CONFIG.limits.inrMin || Number(lastINR) > CONFIG.limits.inrMax);
  const weeklyInvalid = weekly > CONFIG.limits.weeklyMax;
  const canDose = weekComplete && !inrMissing && !inrInvalid && !weeklyInvalid;

  const intensity = useMemo(() => intensityFor(lo, hi), [lo, hi]);
  const band = useMemo(() => (inrMissing || inrInvalid ? null : nomogramBand(currentINR, intensity)), [currentINR, intensity, inrMissing, inrInvalid]);
  const safety = useMemo(() => (inrInvalid ? null : resolveSafety(currentINR, signs, unstable === true, intensity)), [currentINR, signs, unstable, intensity, inrInvalid]);
  const dirBlock = useMemo(() => (inrMissing || inrInvalid ? null : blockedDirection(currentINR, lo, hi)), [currentINR, lo, hi, inrMissing, inrInvalid]);
  const hasBleeding = signs.major.length > 0 || signs.minor.length > 0;
  const transient = contributors.length > 0;
  const bridging = useMemo(() => bridgingAdvice(band, bridge), [band, bridge]);
  const aboveTarget = !inrMissing && !inrInvalid && Number(currentINR) > Number(hi);
  const showHold = unstable === true || aboveTarget;
  const holdN = showHold && Number(holdDays) > 0 ? Number(holdDays) : 0;

  const inStock = CONFIG.tablets.filter((t) => stock[t]);
  const step = gridStep(inStock, CONFIG.allowHalves);
  const newWeekly = adj && canDose ? applyAdjustment(weekly, adj.direction, adj.pct) : null;
  const schedule = newWeekly ? buildSchedule(newWeekly, step) : null;
  const supplemental = useMemo(() => supplementalDose((adj && adj.direction === "increase" && newWeekly) ? newWeekly : weekly), [adj, newWeekly, weekly]);
  const scheduleGroups = useMemo(() => {
    if (!schedule) return [];
    if (schedule.low === schedule.high) return [{ dose: schedule.low, n: 7 }];
    const g = [];
    if (schedule.nL > 0) g.push({ dose: schedule.low, n: schedule.nL });
    if (schedule.nH > 0) g.push({ dose: schedule.high, n: schedule.nH });
    return g;
  }, [schedule]);
  const followUp = useMemo(() => followUpText(band, compliance, transient, hasBleeding), [band, compliance, transient, hasBleeding]);
  const soap = useMemo(() => buildSOAP({ indication: ind.label, lo, hi, intensity, lastINR, currentINR, rows, weekly, weekComplete, band, adj, newWeekly, schedule, bridging, supplemental: (band && band.supplemental ? supplemental : null), contributors, compliance, signs, unstable, safety, followUp, holdDays: holdN }),
    [ind.label, lo, hi, intensity, lastINR, currentINR, rows, weekly, weekComplete, band, adj, newWeekly, schedule, bridging, supplemental, contributors, compliance, signs, unstable, safety, followUp, holdN]);
  // UI: report a snapshot upward for the History feature (presentation only)
  React.useEffect(() => {
    if (typeof onSnapshot === "function") {
      onSnapshot({
        indication: (CONFIG.indications[indIdx] && CONFIG.indications[indIdx].label) || "",
        lo, hi, lastINR, currentINR,
        band: band && band.id ? band.id : "",
        bandText: band && band.action ? band.action : "",
        adj, soap,
      });
    }
  });


  const AdjBtn = ({ direction, pct }) => {
    const active = adj && adj.direction === direction && adj.pct === pct;
    const inProtocol = !!band && band.dir === direction && pct >= band.pctMin && pct <= band.pctMax;
    const blocked = !canDose || direction === dirBlock;
    return (
      <button type="button" aria-pressed={!!active} onClick={() => !blocked && setAdj({ direction, pct })} disabled={blocked}
        className="px-2 py-2 rounded-md transition-colors relative"
        style={{ fontFamily: T.sans, fontSize: 13, flex: 1, cursor: blocked ? "not-allowed" : "pointer", opacity: blocked ? 0.35 : 1,
          background: active ? (direction === "increase" ? RISK.low.fg : RISK.high.fg) : T.panel, color: active ? "#fff" : T.ink,
          border: `1px solid ${inProtocol && !active && !blocked ? T.brand : T.hair}`, textDecoration: direction === dirBlock ? "line-through" : "none" }}>
        {direction === "increase" ? "↑" : "↓"} {pct}%
        {inProtocol && !active && !blocked && <span style={{ position: "absolute", top: -7, right: -5, fontFamily: T.mono, fontSize: 8, background: T.brand, color: "#fff", borderRadius: 999, padding: "1px 4px" }}>protocol</span>}
      </button>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: T.paper, padding: "26px 16px" }}>
      <div style={{ maxWidth: 760, margin: "32px auto" }}>
        <header style={{
          margin: "-4px -4px 26px",
          padding: "28px 30px",
          borderRadius: 20,
          background: "linear-gradient(135deg, " + T.brandDeep + " 0%, " + T.brand + " 100%)",
          boxShadow: "0 12px 32px -12px rgba(11,90,114,0.5)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative", zIndex: 1 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13, flexShrink: 0,
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
            }}>{"\uD83E\uDE78"}</div>
            <div>
              <div style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 600, color: "#ffffff", lineHeight: 1.1, letterSpacing: "-0.01em" }}>Warfarin Maintenance</div>
              <div style={{ fontFamily: T.sans, fontSize: 13, color: "rgba(255,255,255,0.78)", marginTop: 4 }}>Weekly-dose adjustment · daily schedule</div>
            </div>
          </div>
          <div style={{
            fontFamily: T.mono, fontSize: 10.5, fontWeight: 500,
            color: "#ffffff",
            padding: "6px 12px", borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.35)",
            background: "rgba(255,255,255,0.12)",
            whiteSpace: "nowrap", position: "relative", zIndex: 1,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "#fbbf24", display: "inline-block" }}></span>
            pending sign-off
          </div>
          <div style={{
            position: "absolute", right: -40, top: -40,
            width: 180, height: 180, borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
          }}></div>
        </header>

        <StatusBanner />

        <Card>
          <Label>Indication &amp; INR target</Label>
          <select value={indIdx} onChange={(e) => setIndication(Number(e.target.value))}
            style={{ width: "100%", fontFamily: T.sans, fontSize: 14, padding: "9px 10px", borderRadius: 8, border: `1px solid ${T.hair}`, background: T.panel, color: T.ink, marginBottom: 12 }}>
            {CONFIG.indications.map((x, i) => <option key={i} value={i}>{x.label}</option>)}
          </select>
          <div className="flex gap-3 items-end">
            <NumField label="Target low" value={lo} onChange={setLo} suffix="INR" />
            <NumField label="Target high" value={hi} onChange={setHi} suffix="INR" />
          </div>
          <Hint>Auto-filled from indication; editable by the clinician.</Hint>
          <div style={{ marginTop: 8, fontFamily: T.mono, fontSize: 11, color: intensity === "custom" ? RISK.mod.fg : T.brand }}>
            {intensity === "custom" ? "Custom intensity (not a standard KSUMC column)" : `${intensity === "high" ? "High" : "Regular"}-intensity column (target ${intensity === "high" ? "2.5–3.5" : "2–3"})`}
          </div>
        </Card>

        <Card>
          <Label>INR</Label>
          <div className="flex gap-3">
            <NumField label="Last INR" value={lastINR} onChange={setLastINR} placeholder="—" error={lastInrInvalid ? "0.8–15" : null} />
            <NumField label="Current INR" value={currentINR} onChange={setCurrentINR} placeholder="—" error={inrInvalid ? "INR must be 0.8–15" : null} />
          </div>
          {inrMissing && <Hint>Enter the current INR to enable dose recommendations and safety checks.</Hint>}
          {intensity === "custom" && !inrMissing && !inrInvalid && (
            <div style={{ fontFamily: T.sans, fontSize: 12, color: RISK.mod.fg, marginTop: 10 }}>Custom target — the KSUMC nomogram defines bands only for 2–3 (regular) or 2.5–3.5 (high). Showing dose direction only; map the band manually.</div>
          )}
          {band && (
            <div style={{ marginTop: 10, padding: "10px 12px", background: T.paper, borderRadius: 8 }}>
              <div style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 700, color: T.brand }}>KSUMC nomogram · band {band.id} · {intensity}-intensity</div>
              <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink, marginTop: 4, lineHeight: 1.5 }}>{band.action}</div>
              <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.faint, marginTop: 4 }}>[verify against protocol §4.2]</div>
            </div>
          )}
        </Card>

        <Card>
          <Label><span className="flex items-center gap-2"><Activity size={15} style={{ color: T.brand }} />Clinical stability</span></Label>
          <Segmented options={[{ v: false, label: "Stable" }, { v: true, label: "Unstable", danger: true }]} value={unstable} onChange={(v) => { setUnstable(v); if (v !== true) setSigns({ major: [], minor: [] }); }} />
          <Hint>Unstable = dizziness / syncope, fast heart rate, low BP, breathlessness, or active severe bleeding. Unstable → ER.</Hint>
        </Card>

        <Card>
          <Label>Thromboembolic risk factors <span style={{ fontFamily: T.sans, fontSize: 11.5, color: T.faint }}>(for bridging if subtherapeutic)</span></Label>
          <div className="flex gap-2 flex-wrap">
            {CONFIG.bridgeFactors.map((bf) => (
              <CheckChip key={bf.key} label={bf.label} active={bridge[bf.key]} onClick={() => setBridge((s) => ({ ...s, [bf.key]: !s[bf.key] }))} />
            ))}
          </div>
          <Hint>Per §4.2, LMWH bridging is considered for a subtherapeutic INR with mechanical valve replacement, a VTE within the last 4 weeks, or a previous VTE while on warfarin.</Hint>
        </Card>

        {unstable === true && (
          <Card>
            <Label>Signs / symptoms of bleeding <span style={{ fontFamily: T.sans, fontSize: 11.5, color: T.faint }}>(check all present)</span></Label>
            <div style={{ fontFamily: T.sans, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: T.faint, margin: "2px 0 8px" }}>Minor</div>
            <div className="flex gap-2 flex-wrap" style={{ marginBottom: 14 }}>
              {CONFIG.bleeding.minor.map((s) => <CheckChip key={s} label={s} active={signs.minor.includes(s)} onClick={() => toggleSign("minor", s)} />)}
            </div>
            <div style={{ fontFamily: T.sans, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: RISK.high.fg, margin: "2px 0 8px" }}>Major (→ emergency)</div>
            <div className="flex gap-2 flex-wrap">
              {CONFIG.bleeding.major.map((s) => <CheckChip key={s} label={s} active={signs.major.includes(s)} onClick={() => toggleSign("major", s)} danger />)}
            </div>
            <Hint>Shown because the patient is unstable. Categorization is a proposed list — [verify] against your source.</Hint>
          </Card>
        )}

        {safety && (
          <div role="alert" aria-live={safety.suppress ? "assertive" : "polite"} className="flex gap-3 p-4 rounded-xl mb-4" style={{ background: safety.suppress ? RISK.high.bg : RISK.mod.bg, border: `1.5px solid ${safety.suppress ? RISK.high.fg : RISK.mod.ring}` }}>
            {safety.suppress ? <AlertTriangle size={20} style={{ color: RISK.high.fg, flexShrink: 0, marginTop: 1 }} /> : <ShieldAlert size={20} style={{ color: RISK.mod.fg, flexShrink: 0, marginTop: 1 }} />}
            <div>
              <div style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 13, color: safety.suppress ? RISK.high.fg : RISK.mod.fg, letterSpacing: "0.04em" }}>{safety.level.toUpperCase()}</div>
              <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, marginTop: 4, lineHeight: 1.5 }}>{safety.text}</div>
              {safety.er && <div className="flex items-center gap-1.5" style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 13, color: RISK.high.fg, marginTop: 8 }}><Siren size={15} /> Refer to Emergency Department / urgent physician now.</div>}
            </div>
          </div>
        )}

        {showHold && (
          <Card>
            <Label><span className="flex items-center gap-2"><CalendarClock size={15} style={{ color: RISK.high.fg }} />Possible dose hold {unstable === true ? "(patient unstable)" : "(INR above target)"}</span></Label>
            <NumField label="Hold warfarin for" value={holdDays} onChange={setHoldDays} placeholder="0" suffix="day(s)" />
            <Hint>{unstable === true ? "Consider holding pending stabilization / reversal." : "A hold may be clinically indicated for a supratherapeutic INR."} Optional — added to the case summary. [verify]</Hint>
          </Card>
        )}

        <Card>
          <Label>Previous doses taken (per week)</Label>
          <div className="grid gap-2">
            <div className="flex gap-3" style={{ fontFamily: T.sans, fontSize: 11.5, color: T.faint }}>
              <span style={{ flex: 1 }}>Dose (mg)</span><span style={{ width: 110 }}>Days</span><span style={{ width: 70, textAlign: "right" }}>= mg</span>
            </div>
            {visibleRows.map((r, i) => {
              const filledBefore = totalDays(visibleRows.slice(0, i).filter((x) => x.dose !== "" && x.days !== ""));
              const maxDays = Math.max(1, 7 - filledBefore);
              return (
                <div key={i} className="flex gap-3 items-center">
                  <div style={{ flex: 1 }}>
                    <input type="number" inputMode="decimal" value={r.dose} placeholder="e.g. 5.5" onChange={(e) => updateRow(i, "dose", e.target.value)}
                      style={{ width: "100%", fontFamily: T.mono, fontSize: 14, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.hair}`, background: T.panel, color: T.ink }} />
                  </div>
                  <select value={r.days} onChange={(e) => updateRow(i, "days", e.target.value)}
                    style={{ width: 110, fontFamily: T.mono, fontSize: 14, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.hair}`, background: T.panel, color: r.days ? T.ink : T.faint }}>
                    <option value="">days</option>
                    {Array.from({ length: maxDays }, (_, k) => k + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <span style={{ width: 70, textAlign: "right", fontFamily: T.mono, fontSize: 13, color: T.muted }}>{r.dose && r.days ? round1(Number(r.dose) * Number(r.days)) : "—"}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${T.hair}` }}>
            <span style={{ fontFamily: T.sans, fontSize: 12.5, color: remainingDays === 0 ? T.muted : RISK.mod.fg }}>{remainingDays === 0 ? "7 / 7 days" : `${7 - remainingDays} / 7 days — ${remainingDays} remaining`}</span>
            <span style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: weeklyInvalid ? RISK.high.fg : weekComplete ? T.brand : T.faint }}>{weekComplete ? `Total weekly: ${weekly} mg` : `${weekly} mg…`}</span>
          </div>
          {weeklyInvalid && <div style={{ fontFamily: T.sans, fontSize: 11.5, color: RISK.high.fg, marginTop: 6 }}>Weekly dose exceeds {CONFIG.limits.weeklyMax} mg — please re-check the entries.</div>}
        </Card>

        <Card>
          <Label>Dose action</Label>
          {!canDose && <div style={{ fontFamily: T.sans, fontSize: 12.5, color: RISK.mod.fg, marginBottom: 10 }}>{weekComplete ? (inrMissing ? "Enter a valid current INR to enable dose actions." : (inrInvalid ? "Current INR is out of range." : "Weekly dose is out of range.")) : "Complete a 7-day regimen to enable dose actions."}</div>}
          <button type="button" aria-pressed={!!(adj && adj.direction === "none")} onClick={() => canDose && setAdj({ direction: "none", pct: 0 })} disabled={!canDose}
            className="w-full px-3 py-2 rounded-md mb-3 relative flex items-center justify-center gap-2"
            style={{ fontFamily: T.sans, fontSize: 13, cursor: canDose ? "pointer" : "not-allowed", opacity: canDose ? 1 : 0.35,
              background: adj && adj.direction === "none" ? T.brand : T.panel, color: adj && adj.direction === "none" ? "#fff" : T.ink, border: `1px solid ${(band && (band.dir === "none" || band.conditionalNoChange)) && !(adj && adj.direction === "none") ? T.brand : T.hair}` }}>
            <CheckCircle2 size={14} /> No change — maintain current dose
            {(band && (band.dir === "none" || band.conditionalNoChange)) && !(adj && adj.direction === "none") && <span style={{ position: "absolute", top: -7, right: -5, fontFamily: T.mono, fontSize: 8, background: T.brand, color: "#fff", borderRadius: 999, padding: "1px 4px" }}>{band.dir === "none" ? "in range" : "maybe"}</span>}
          </button>
          {dirBlock && (
            <div role="status" aria-live="polite" className="flex gap-2 items-start mb-3 px-3 py-2 rounded-lg" style={{ background: RISK.high.bg, border: `1px solid ${RISK.high.ring}` }}>
              <ShieldAlert size={15} style={{ color: RISK.high.fg, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontFamily: T.sans, fontSize: 12.5, color: RISK.high.fg, lineHeight: 1.4 }}>{dirBlock === "increase" ? "INR above target — dose INCREASE blocked. Only reduction (↓) is appropriate." : "INR below target — dose REDUCTION blocked. Only increase (↑) is appropriate."}</span>
            </div>
          )}
          <div style={{ fontFamily: T.sans, fontSize: 11, color: T.faint, marginBottom: 4 }}>Reduce weekly dose</div>
          <div className="flex gap-2 mb-2"><AdjBtn direction="decrease" pct={5} /><AdjBtn direction="decrease" pct={10} /><AdjBtn direction="decrease" pct={15} /><AdjBtn direction="decrease" pct={20} /></div>
          <div style={{ fontFamily: T.sans, fontSize: 11, color: T.faint, marginBottom: 4 }}>Increase weekly dose</div>
          <div className="flex gap-2"><AdjBtn direction="increase" pct={5} /><AdjBtn direction="increase" pct={10} /><AdjBtn direction="increase" pct={15} /><AdjBtn direction="increase" pct={20} /></div>
          {band && band.dir !== "none" && <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.muted, marginTop: 8 }}>Protocol range for band {band.id}: <b>{band.dir === "increase" ? "↑" : "↓"} {band.pctMin}–{band.pctMax}%</b> (highlighted above).</div>}
          {band && band.conditionalNoChange && <div style={{ fontFamily: T.sans, fontSize: 11.5, color: RISK.mod.fg, marginTop: 6 }}>Per protocol, no change may be appropriate if the last 2 INRs were in range with no clear cause — clinician judgment.</div>}
          {band && band.supplemental && adj && adj.direction === "increase" && supplemental && (
            <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink, marginTop: 10, padding: "8px 12px", background: RISK.low.bg, borderRadius: 8, border: `1px solid ${RISK.low.ring}` }}>
              Consider a one-time supplemental dose: <b>{supplemental.lo}–{supplemental.hi} mg</b> (1.5–2× the ~{supplemental.daily} mg new daily dose). <span style={{ fontFamily: T.mono, fontSize: 10 }}>[verify]</span>
            </div>
          )}
          {newWeekly !== null && adj && adj.direction !== "none" && (
            <div style={{ fontFamily: T.mono, fontSize: 13, color: T.ink, marginTop: 12, padding: "8px 12px", background: T.paper, borderRadius: 8 }}>
              {weekly} × {adj.direction === "increase" ? "1+" : "1−"}{adj.pct / 100} = {round1(weekly * (adj.direction === "increase" ? 1 + adj.pct / 100 : 1 - adj.pct / 100))} → rounded <b>{newWeekly} mg/week</b>
            </div>
          )}
        </Card>

        {bridging && (
          <div className="flex gap-3 p-4 rounded-xl mb-4" style={{ background: RISK.mod.bg, border: `1.5px solid ${RISK.mod.ring}` }}>
            <Activity size={20} style={{ color: RISK.mod.fg, flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 13, color: RISK.mod.fg, letterSpacing: "0.04em" }}>CONSIDER LMWH BRIDGING</div>
              <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, marginTop: 4, lineHeight: 1.5 }}>{bridging.text}</div>
              <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.muted, marginTop: 6 }}>{bridging.note} <span style={{ fontFamily: T.mono, fontSize: 10 }}>[verify §4.2]</span></div>
            </div>
          </div>
        )}

        {schedule && (
          <Card>
            <Label>Recommended weekly schedule</Label>
            {step === 1 && <div style={{ fontFamily: T.sans, fontSize: 11.5, color: RISK.mod.fg, marginBottom: 8 }}>1 mg unavailable — using whole-milligram dosing.</div>}
            <div className="grid gap-1.5">
              {scheduleGroups.map((g, i) => {
                const br = makeDose(g.dose, inStock, CONFIG.allowHalves);
                return (
                  <div key={i} className="px-3 py-2.5 rounded-lg" style={{ background: T.paper, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", alignItems: "center", columnGap: 8 }}>
                    <span style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 600, color: T.ink }}>{g.dose} mg</span>
                    <span style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: T.brand, textAlign: "center" }}>{g.n}×/wk</span>
                    <span style={{ fontFamily: T.mono, fontSize: 11, color: br.ok ? T.faint : RISK.high.fg, textAlign: "right", whiteSpace: "nowrap" }}>{br.ok ? br.parts.join(" ") : "not deliverable"}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${T.hair}`, fontFamily: T.mono, fontSize: 12.5, color: T.muted }}>
              <span>Total: <b style={{ color: T.brand }}>{schedule.achieved} mg/week</b></span>
              <span>Δ target: {schedule.deviation >= 0 ? "+" : ""}{schedule.deviation} mg</span>
            </div>
            <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.hair}` }}>
              <div className="flex items-center gap-2 mb-2"><Pill size={13} style={{ color: T.brand }} /><span style={{ fontFamily: T.sans, fontSize: 12, color: T.muted }}>Tablet availability (uncheck if out of stock → re-solves)</span></div>
              <div className="flex gap-2 flex-wrap">
                {CONFIG.tablets.map((tb) => (
                  <button key={tb} type="button" aria-pressed={stock[tb]} aria-label={`${tb} mg tablet ${stock[tb] ? "in stock" : "out of stock"}`} onClick={() => setStock((s) => ({ ...s, [tb]: !s[tb] }))} className="px-2.5 py-1 rounded-md"
                    style={{ fontFamily: T.mono, fontSize: 12, background: stock[tb] ? T.brand : T.panel, color: stock[tb] ? "#fff" : T.faint, border: `1px solid ${stock[tb] ? T.brand : T.hair}`, textDecoration: stock[tb] ? "none" : "line-through" }}>{tb} mg</button>
                ))}
              </div>
            </div>
          </Card>
        )}

        <Card>
          <Label>Context &amp; follow-up</Label>
          <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.muted, marginBottom: 8 }}>Possible contributing factors (check any present):</div>
          <div className="flex gap-2 flex-wrap" style={{ marginBottom: 14 }}>
            {CONFIG.contributors.map((c) => <CheckChip key={c.label} label={c.label} active={contributors.includes(c.label)} onClick={() => toggleContrib(c.label)} />)}
          </div>
          <Segmented label="Adherent / compliant?" options={[{ v: "yes", label: "Yes" }, { v: "no", label: "No" }]} value={compliance} onChange={setCompliance} />
          {transient && (
            <div className="flex gap-2 mt-3 px-3 py-2 rounded-lg" style={{ background: RISK.mod.bg, border: `1px solid ${RISK.mod.ring}` }}>
              <ShieldAlert size={15} style={{ color: RISK.mod.fg, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink, lineHeight: 1.4 }}>A transient / explained cause may account for the INR. Consider <b>deferring the maintenance dose change</b> and rechecking, rather than re-dosing now.</span>
            </div>
          )}
          {(transient || compliance) && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg" style={{ background: T.paper }}>
              <CalendarClock size={15} style={{ color: T.brand }} />
              <span style={{ fontFamily: T.sans, fontSize: 13, color: T.ink }}>Suggested follow-up INR: <b>{followUp}</b></span>
              <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.faint }}>[verify]</span>
            </div>
          )}
        </Card>

        <SoapSummary soap={soap} />

        <Card>
          <div className="flex items-center gap-2 mb-2"><BookText size={15} style={{ color: T.brand }} /><span style={{ fontFamily: T.sans, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: T.faint }}>Provenance</span></div>
          <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.muted, lineHeight: 1.6 }}>Dose engine, directional lock, validation: deterministic, tested. Clinical bands: <b style={{ color: RISK.mod.fg }}>{CONFIG.guideline.name}</b>. {CONFIG.safety.source} {CONFIG.guideline.note}</div>
        </Card>
        <SelfTest />

        <div style={{ textAlign: "center", marginTop: 20, fontFamily: T.sans, fontSize: 11, color: T.faint, lineHeight: 1.6 }}>
          <b>Not for clinical use</b> — verify all dosing against the official KSUMC Anticoagulation Guideline; consult Ambulatory Care Clinical Pharmacist.
        </div>
      </div>
    </div>
  );
}

function Card({ children }) {
  return (
    <div style={{
      background: T.panel,
      border: "1px solid " + T.hair,
      borderRadius: 16,
      padding: "22px 24px",
      marginBottom: 18,
      boxShadow: "0 1px 2px rgba(15,31,46,0.04), 0 8px 24px -16px rgba(15,31,46,0.18)",
    }}>{children}</div>
  );
}
function Label({ children }) {
  return (
    <div style={{
      fontFamily: T.serif,
      color: T.ink,
      fontSize: 19,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      marginBottom: 14,
    }}>{children}</div>
  );
}
function Hint({ children }) {
  return (
    <div style={{
      fontFamily: T.sans,
      color: T.faint,
      fontSize: 12.5,
      lineHeight: 1.5,
      marginTop: 8,
    }}>{children}</div>
  );
}


// ============================================================================
// UI ADD-ON (presentation/evaluation only — NOT clinical logic):
// Mock sign-up gate + local History. No real authentication is performed and
// no data leaves the browser. EVALUATION ONLY — do not enter real patient data.
// ============================================================================

function MockAuthGate({ onEnter }) {
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: T.paper, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: T.sans }}>
      <div style={{ width: "100%", maxWidth: 400, background: T.panel, border: "1px solid " + T.hair, borderRadius: 18, boxShadow: "0 12px 40px -16px rgba(15,31,46,0.25)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, " + T.brandDeep + " 0%, " + T.brand + " 100%)", padding: "26px 28px", color: "#fff" }}>
          <div style={{ fontSize: 28 }}>{"\uD83E\uDE78"}</div>
          <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 600, marginTop: 6 }}>Warfarin Maintenance</div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{mode === "signup" ? "Create your account" : "Sign in to your account"}</div>
        </div>
        <div style={{ padding: "22px 28px 26px" }}>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 10, padding: "9px 12px", fontSize: 11.5, lineHeight: 1.5, marginBottom: 18 }}>
            <b>Not for clinical use.</b> This sign-up is for evaluation only — no real account is created and nothing is sent anywhere. Do not enter real credentials.
          </div>
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 6 }}>Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. Smith" style={{ width: "100%", fontFamily: T.sans, fontSize: 14, padding: "11px 13px", borderRadius: 10, border: "1px solid " + T.hair, outline: "none", color: T.ink }} />
          </label>
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 6 }}>Email (not stored)</span>
            <input placeholder="you@example.com" style={{ width: "100%", fontFamily: T.sans, fontSize: 14, padding: "11px 13px", borderRadius: 10, border: "1px solid " + T.hair, outline: "none", color: T.ink }} />
          </label>
          <label style={{ display: "block", marginBottom: 18 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 6 }}>Password (not stored)</span>
            <input type="password" placeholder="••••••••" style={{ width: "100%", fontFamily: T.sans, fontSize: 14, padding: "11px 13px", borderRadius: 10, border: "1px solid " + T.hair, outline: "none", color: T.ink }} />
          </label>
          <button onClick={() => onEnter(name || "Guest clinician")} style={{ width: "100%", background: T.brand, color: "#fff", border: "none", borderRadius: 11, padding: "13px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: T.sans }}>
            {mode === "signup" ? "Sign up & continue" : "Sign in"}
          </button>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 12.5, color: T.muted }}>
            {mode === "signup" ? "Already registered? " : "Need an account? "}
            <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} style={{ background: "none", border: "none", color: T.brand, fontWeight: 600, cursor: "pointer", fontSize: 12.5, fontFamily: T.sans }}>
              {mode === "signup" ? "Sign in" : "Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({ history, patient, setPatient, onSave, onClear, onDelete, onExport }) {
  const [open, setOpen] = useState({});
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <Label>History</Label>
        <div className="flex gap-2 items-center">
          {history.length > 0 ? (
            <button onClick={onExport} style={{ background: T.brand, border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: T.sans }}>Export CSV</button>
          ) : null}
          {history.length > 0 ? (
            <button onClick={onClear} style={{ background: "none", border: "1px solid " + T.hair, borderRadius: 8, padding: "5px 11px", fontSize: 12, color: T.muted, cursor: "pointer", fontFamily: T.sans }}>Clear all</button>
          ) : null}
        </div>
      </div>
      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 10, padding: "9px 12px", fontSize: 11.5, lineHeight: 1.5, marginBottom: 14 }}>
        <b>Do not enter real patient identifiers.</b> Saved cases are stored only in this browser and are not secured for real protected health information. Exported files contain whatever you enter here.
      </div>
      <div className="flex gap-2 items-end mb-3">
        <label style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 6, fontFamily: T.sans }}>Patient name</span>
          <input value={patient} onChange={(e) => setPatient(e.target.value)} placeholder="Patient name (evaluation)" style={{ width: "100%", fontFamily: T.sans, fontSize: 14, padding: "10px 12px", borderRadius: 10, border: "1px solid " + T.hair, outline: "none", color: T.ink }} />
        </label>
        <button onClick={onSave} style={{ background: T.brand, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: T.sans, whiteSpace: "nowrap" }}>Save current case</button>
      </div>
      {history.length === 0 ? (
        <div style={{ fontSize: 13, color: T.faint, fontFamily: T.sans, padding: "8px 0" }}>No saved cases yet. Enter a patient name and click "Save current case".</div>
      ) : (
        <div className="grid gap-2">
          {history.map((h) => {
            const isOpen = !!open[h.id];
            return (
              <div key={h.id} className="rounded-lg" style={{ border: "1px solid " + T.hair, background: T.paper, overflow: "hidden" }}>
                <div className="flex items-center justify-between px-3 py-2">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>{h.patient || "(unnamed)"}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 11.5, color: T.muted, marginTop: 2 }}>{h.when} · {h.indication || "—"} · INR {h.currentINR || "—"}{h.band ? " · band " + h.band : ""}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setOpen((o) => ({ ...o, [h.id]: !o[h.id] }))} style={{ background: "none", border: "1px solid " + T.hair, borderRadius: 8, padding: "4px 10px", fontSize: 11.5, color: T.muted, cursor: "pointer", fontFamily: T.sans }}>{isOpen ? "Hide" : "Details"}</button>
                    <button onClick={() => onDelete(h.id)} style={{ background: "none", border: "none", color: T.faint, fontSize: 18, cursor: "pointer", padding: "0 6px", lineHeight: 1 }} title="Remove from history">×</button>
                  </div>
                </div>
                {isOpen ? (
                  <div style={{ borderTop: "1px solid " + T.hair, padding: "12px 14px", background: T.panel }}>
                    <div style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: T.brand, marginBottom: 4 }}>Dose recommendation</div>
                    <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, lineHeight: 1.5, marginBottom: 12, whiteSpace: "pre-wrap" }}>{h.recommendation || "—"}{h.adj ? "  (adjustment: " + h.adj + ")" : ""}</div>
                    <div style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: T.brand, marginBottom: 4 }}>SOAP note</div>
                    <div style={{ fontFamily: T.mono, fontSize: 11.5, color: T.muted, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{(h.soapText || "—").split("  |  ").join("\n")}</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wf-history") || "[]"); } catch (e) { return []; }
  });
  const [patient, setPatient] = useState("");
  const snapRef = React.useRef({});

  React.useEffect(() => {
    try { localStorage.setItem("wf-history", JSON.stringify(history)); } catch (e) {}
  }, [history]);

  function saveCase() {
    const s = snapRef.current || {};
    const soapText = (function () {
      const sp = s.soap;
      if (!sp) return "";
      const plan = Array.isArray(sp.P) ? sp.P.map((l, i) => (i + 1) + ". " + l).join("  ") : (sp.P || "");
      return [
        "S: " + (sp.S || ""),
        "O: " + (sp.O || ""),
        "A: " + (sp.A || "—"),
        "P: " + plan,
      ].join("  |  ");
    })();
    const entry = {
      id: Date.now(),
      patient: patient.trim(),
      when: new Date().toLocaleString(),
      indication: s.indication || "",
      currentINR: s.currentINR || "",
      lastINR: s.lastINR || "",
      band: s.band || "",
      adj: s.adj || "",
      recommendation: s.bandText || "",
      soapText: soapText,
    };
    setHistory((h) => [entry, ...h]);
    setPatient("");
  }

  function exportCSV() {
    if (!history.length) return;
    const cols = ["when", "patient", "indication", "lastINR", "currentINR", "band", "adj", "recommendation", "soapText"];
    const esc = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const header = ["Date/time", "Patient (evaluation)", "Indication", "Last INR", "Current INR", "Band", "Adjustment", "Dose recommendation", "SOAP"];
    const rows = history.map((h) => cols.map((c) => esc(h[c])).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "warfarin-history-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!user) return <MockAuthGate onEnter={(n) => setUser(n)} />;

  return (
    <div>
      <div style={{ maxWidth: 760, margin: "16px auto -8px", padding: "0 4px", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: T.sans }}>
        <div style={{ fontSize: 13, color: T.muted }}>Signed in as <b style={{ color: T.ink }}>{user}</b> <span style={{ color: T.faint }}>(evaluation)</span></div>
        <button onClick={() => setUser(null)} style={{ background: "none", border: "1px solid " + T.hair, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, color: T.muted, cursor: "pointer", fontFamily: T.sans }}>Sign out</button>
      </div>
      <AppInner onSnapshot={(s) => { snapRef.current = s; }} />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 4px 40px" }}>
        <HistoryPanel
          history={history}
          patient={patient}
          setPatient={setPatient}
          onSave={saveCase}
          onClear={() => setHistory([])}
          onDelete={(id) => setHistory((h) => h.filter((x) => x.id !== id))}
          onExport={exportCSV}
        />
      </div>
    </div>
  );
}
