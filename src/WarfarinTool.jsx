// Warfarin Maintenance Dose-Adjustment tool — "Clinical Calm" design + full dose engine.
// Clinical bands transcribed from KSUMC Anticoagulation Clinic Guideline (March 2022), §4.2.
// Educational only — NOT for clinical use (pending clinician sign-off).
import React, { useState, useEffect, useMemo, useRef } from "react";
import "./wm.css";

/* ============================================================================
 * CLINICAL ENGINE (deterministic, design-agnostic) — transcribed from protocol
 * ==========================================================================*/
const CONFIG = {
  status: "pending-signoff",
  guideline: {
    name: "KSUMC Anticoagulation Clinic Guideline — Practice Guide (March 2022), §4.2 (nomograms adapted from Hadlock 2018)",
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
    { id: "S1", regLo: -Infinity, highLo: -Infinity, dir: "increase", pctMin: 10, pctMax: 20, conditionalNoChange: false, supplemental: true, holdOneDose: false, holdUntilTherapeutic: false, bridge: "mvr", vitK: null, level: "none", label: "Subtherapeutic (markedly low)", action: "Increase weekly maintenance dose by 10–20%. Consider a one-time supplemental dose (1.5–2× the daily maintenance dose). For mechanical valve replacement, consider LMWH bridging for 3–5 days (see bridging)." },
    { id: "S2", regLo: 1.5, highLo: 2.0, dir: "increase", pctMin: 5, pctMax: 15, conditionalNoChange: false, supplemental: true, holdOneDose: false, holdUntilTherapeutic: false, bridge: "mvr-or-vte", vitK: null, level: "none", label: "Subtherapeutic", action: "Increase weekly maintenance dose by 5–15%. Consider a one-time supplemental dose (1.5–2× the daily maintenance dose). Consider LMWH bridging for 3–5 days for mechanical valve, recent VTE, or prior VTE on warfarin (see bridging)." },
    { id: "S3", regLo: 1.8, highLo: 2.3, dir: "increase", pctMin: 5, pctMax: 10, conditionalNoChange: true, supplemental: true, holdOneDose: false, holdUntilTherapeutic: false, bridge: null, vitK: null, level: "none", label: "Marginally subtherapeutic", action: "No adjustment necessary if the last 2 INRs were in range, there is no clear explanation, and clinician judgment finds no increased thromboembolic risk (consider additional monitoring). If adjustment is needed, increase weekly maintenance dose by 5–10%. Consider a one-time supplemental dose (1.5–2× the daily maintenance dose)." },
    { id: "R", regLo: 2.0, highLo: 2.5, dir: "none", pctMin: 0, pctMax: 0, conditionalNoChange: false, supplemental: false, holdOneDose: false, holdUntilTherapeutic: false, bridge: null, vitK: null, level: "none", label: "In therapeutic range", action: "INR within therapeutic range — no dose adjustment needed." },
    { id: "P1", regLo: 3.1, highLo: 3.6, dir: "decrease", pctMin: 5, pctMax: 10, conditionalNoChange: true, supplemental: false, holdOneDose: false, holdUntilTherapeutic: false, bridge: null, vitK: null, level: "none", label: "Marginally supratherapeutic", action: "No adjustment needed if the last 2 INRs were in range, there is no clear explanation, and clinician judgment finds no increased hemorrhage risk (consider additional monitoring). If adjustment is needed, decrease weekly maintenance dose by 5–10%." },
    { id: "P2", regLo: 3.3, highLo: 3.8, dir: "decrease", pctMin: 5, pctMax: 10, conditionalNoChange: false, supplemental: false, holdOneDose: false, holdUntilTherapeutic: false, bridge: null, vitK: null, level: "none", label: "Supratherapeutic", action: "Decrease weekly maintenance dose by 5–10%." },
    { id: "P3", regLo: 3.5, highLo: 4.0, dir: "decrease", pctMin: 5, pctMax: 15, conditionalNoChange: false, supplemental: false, holdOneDose: true, holdUntilTherapeutic: false, bridge: null, vitK: null, level: "caution", label: "Supratherapeutic (consider holding 1 dose)", action: "Consider holding 1 dose. Decrease weekly maintenance dose by 5–15%." },
    { id: "P4", regLo: 4.0, highLo: 4.5, dir: "decrease", pctMin: 5, pctMax: 20, conditionalNoChange: false, supplemental: false, holdOneDose: false, holdUntilTherapeutic: true, bridge: null, vitK: "If the patient is at significant risk for bleeding, consider low-dose oral vitamin K (single dose of 1–2.5 mg orally).", level: "high", label: "Markedly supratherapeutic, no bleeding (INR >4 / >4.5 to ≤10)", action: "Hold warfarin until INR is below the upper limit of the therapeutic range. Decrease weekly maintenance dose by 5–20%. If the patient is at significant risk for bleeding, consider low-dose oral vitamin K (1–2.5 mg orally)." },
    { id: "P5", regLo: 10.0001, highLo: 10.0001, dir: "decrease", pctMin: 5, pctMax: 20, conditionalNoChange: false, supplemental: false, holdOneDose: false, holdUntilTherapeutic: true, bridge: null, vitK: "Consider oral vitamin K 2.5–5 mg; recheck INR in 12–24 h and repeat if needed. For mechanical valve replacement, use a lower oral vitamin K dose (1–2.5 mg) to avoid overcorrection.", level: "critical", label: "Critically elevated, no bleeding (INR >10)", action: "Hold warfarin until INR is below the upper limit of the therapeutic range. Consider oral vitamin K 2.5–5 mg (recheck in 12–24 h; may repeat). For mechanical valve replacement, use lower oral vitamin K (1–2.5 mg) to avoid overcorrection. Decrease weekly maintenance dose by 5–20%." },
  ],
  bridging: {
    s1: "For mechanical valve replacement, consider adding LMWH for 3–5 days as bridging until the INR reaches target with the new warfarin dose. (On-X bileaflet aortic valve: only consider LMWH if within 3 months of valve insertion.)",
    s2: "Consider LMWH for 3–5 days if the patient has a mechanical valve replacement, a VTE event within the last 4 weeks, or a previous VTE while on warfarin.",
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
    major: ["Intracranial hemorrhage (severe headache, vision change, weakness, confusion)", "Massive or overt GI bleeding", "Hematemesis / coffee-ground emesis", "Hemoptysis (coughing up blood)", "Gross hematuria (red / cola urine)", "Retroperitoneal / intraspinal / intra-ocular / intra-articular bleeding", "Bleeding with Hb drop ≥20 g/L or ≥2 units RBCs"],
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
    bleedingMinor: "Minor (self-limited) bleeding, patient stable: manage outpatient — hold / lower dose per INR band, counsel on warning signs, arrange closer INR follow-up. ED not required unless it worsens.",
    source: "KSUMC Anticoagulation Clinic Guideline (March 2022), §2.3 & §4.2. Major-bleeding reversal agents/doses are not specified in this nomogram — follow physician / institutional direction.",
  },
  followUp: {
    stable: "every 4–12 weeks if stable; every 1–2 weeks if unstable/unreliable",
    adjusted: "within 1–2 weeks (dose adjusted today)",
    held: "in 1–2 days (dose held for supratherapeutic INR without bleeding)",
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
  const parts = Object.entries(best.m).sort((a, b) => Number(b[0]) - Number(a[0])).map(([s, n]) => `${n}×${s}`);
  if (best.half) parts.push("½×1");
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
function followUpText(band, compliance, transient, hasBleeding) {
  const f = CONFIG.followUp; let base = f.stable;
  if (band) { if (band.holdOneDose || band.holdUntilTherapeutic) base = f.held; else if (band.dir !== "none") base = f.adjusted; else base = f.stable; }
  const shorten = compliance === "no" || transient || hasBleeding;
  return shorten ? `${base} — ${f.shortenNote}` : base;
}
function regimenProse(rows) { return rows.filter((r) => r.dose !== "" && r.days !== "").map((r) => `${r.dose} mg × ${r.days} day${Number(r.days) > 1 ? "s" : ""}`).join(" + "); }
function schedText(s) { if (s.low === s.high || s.nH === 0) return `${s.low} mg daily`; if (s.nL === 0) return `${s.high} mg daily`; return `${s.low} mg × ${s.nL} day${s.nL > 1 ? "s" : ""} + ${s.high} mg × ${s.nH} day${s.nH > 1 ? "s" : ""}`; }
function listJoin(items) { if (items.length === 0) return ""; if (items.length === 1) return items[0]; if (items.length === 2) return `${items[0]} and ${items[1]}`; return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`; }
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
function buildSOAP(st) {
  const { indication, lo, hi, intensity, lastINR, currentINR, rows, weekly, weekComplete, band, adj, newWeekly, schedule, supplementalMg, contributors, compliance, signs, unstable, safety, holdDays } = st;
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
  if (lo && hi) o.push(`Indication: ${ind || "warfarin therapy"} — ${intensity !== "custom" ? `${intensity}-intensity ` : ""}target INR ${lo}–${hi}.`);
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
    const statusTxt = band.id === "R" ? "within the therapeutic range" : band.id === "P5" ? "critically elevated" : band.id === "P4" ? "markedly supratherapeutic" : supra ? "supratherapeutic" : "subtherapeutic";
    const risk = (sub && valve) ? ", and clinically meaningful given the thromboembolic risk of a mechanical valve" : "";
    a.push(`INR ${currentINR} — ${statusTxt}${band.id !== "R" ? ` (KSUMC band ${band.id})` : ""}${risk}.`);
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
        a.push(`Two consecutive ${dir} readings (${lastINR} → ${currentINR}) with no precipitant identified on questioning point toward a genuine maintenance ${shortfall} rather than a transient cause; a one-off precipitant would more typically produce an isolated ${motion}, not a sustained shift.`);
      } else if (prevInRange) {
        a.push(`The prior INR was in range; this isolated ${dir} result with no clear precipitant is reasonably managed with a modest adjustment and an earlier recheck.`);
      } else {
        a.push("No clear precipitant was identified on questioning.");
      }
      if (band.conditionalNoChange) a.push("Per protocol, holding the dose unchanged is defensible if the last two INRs were in range with no clear explanation; otherwise a modest adjustment applies.");
    }
  } else if (cur) {
    a.push(`INR ${currentINR} — ${supra ? "supratherapeutic" : sub ? "subtherapeutic" : "within target"}.`);
  }
  if (safety && safety.level === "emergency") a.push("Active major bleeding / hemodynamic instability — an emergency that overrides routine dose management.");
  else if (safety && safety.level === "critical") a.push("The degree of elevation carries a meaningful hemorrhage risk and warrants holding warfarin with vitamin K per protocol.");
  else if (safety && safety.level === "high") a.push("The elevation warrants holding warfarin, with vitamin K reserved for patients at significant bleeding risk.");
  const A = a.join(" ");

  // Plan reflects ONLY what the clinical pharmacist selected — no auto-added narrative.
  const P = [];
  if (adj && adj.direction === "none") {
    P.push(`Continue the current maintenance dose${weekComplete ? ` (${weekly} mg/week, as ${regimenProse(rows)})` : (weekly ? ` (${weekly} mg/week)` : "")}.`);
  } else if (adj && newWeekly) {
    const verb = adj.direction === "increase" ? "Increase" : "Decrease";
    P.push(`${verb} weekly maintenance dose by ${adj.pct}% to ${newWeekly} mg/week${schedule ? `, as ${schedText(schedule)}` : ""}.`);
  }
  if (supplementalMg) {
    P.push(`One-time supplemental dose ${supplementalMg} mg.`);
  }
  if (holdDays > 0) {
    P.push(`Hold warfarin × ${holdDays} day${holdDays > 1 ? "s" : ""}.`);
  }
  return { S, O, A, P };
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

/* ============================================================================
 * ICONS
 * ==========================================================================*/
function IconDrop({ size = 30 }) {
  const id = useRef("d" + Math.random().toString(36).slice(2, 7)).current;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="10" y1="4" x2="22" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--crimson-bright)" /><stop offset="1" stopColor="var(--crimson)" />
        </linearGradient>
      </defs>
      <path d="M16 3 C16 3 6.5 14.2 6.5 21 a9.5 9.5 0 0 0 19 0 C25.5 14.2 16 3 16 3 Z" fill={`url(#${id})`} />
      <ellipse cx="12.4" cy="19" rx="2.2" ry="3.3" fill="#fff" opacity="0.3" transform="rotate(-18 12.4 19)" />
    </svg>
  );
}
function IconShield({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M11 2 L18.5 4.6 V10.5 C18.5 15.2 15.3 18.6 11 20 C6.7 18.6 3.5 15.2 3.5 10.5 V4.6 Z" fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M11 7.4 v4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="11" cy="14.4" r="0.95" fill={color} />
    </svg>
  );
}
function IconActivity({ size = 20, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12 H6 L9 4 L15 20 L18 12 H22" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
function IconDoc({ size = 18, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4" y="2.5" width="12" height="15" rx="2" stroke={color} strokeWidth="1.5" /><path d="M7 7 H13 M7 10 H13 M7 13 H11" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>);
}
function IconFlask({ size = 19, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8 2.5 V8 L3.8 15.2 A1.6 1.6 0 0 0 5.2 17.5 H14.8 A1.6 1.6 0 0 0 16.2 15.2 L12 8 V2.5" stroke={color} strokeWidth="1.5" strokeLinejoin="round" /><path d="M7 2.5 H13 M6.4 12 H13.6" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>);
}
function IconChevron({ size = 18, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 7.5 L10 12.5 L15 7.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
function IconCheck({ size = 13, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.3 6.2 11.5 13 4.4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
function IconCopy({ size = 15, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="6" y="6" width="9" height="10" rx="2" stroke={color} strokeWidth="1.5" /><path d="M3.5 12 V4 A2 2 0 0 1 5.5 2 H12" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>);
}
function IconTrash({ size = 15, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3.5 5 H14.5 M7 5 V3.5 H11 V5 M5 5 L5.7 15 H12.3 L13 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
function IconAlert({ size = 20, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /><path d="M12 10v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="17.4" r="1" fill={color} /></svg>);
}
function IconSiren({ size = 15, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 19v-7a5 5 0 0 1 10 0v7" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 21h16" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></svg>);
}
function IconCalendar({ size = 16, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2" stroke={color} strokeWidth="1.6" /><path d="M3.5 9.5 H20.5 M8 3 V6 M16 3 V6" stroke={color} strokeWidth="1.6" strokeLinecap="round" /></svg>);
}
function IconPill({ size = 14, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true"><rect x="2.5" y="7.5" width="17" height="7" rx="3.5" stroke={color} strokeWidth="1.6" transform="rotate(-45 11 11)" /><path d="M8 8 L14 14" stroke={color} strokeWidth="1.6" /></svg>);
}

/* ============================================================================
 * PRIMITIVES
 * ==========================================================================*/
function Card({ title, icon, tools, quiet, children }) {
  return (
    <section className={"card" + (quiet ? " quiet" : "")}>
      {title && (
        <div className="card-hd">
          {icon && <span className="ic">{icon}</span>}
          <h2 className={quiet ? "quiet-title" : "card-title serif"}>{title}</h2>
          {tools && <div className="card-tools">{tools}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
function NumberField({ label, value, onChange, suffix, placeholder = "—", error }) {
  return (
    <div>
      <label className="lbl">{label}</label>
      <div className="suffix-field">
        <input className={"input" + (error ? " err" : "")} inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
function Segmented({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button key={String(o.v)} type="button" className={"seg-btn" + (o.danger ? " danger" : "")} data-on={on} onClick={() => onChange(on ? null : o.v)}>
            {on && <span className="seg-tick"><IconCheck color="#fff" /></span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
function CheckChip({ label, on, onToggle, danger }) {
  return (
    <button type="button" className={"chk" + (danger ? " danger" : "")} data-on={on} aria-pressed={on} onClick={onToggle}>
      <span className="chk-box">{on && <IconCheck size={12} color="#fff" />}</span>
      {label}
    </button>
  );
}

/* ============================================================================
 * MAIN TOOL
 * ==========================================================================*/
function WarfarinApp() {
  const [indSel, setIndSel] = useState([0]);
  const selectedInds = indSel.map((i) => CONFIG.indications[i]);
  const indLabel = selectedInds.map((x) => x.label).join(", ");
  const [lo, setLo] = useState(CONFIG.indications[0].lo);
  const [hi, setHi] = useState(CONFIG.indications[0].hi);
  const [lastINR, setLastINR] = useState("");
  const [currentINR, setCurrentINR] = useState("");
  const [rows, setRows] = useState([{ dose: "", days: "" }]);
  const [adj, setAdj] = useState(null);
  const [stock, setStock] = useState(CONFIG.tablets.reduce((m, t) => ({ ...m, [t]: true }), {}));
  const [compliance, setCompliance] = useState(null);
  const [contributors, setContributors] = useState([]);
  const [signs, setSigns] = useState({ major: [], minor: [] });
  const [unstable, setUnstable] = useState(null);
  const [holdDays, setHoldDays] = useState("");
  const [suppChoice, setSuppChoice] = useState(null); // null | "lo" (1.5×) | "hi" (2×)
  const [bridge, setBridge] = useState({ mvr: false, onx: false, vteRecent: false, vtePrior: false });
  const [copied, setCopied] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [patient, setPatient] = useState("");
  const [cases, setCases] = useState([]);
  const [openCase, setOpenCase] = useState({});

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem("wm-cases") || "[]"); if (Array.isArray(s)) setCases(s); } catch {}
  }, []);
  const persist = (next) => { setCases(next); try { localStorage.setItem("wm-cases", JSON.stringify(next)); } catch {} };

  const toggleInd = (i) => {
    const next = indSel.includes(i) ? indSel.filter((x) => x !== i) : [...indSel, i].sort((a, b) => a - b);
    setIndSel(next);
    const sel = next.map((k) => CONFIG.indications[k]);
    if (sel.length) { const strict = sel.reduce((best, x) => (x.hi > best.hi ? x : best)); setLo(strict.lo); setHi(strict.hi); }
  };
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
  const lastInrInvalid = lastINR !== "" && (Number.isNaN(Number(lastINR)) || Number(lastINR) < CONFIG.limits.inrMin || Number(lastINR) > CONFIG.limits.inrMax);
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
  const belowTarget = !inrMissing && !inrInvalid && Number(currentINR) < Number(lo);
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
  const suppApplicable = !!(band && band.supplemental && adj && adj.direction === "increase" && supplemental);
  const supplementalMg = suppApplicable && suppChoice ? (suppChoice === "lo" ? supplemental.lo : supplemental.hi) : null;
  const soap = useMemo(() => buildSOAP({ indication: indLabel, lo, hi, intensity, lastINR, currentINR, rows, weekly, weekComplete, band, adj, newWeekly, schedule, supplementalMg, contributors, compliance, signs, unstable, safety, holdDays: holdN }),
    [indLabel, lo, hi, intensity, lastINR, currentINR, rows, weekly, weekComplete, band, adj, newWeekly, schedule, supplementalMg, contributors, compliance, signs, unstable, safety, holdN]);

  const tone = inrMissing || inrInvalid ? null : aboveTarget ? "above" : belowTarget ? "below" : "in";
  const toneChip = tone === "above" ? "Above range" : tone === "below" ? "Below range" : "In range";

  const tests = useMemo(runTests, []);
  const testsPass = tests.filter((x) => x.pass).length;

  const soapText = ["S — Subjective: " + soap.S, "", "O — Objective: " + soap.O, "", "A — Assessment: " + soap.A, "", "P — Plan:", ...soap.P.map((l, i) => `  ${i + 1}. ${l}`)].join("\n");
  const copySoap = () => { try { navigator.clipboard.writeText(soapText); } catch {} setCopied(true); setTimeout(() => setCopied(false), 1800); };

  const saveCase = () => {
    if (!patient.trim()) return;
    const entry = {
      id: Date.now(), name: patient.trim(), when: new Date().toLocaleString(),
      indication: indLabel, lo, hi, lastINR, currentINR,
      band: band ? band.id : "", recommendation: band ? band.action : "",
      adj: adj ? (adj.direction === "none" ? "no change" : `${adj.direction === "increase" ? "↑" : "↓"} ${adj.pct}%`) : "",
      newWeekly: newWeekly || "", schedule: schedule ? schedText(schedule) : "",
      soapText,
    };
    persist([entry, ...cases]); setPatient("");
  };

  const exportCSV = () => {
    if (!cases.length) return;
    const cols = ["when", "name", "indication", "lo", "hi", "lastINR", "currentINR", "band", "adj", "newWeekly", "schedule", "recommendation", "soapText"];
    const header = ["Date/time", "Patient (evaluation)", "Indication", "Target low", "Target high", "Last INR", "Current INR", "Band", "Adjustment", "New mg/week", "Schedule", "Recommendation", "SOAP"];
    const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = [header.join(","), ...cases.map((h) => cols.map((c) => esc(h[c])).join(","))].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "warfarin-history-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const AdjBtn = ({ direction, pct }) => {
    const active = adj && adj.direction === direction && adj.pct === pct;
    const inProtocol = !!band && band.dir === direction && pct >= band.pctMin && pct <= band.pctMax;
    const blocked = !canDose || direction === dirBlock;
    return (
      <button type="button" className={"adj-btn " + (direction === "increase" ? "up" : "down")} data-on={!!active} data-proto={inProtocol && !active && !blocked}
        disabled={blocked} onClick={() => !blocked && setAdj({ direction, pct })}>
        {direction === "increase" ? "↑" : "↓"} {pct}%
        {inProtocol && !active && !blocked && <span className="proto-tag">protocol</span>}
      </button>
    );
  };

  const noChangeSuggest = band && (band.dir === "none" || band.conditionalNoChange) && !(adj && adj.direction === "none");

  return (
    <main className="shell">
        <header className="banner">
          <div className="banner-tex"></div>
          <div className="banner-tile rx-tile"><span className="rx-glyph"><IconDrop size={30} /></span></div>
          <div className="banner-main">
            <h1 className="banner-title serif">Warfarin Maintenance</h1>
            <p className="banner-sub">Weekly-dose adjustment · daily schedule</p>
          </div>
          <span className="pill"><span className="pill-dot throb"></span>pending sign-off</span>
        </header>

        <div className="notice">
          <span className="notice-ic"><IconShield /></span>
          <p className="notice-tx">
            <span className="lede">PENDING SIGN-OFF.</span> The dose engine, directional lock, and validation
            are deterministic and self-tested ({testsPass}/{tests.length} checks below). The <strong>clinical bands are
            transcribed from the PPC-approved KSUMC protocol</strong> (March 2022, §4.2). Before clinical use, verify
            this transcription against the PDF and have a clinician sign off the tool. Until then, <strong>not for clinical use.</strong>
          </p>
        </div>

        {/* indication & target */}
        <Card title="Indication & INR target">
          <label className="lbl">Indication <span style={{ fontWeight: 400, color: "var(--muted)" }}>(select all that apply)</span></label>
          <div className="checks" style={{ marginBottom: "20px" }}>
            {CONFIG.indications.map((x, i) => <CheckChip key={x.label} label={x.label} on={indSel.includes(i)} onToggle={() => toggleInd(i)} />)}
          </div>
          <div className="grid2">
            <NumberField label="Target low" value={lo} onChange={setLo} suffix="INR" />
            <NumberField label="Target high" value={hi} onChange={setHi} suffix="INR" />
          </div>
          <p className="help">Auto-filled from the strictest selected indication (highest target); editable by the clinician.</p>
          <p className="help-mono">
            {intensity === "custom" ? "Custom intensity (not a standard KSUMC column) — dose direction only" : `${intensity === "high" ? "High" : "Regular"}-intensity column (target ${intensity === "high" ? "2.5–3.5" : "2–3"})`}
          </p>
        </Card>

        {/* INR */}
        <Card title="INR">
          <div className="grid2">
            <NumberField label="Last INR" value={lastINR} onChange={setLastINR} error={lastInrInvalid ? `Must be ${CONFIG.limits.inrMin}–${CONFIG.limits.inrMax}` : null} />
            <NumberField label="Current INR" value={currentINR} onChange={setCurrentINR} error={inrInvalid ? `INR must be between ${CONFIG.limits.inrMin} and ${CONFIG.limits.inrMax}` : null} />
          </div>
          {inrMissing && <p className="help">Enter the current INR to enable dose recommendations and safety checks.</p>}
          {intensity === "custom" && !inrMissing && !inrInvalid && (
            <p className="help" style={{ color: "var(--amber-strong)" }}>Custom target — the KSUMC nomogram defines bands only for 2–3 (regular) or 2.5–3.5 (high). Showing dose direction only; map the band manually.</p>
          )}
          {tone && (
            <div className="status" data-tone={tone}>
              <span className="status-chip">{toneChip}</span>
              <p className="status-tx"><strong>Current INR {currentINR}</strong>{tone === "above" ? ` is above the ${lo}–${hi} target.` : tone === "below" ? ` is below the ${lo}–${hi} target.` : ` is within the ${lo}–${hi} target.`}</p>
            </div>
          )}
          {band && (
            <div className="band-box">
              <div className="band-hd">KSUMC nomogram · band {band.id} · {intensity}-intensity</div>
              <p className="band-tx">{band.action}</p>
              <div className="band-meta">[verify against protocol §4.2]</div>
            </div>
          )}
        </Card>

        {/* stability */}
        <Card title="Clinical stability" icon={<IconActivity size={20} />}>
          <Segmented options={[{ v: false, label: "Stable" }, { v: true, label: "Unstable", danger: true }]} value={unstable}
            onChange={(v) => { setUnstable(v); if (v !== true) setSigns({ major: [], minor: [] }); }} />
          <p className="help">Unstable = dizziness / syncope, fast heart rate, low BP, breathlessness, or active severe bleeding. Unstable → ER.</p>
        </Card>

        {/* bleeding signs (only when unstable) */}
        {unstable === true && (
          <Card title="Signs / symptoms of bleeding">
            <div className="sign-grp">Minor</div>
            <div className="checks" style={{ marginBottom: "16px" }}>
              {CONFIG.bleeding.minor.map((s) => <CheckChip key={s} label={s} on={signs.minor.includes(s)} onToggle={() => toggleSign("minor", s)} />)}
            </div>
            <div className="sign-grp major">Major (→ emergency)</div>
            <div className="checks">
              {CONFIG.bleeding.major.map((s) => <CheckChip key={s} label={s} on={signs.major.includes(s)} onToggle={() => toggleSign("major", s)} danger />)}
            </div>
            <p className="help">Shown because the patient is unstable. Categorization is a proposed list — [verify] against your source.</p>
          </Card>
        )}

        {/* safety alert */}
        {safety && (
          <div className="alert" data-sev={safety.suppress ? "hi" : "mid"} role="alert" aria-live={safety.suppress ? "assertive" : "polite"}>
            <span className="alert-ic">{safety.suppress ? <IconAlert size={20} /> : <IconShield size={20} />}</span>
            <div className="alert-bd">
              <div className="alert-lv">{safety.level}</div>
              <p className="alert-tx">{safety.text}</p>
              {safety.er && <div className="alert-er"><IconSiren size={15} /> Refer to Emergency Department / urgent physician now.</div>}
            </div>
          </div>
        )}

        {/* possible dose hold */}
        {showHold && (
          <Card title={`Possible dose hold ${unstable === true ? "(patient unstable)" : "(INR above target)"}`} icon={<IconCalendar size={18} />}>
            <NumberField label="Hold warfarin for" value={holdDays} onChange={setHoldDays} suffix="day(s)" placeholder="0" />
            <p className="help">{unstable === true ? "Consider holding pending stabilization / reversal." : "A hold may be clinically indicated for a supratherapeutic INR."} Optional — added to the case summary. [verify]</p>
          </Card>
        )}

        {/* thromboembolic risk / bridging factors */}
        <Card title="Thromboembolic risk factors">
          <p className="subhead">For LMWH bridging consideration if subtherapeutic:</p>
          <div className="checks">
            {CONFIG.bridgeFactors.map((bf) => <CheckChip key={bf.key} label={bf.label} on={bridge[bf.key]} onToggle={() => setBridge((s) => ({ ...s, [bf.key]: !s[bf.key] }))} />)}
          </div>
          <p className="help">Per §4.2, LMWH bridging is considered for a subtherapeutic INR with mechanical valve replacement, a VTE within the last 4 weeks, or a previous VTE while on warfarin.</p>
        </Card>

        {/* previous weekly doses */}
        <Card title="Previous weekly doses">
          <div className="dose-head"><span>Dose (mg)</span><span>Days / week</span><span className="r">= mg</span></div>
          {visibleRows.map((r, i) => {
            const filledBefore = totalDays(visibleRows.slice(0, i).filter((x) => x.dose !== "" && x.days !== ""));
            const maxDays = Math.max(1, 7 - filledBefore);
            return (
              <div key={i} className="dose-row">
                <input className="input-sm" type="number" inputMode="decimal" value={r.dose} placeholder="e.g. 5.5" onChange={(e) => updateRow(i, "dose", e.target.value)} />
                <select className="select-sm" value={r.days} onChange={(e) => updateRow(i, "days", e.target.value)}>
                  <option value="">days</option>
                  {Array.from({ length: maxDays }, (_, k) => k + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <span className="mg">{r.dose && r.days ? round1(Number(r.dose) * Number(r.days)) : "—"}</span>
              </div>
            );
          })}
          <div className="dose-foot">
            <span className={"days" + (remainingDays === 0 ? "" : " warn")}>{remainingDays === 0 ? "7 / 7 days" : `${7 - remainingDays} / 7 days — ${remainingDays} remaining`}</span>
            <span className={"tot" + (weeklyInvalid ? " warn" : weekComplete ? "" : " muted")}>{weekComplete ? `Total: ${weekly} mg/week` : `${weekly} mg…`}</span>
          </div>
          {weeklyInvalid && <p className="field-error">Weekly dose exceeds {CONFIG.limits.weeklyMax} mg — please re-check the entries.</p>}
        </Card>

        {/* dose action */}
        <Card title="Dose action">
          {!canDose && <p className="gate-disabled">{weekComplete ? (inrMissing ? "Enter a valid current INR to enable dose actions." : (inrInvalid ? "Current INR is out of range." : "Weekly dose is out of range.")) : "Complete a 7-day regimen above to enable dose actions."}</p>}
          <button type="button" className="btn-nochange" data-on={!!(adj && adj.direction === "none")} data-suggest={!!noChangeSuggest} disabled={!canDose} onClick={() => canDose && setAdj({ direction: "none", pct: 0 })}>
            <IconCheck size={15} /> No change — maintain current dose
            {noChangeSuggest && <span className="proto-tag">{band.dir === "none" ? "in range" : "maybe"}</span>}
          </button>
          {dirBlock && (
            <div className="dirlock" role="status" aria-live="polite">
              <span style={{ flex: "0 0 auto", marginTop: "1px", color: "var(--crimson)" }}><IconShield size={15} /></span>
              <span className="tx">{dirBlock === "increase" ? "INR above target — dose INCREASE blocked. Only reduction (↓) is appropriate." : "INR below target — dose REDUCTION blocked. Only increase (↑) is appropriate."}</span>
            </div>
          )}
          <div className="adj-sub">Reduce weekly dose</div>
          <div className="adj-grid"><AdjBtn direction="decrease" pct={5} /><AdjBtn direction="decrease" pct={10} /><AdjBtn direction="decrease" pct={15} /><AdjBtn direction="decrease" pct={20} /></div>
          <div className="adj-sub">Increase weekly dose</div>
          <div className="adj-grid"><AdjBtn direction="increase" pct={5} /><AdjBtn direction="increase" pct={10} /><AdjBtn direction="increase" pct={15} /><AdjBtn direction="increase" pct={20} /></div>
          {band && band.dir !== "none" && <p className="proto-note">Protocol range for band {band.id}: <b>{band.dir === "increase" ? "↑" : "↓"} {band.pctMin}–{band.pctMax}%</b> (highlighted above).</p>}
          {band && band.conditionalNoChange && <p className="proto-note amber">Per protocol, no change may be appropriate if the last 2 INRs were in range with no clear cause — clinician judgment.</p>}
          {suppApplicable && (
            <div style={{ marginTop: "14px" }}>
              <div className="adj-sub" style={{ marginTop: 0 }}>One-time supplemental (booster) dose</div>
              <Segmented
                options={[{ v: "lo", label: `${supplemental.lo} mg · 1.5×` }, { v: "hi", label: `${supplemental.hi} mg · 2×` }]}
                value={suppChoice} onChange={setSuppChoice} />
              <p className="proto-note">Optional — choose 1.5× or 2× the ~{supplemental.daily} mg new daily dose. The selected dose is added to the SOAP Plan. <span className="mono" style={{ fontSize: "10px" }}>[verify]</span></p>
            </div>
          )}
          {newWeekly !== null && adj && adj.direction !== "none" && (
            <div className="calc-line">{weekly} × {adj.direction === "increase" ? "1+" : "1−"}{adj.pct / 100} = {round1(weekly * (adj.direction === "increase" ? 1 + adj.pct / 100 : 1 - adj.pct / 100))} → rounded <b>{newWeekly} mg/week</b></div>
          )}
        </Card>

        {/* bridging callout */}
        {bridging && (
          <div className="alert" data-sev="mid">
            <span className="alert-ic"><IconActivity size={20} /></span>
            <div className="alert-bd">
              <div className="alert-lv">Consider LMWH bridging</div>
              <p className="alert-tx">{bridging.text}</p>
              <p className="alert-tx" style={{ marginTop: "6px", color: "var(--muted)" }}>{bridging.note} <span className="mono" style={{ fontSize: "10px" }}>[verify §4.2]</span></p>
            </div>
          </div>
        )}

        {/* recommended schedule */}
        {schedule && (
          <Card title="Recommended weekly schedule" icon={<IconPill size={16} />}>
            {step === 1 && <p className="sched-note">1 mg unavailable — using whole-milligram dosing.</p>}
            {scheduleGroups.map((g, i) => {
              const br = makeDose(g.dose, inStock, CONFIG.allowHalves);
              return (
                <div key={i} className="sched-row">
                  <span className="sched-dose">{g.dose} mg</span>
                  <span className="sched-freq">{g.n}×/wk</span>
                  <span className={"sched-break" + (br.ok ? "" : " no")}>{br.ok ? br.parts.join(" ") : "not deliverable"}</span>
                </div>
              );
            })}
            <div className="sched-foot">
              <span>Total: <b>{schedule.achieved} mg/week</b></span>
              <span>Δ target: {schedule.deviation >= 0 ? "+" : ""}{schedule.deviation} mg</span>
            </div>
            <div className="tabs-hd"><IconPill size={13} /> Tablet availability (uncheck if out of stock → re-solves)</div>
            <div className="tabs">
              {CONFIG.tablets.map((tb) => (
                <button key={tb} type="button" className="tab-chip" data-on={!!stock[tb]} aria-pressed={!!stock[tb]} onClick={() => setStock((s) => ({ ...s, [tb]: !s[tb] }))}>{tb} mg</button>
              ))}
            </div>
          </Card>
        )}

        {/* context & follow-up */}
        <Card title="Context & follow-up">
          <p className="subhead">Possible contributing factors (check any present):</p>
          <div className="checks">
            {CONFIG.contributors.map((c) => <CheckChip key={c.label} label={c.label} on={contributors.includes(c.label)} onToggle={() => toggleContrib(c.label)} />)}
          </div>
          <label className="lbl" style={{ marginTop: "22px" }}>Adherent / compliant?</label>
          <Segmented options={[{ v: "yes", label: "Yes" }, { v: "no", label: "No", danger: true }]} value={compliance} onChange={setCompliance} />
          {transient && (
            <div className="alert" data-sev="mid" style={{ marginTop: "16px" }}>
              <span className="alert-ic"><IconShield size={18} /></span>
              <div className="alert-bd"><p className="alert-tx">A transient / explained cause may account for the INR. Consider <b>deferring the maintenance dose change</b> and rechecking, rather than re-dosing now.</p></div>
            </div>
          )}
          {(transient || compliance) && (
            <div className="band-box" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <IconCalendar size={16} color="var(--teal-700)" />
              <span style={{ fontSize: "13px", color: "var(--ink-soft)" }}>Suggested follow-up INR: <b>{followUp}</b> <span className="mono" style={{ fontSize: "10px", color: "var(--faint)" }}>[verify]</span></span>
            </div>
          )}
        </Card>

        {/* SOAP */}
        <Card title="Case summary (SOAP)" tools={
          <button className="btn-copy" data-done={copied} onClick={copySoap}>
            {copied ? <><IconCheck size={12} color="var(--green)" /> Copied</> : <><IconCopy /> Copy</>}
          </button>}>
          <div className="soap-row"><span className="soap-letter serif s shine-text">S</span><div><span className="soap-key">Subjective</span><div className="soap-body">{soap.S}</div></div></div>
          <div className="soap-row"><span className="soap-letter serif o shine-text">O</span><div><span className="soap-key">Objective</span><div className="soap-body">{soap.O || "—"}</div></div></div>
          <div className="soap-row"><span className="soap-letter serif a shine-text">A</span><div><span className="soap-key">Assessment</span><div className="soap-body">{soap.A || "—"}</div></div></div>
          <div className="soap-row"><span className="soap-letter serif p shine-text">P</span><div><span className="soap-key">Plan</span><div className="soap-body">{soap.P.length ? <ol>{soap.P.map((l, i) => <li key={i}>{l}</li>)}</ol> : "—"}</div></div></div>
          <p className="soap-foot">Auto-generated from entries. The Plan reflects the tool's recommendation — still <span className="mono">pending sign-off</span>.</p>
        </Card>

        {/* provenance */}
        <Card title="Provenance" icon={<IconDoc size={18} />} quiet>
          <p className="quiet-tx">
            Dose engine, directional lock, validation: deterministic, tested. Clinical bands:
            <strong> {CONFIG.guideline.name}.</strong> {CONFIG.safety.source} {CONFIG.guideline.note}
          </p>
        </Card>

        {/* self-test */}
        <div>
          <div className="selftest" data-open={testOpen} onClick={() => setTestOpen((o) => !o)}>
            <span className="ic"><IconFlask /></span>
            <span className="selftest-name">Engine self-test</span>
            <span className="selftest-count" style={{ color: testsPass === tests.length ? "var(--green)" : "var(--crimson)" }}>{testsPass}/{tests.length} passing</span>
            <span className="chev"><IconChevron /></span>
          </div>
          {testOpen && (
            <div className="selftest-body">
              {tests.map((x, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "4px 0" }}>
                  <span><span className="ok" style={{ color: x.pass ? "var(--green)" : "var(--crimson)" }}>{x.pass ? "✓" : "✗"}</span> {x.n}</span>
                  <span className="mono" style={{ fontSize: "11px", color: x.pass ? "var(--faint)" : "var(--crimson)" }}>{String(x.got)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="foot"><strong>Not for clinical use</strong> — verify all dosing against the official KSUMC Anticoagulation Guideline; consult Ambulatory Care Clinical Pharmacist.</p>

        {/* history */}
        <Card title="History" tools={
          cases.length > 0 ? (
            <div className="hist-tools">
              <button className="btn-export" onClick={exportCSV}>Export CSV</button>
              <button className="hist-clear" onClick={() => persist([])}>Clear all</button>
            </div>
          ) : null}>
          <div className="notice" style={{ marginBottom: "22px" }}>
            <span className="notice-ic"><IconShield size={18} /></span>
            <p className="notice-tx"><strong>Do not enter real patient identifiers.</strong> Saved cases are stored only in this browser and are not secured for real protected health information. Exported files contain whatever you enter here.</p>
          </div>
          <div className="hist-row">
            <div className="grow">
              <label className="lbl">Patient name</label>
              <input className="input" value={patient} placeholder="Patient name (evaluation)" onChange={(e) => setPatient(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveCase()} />
            </div>
            <button className="btn-primary" onClick={saveCase}>Save current case</button>
          </div>
          {cases.length === 0
            ? <p className="hist-empty">No saved cases yet. Enter a patient name and click “Save current case”.</p>
            : <ul className="hist-list">
                {cases.map((c) => {
                  const isOpen = !!openCase[c.id];
                  return (
                    <li key={c.id} className="hist-item col">
                      <div className="row1">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className="nm">{c.name || "(unnamed)"}</span>
                          <div className="mono" style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>{c.indication || "—"} · INR {c.currentINR || "—"}{c.band ? " · band " + c.band : ""}{c.adj ? " · " + c.adj : ""} · {c.when}</div>
                        </div>
                        <button className="hist-btn" onClick={() => setOpenCase((o) => ({ ...o, [c.id]: !o[c.id] }))}>{isOpen ? "Hide" : "Details"}</button>
                        <button className="del" onClick={() => persist(cases.filter((x) => x.id !== c.id))} aria-label="Delete"><IconTrash /></button>
                      </div>
                      {isOpen && (
                        <div className="hist-detail">
                          <span className="k">Dose recommendation</span>
                          {c.recommendation || "—"}{c.newWeekly ? `  →  ${c.newWeekly} mg/week (${c.schedule})` : ""}
                          <span className="k">SOAP note</span>
                          <div className="soap">{c.soapText || "—"}</div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>}
        </Card>
      </main>
  );
}

export default WarfarinApp;
