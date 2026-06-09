import React, { useState, useMemo } from "react";

/**
 * AmbuScribe — Ambulatory Care SOAP Note Assistant (Diabetes / T2DM module)
 * Single-file React tool. Fully deterministic: the note (S/O/A, Plan, completeness
 * check) is assembled locally from the structured inputs. No network requests are
 * made and nothing is stored — all data lives in component state and is gone when
 * the page closes. Plain-text, copy-pasteable SOAP output for EHR entry.
 */

// ---------------------------------------------------------------------------
// Shared option lists
// ---------------------------------------------------------------------------
const ADHERENCE_OPTS = ["Good", "Fair", "Poor", "Not assessed"];

const PMH_OPTIONS = [
  "T2DM", "Hypertension", "Dyslipidemia", "CKD", "ASCVD / CAD", "Heart failure",
  "Obesity", "Diabetic retinopathy", "Diabetic neuropathy", "Diabetic nephropathy",
  "NAFLD", "OSA", "Hypothyroidism", "Depression / anxiety",
];

const HYPO_FREQ = ["None", "Rare (<1/week)", "Occasional (1-3/week)", "Frequent (>3/week)", "Daily"];
const HYPO_SEV = ["None", "Mild (self-treated)", "Moderate", "Severe (required assistance)"];

// Supervising clinical pharmacists (preceptors) for the attestation line.
const PRECEPTORS = [
  "Dr. Bashayr Alsuwayni",
  "Prof. Abdulaziz Alhossan",
  "Dr. Nasir Binshannar",
  "Dr. Ghada Bawazeer",
  "Dr. Eman Alfi",
  "Dr. Nawar Alotaibi",
];

const GLUCOSE_TYPES = [
  { label: "Fasting", unit: "mg/dL" },
  { label: "Pre-meal", unit: "mg/dL" },
  { label: "2-hr post-prandial", unit: "mg/dL" },
  { label: "Bedtime", unit: "mg/dL" },
  { label: "Overnight (3 AM)", unit: "mg/dL" },
  { label: "Random", unit: "mg/dL" },
  { label: "Meter average", unit: "mg/dL" },
];

const LAB_TYPES_DM = [
  { label: "CrCl", unit: "mL/min" },
  { label: "SCr", unit: "mg/dL" },
  { label: "A/C", unit: "mg/g" },
  { label: "Potassium", unit: "mmol/L" },
  { label: "LDL-C", unit: "mmol/L" },
  { label: "HDL-C", unit: "mmol/L" },
  { label: "Triglycerides", unit: "mmol/L" },
  { label: "Total cholesterol", unit: "mmol/L" },
  { label: "ALT", unit: "U/L" },
  { label: "AST", unit: "U/L" },
  { label: "Vitamin B12", unit: "pg/mL" },
];

// ---------------------------------------------------------------------------
// Diabetes formulary (common FDA-approved single-agent strengths + frequencies)
// Insulins use a free-text "units" dose instead of a strength dropdown.
// ---------------------------------------------------------------------------
const DM_MEDS = [
  { class: "Biguanides", drugs: [
    { id: "metformin", name: "Metformin (IR)", strengths: ["500 mg", "850 mg", "1000 mg"], freqs: ["OD", "BID", "TID"] },
    { id: "metformin_xr", name: "Metformin XR", strengths: ["500 mg", "750 mg", "1000 mg"], freqs: ["OD", "BID"] },
  ]},
  { class: "SGLT2 inhibitors", drugs: [
    { id: "empagliflozin", name: "Empagliflozin", strengths: ["10 mg", "25 mg"], freqs: ["OD"] },
    { id: "dapagliflozin", name: "Dapagliflozin", strengths: ["5 mg", "10 mg"], freqs: ["OD"] },
    { id: "canagliflozin", name: "Canagliflozin", strengths: ["100 mg", "300 mg"], freqs: ["OD"] },
    { id: "ertugliflozin", name: "Ertugliflozin", strengths: ["5 mg", "15 mg"], freqs: ["OD"] },
  ]},
  { class: "GLP-1 / GIP receptor agonists", drugs: [
    { id: "sema_sc", name: "Semaglutide SC (Ozempic)", strengths: ["0.25 mg", "0.5 mg", "1 mg"], freqs: ["Once weekly"] },
    { id: "sema_oral", name: "Semaglutide oral (Rybelsus)", strengths: ["3 mg", "7 mg", "14 mg"], freqs: ["OD"] },
    { id: "dulaglutide", name: "Dulaglutide (Trulicity)", strengths: ["0.75 mg", "1.5 mg", "3 mg", "4.5 mg"], freqs: ["Once weekly"] },
    { id: "liraglutide", name: "Liraglutide (Victoza)", strengths: ["0.6 mg", "1.2 mg", "1.8 mg"], freqs: ["OD"] },
    { id: "exenatide", name: "Exenatide (Byetta)", strengths: ["5 mcg", "10 mcg"], freqs: ["BID"] },
    { id: "exenatide_er", name: "Exenatide ER (Bydureon)", strengths: ["2 mg"], freqs: ["Once weekly"] },
    { id: "tirzepatide", name: "Tirzepatide (Mounjaro)", strengths: ["2.5 mg", "5 mg", "7.5 mg", "10 mg", "12.5 mg", "15 mg"], freqs: ["Once weekly"] },
  ]},
  { class: "DPP-4 inhibitors", drugs: [
    { id: "sitagliptin", name: "Sitagliptin", strengths: ["25 mg", "50 mg", "100 mg"], freqs: ["OD"] },
    { id: "linagliptin", name: "Linagliptin", strengths: ["5 mg"], freqs: ["OD"] },
    { id: "saxagliptin", name: "Saxagliptin", strengths: ["2.5 mg", "5 mg"], freqs: ["OD"] },
    { id: "alogliptin", name: "Alogliptin", strengths: ["6.25 mg", "12.5 mg", "25 mg"], freqs: ["OD"] },
  ]},
  { class: "Sulfonylureas", drugs: [
    { id: "glimepiride", name: "Glimepiride", strengths: ["1 mg", "2 mg", "4 mg"], freqs: ["OD"] },
    { id: "glipizide", name: "Glipizide", strengths: ["5 mg", "10 mg"], freqs: ["OD", "BID"] },
    { id: "glipizide_xl", name: "Glipizide XL", strengths: ["2.5 mg", "5 mg", "10 mg"], freqs: ["OD"] },
    { id: "glyburide", name: "Glyburide", strengths: ["1.25 mg", "2.5 mg", "5 mg"], freqs: ["OD", "BID"] },
  ]},
  { class: "Thiazolidinedione", drugs: [
    { id: "pioglitazone", name: "Pioglitazone", strengths: ["15 mg", "30 mg", "45 mg"], freqs: ["OD"] },
  ]},
  { class: "Meglitinides", drugs: [
    { id: "repaglinide", name: "Repaglinide", strengths: ["0.5 mg", "1 mg", "2 mg"], freqs: ["With meals (AC)"] },
    { id: "nateglinide", name: "Nateglinide", strengths: ["60 mg", "120 mg"], freqs: ["With meals (AC)"] },
  ]},
  { class: "Alpha-glucosidase inhibitor", drugs: [
    { id: "acarbose", name: "Acarbose", strengths: ["25 mg", "50 mg", "100 mg"], freqs: ["TID with meals"] },
  ]},
  { class: "Basal insulin (single daily/BID dose)", drugs: [
    { id: "glargine", name: "Insulin glargine U-100 (Lantus/Basaglar)", insulin: "basal", freqs: ["OD", "BID"] },
    { id: "glargine300", name: "Insulin glargine U-300 (Toujeo)", insulin: "basal", freqs: ["OD"] },
    { id: "detemir", name: "Insulin detemir (Levemir)", insulin: "basal", freqs: ["OD", "BID"] },
    { id: "degludec", name: "Insulin degludec (Tresiba)", insulin: "basal", freqs: ["OD"] },
    { id: "nph", name: "Insulin NPH", insulin: "basal", freqs: ["OD", "BID"] },
  ]},
  { class: "Prandial / other insulin (dosed per meal)", drugs: [
    { id: "aspart", name: "Insulin aspart (Novolog)", insulin: "prandial", meals: ["Breakfast", "Lunch", "Dinner"] },
    { id: "lispro", name: "Insulin lispro (Humalog)", insulin: "prandial", meals: ["Breakfast", "Lunch", "Dinner"] },
    { id: "glulisine", name: "Insulin glulisine (Apidra)", insulin: "prandial", meals: ["Breakfast", "Lunch", "Dinner"] },
    { id: "regular", name: "Regular insulin (Humulin R/Novolin R)", insulin: "prandial", meals: ["Breakfast", "Lunch", "Dinner"] },
    { id: "mix7030", name: "Insulin 70/30 (premixed)", insulin: "prandial", meals: ["Breakfast", "Dinner"] },
  ]},
];

const MED_DBS = { diabetes: DM_MEDS };

// Selectable insulin unit doses (1-100 units).
const UNITS = Array.from({ length: 100 }, (_, i) => String(i + 1));

// Date picker option lists (current year back 6 years; zero-padded months/days).
const NOW_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, i) => String(NOW_YEAR - i));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

function formatDate(v) {
  if (!v) return "";
  if (v.year && v.month && v.day) return `${v.year}/${v.month}/${v.day}`;
  return [v.year, v.month, v.day].filter(Boolean).join("/");
}

// Format one regimen entry into a readable string (shared by builder + serializer).
function formatMed(m) {
  if (m.kind === "prandial") {
    const filled = Object.entries(m.meals || {}).filter(([, u]) => u && String(u).trim());
    if (!filled.length) return m.name;
    return `${m.name}: ` + filled.map(([meal, u]) => `${u} units ${meal.toLowerCase()}`).join(", ");
  }
  if (m.kind === "basal") {
    const dose = m.dose ? `${m.dose} units` : "";
    return [m.name, dose, m.freq].filter(Boolean).join(" ");
  }
  return [m.name, m.dose, m.freq].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Encounter definitions
// ---------------------------------------------------------------------------
const ENCOUNTERS = {
  diabetes: {
    label: "Diabetes (T2DM)",
    guideline: "the ADA Standards of Care in Diabetes (current edition)",
    fields: [
      { id: "pmh", label: "Past medical history", type: "chips", options: PMH_OPTIONS, otherLabel: "Other conditions" },
      { id: "a1cCurrent", label: "Current HbA1c", type: "valuedate", valuePlaceholder: "e.g., 8.4", valueUnit: "%" },
      { id: "a1cPrior", label: "Prior HbA1c", type: "valuedate", valuePlaceholder: "e.g., 9.1", valueUnit: "%" },
      { id: "a1cTarget", label: "Target HbA1c", type: "text", suffix: "%", placeholder: "e.g., <7" },
      { id: "glucose", label: "Home glucose readings", type: "valuebuilder", options: GLUCOSE_TYPES, defaults: ["Fasting", "2-hr post-prandial"] },
      { id: "regimen", label: "Current diabetes regimen", type: "medbuilder", db: "diabetes" },
      { id: "homeMeds", label: "Home medications (other than DM medications)", type: "medtable", minRows: 1 },
      { id: "adherence", label: "Adherence", type: "select", options: ADHERENCE_OPTS },
      { id: "hypoFreq", label: "Hypoglycemia frequency", type: "select", options: HYPO_FREQ },
      { id: "hypoSev", label: "Hypoglycemia severity", type: "select", options: HYPO_SEV },
      { id: "hypoNote", label: "Hypoglycemia details (timing, triggers, awareness)", type: "text" },
      { id: "hyperglycemia", label: "Hyperglycemia symptoms", type: "text", placeholder: "Polyuria, polydipsia, blurred vision, fatigue, none reported..." },
      { id: "vitals", label: "Vitals", type: "group", fields: [
        { id: "weight", label: "Weight", placeholder: "kg" },
        { id: "bmi", label: "BMI", placeholder: "kg/m2" },
        { id: "sbp", label: "Systolic BP", placeholder: "mmHg" },
        { id: "dbp", label: "Diastolic BP", placeholder: "mmHg" },
        { id: "hr", label: "HR", placeholder: "bpm" },
      ]},
      { id: "labs", label: "Relevant labs", type: "valuebuilder", options: LAB_TYPES_DM, typePlaceholder: "Lab test", valueHint: "Value" },
      { id: "ldlTarget", label: "Target LDL", type: "text", placeholder: "e.g., <55 mg/dL or <1.4 mmol/L" },
      { id: "ascvdRisk", label: "ASCVD 10-year risk score (optional)", type: "text", placeholder: "e.g., 12.5%" },
      { id: "followup", label: "Follow-up interval", type: "text", fullWidth: true },
    ],
  },
};


// ---------------------------------------------------------------------------
// Field value helpers (presence + serialization to text for the model)
// ---------------------------------------------------------------------------
function fieldHasValue(f, val) {
  switch (f.type) {
    case "chips":
      return !!(val && ((val.selected && val.selected.length) || (val.other && val.other.trim())));
    case "valuebuilder":
    case "medbuilder":
      return Array.isArray(val) && val.length > 0;
    case "medtable":
      return Array.isArray(val) && val.some((r) => r && r.drug && r.drug.trim());
    case "group":
      return !!(val && Object.values(val).some((v) => v && String(v).trim()));
    case "valuedate":
      return !!(val && (val.value || val.year || val.month || val.day));
    default:
      return !!(val && String(val).trim());
  }
}

function cleanLabel(label) {
  return label.replace(/\s*\(optional\)\s*$/i, "");
}

function serializeField(f, val) {
  switch (f.type) {
    case "chips": {
      const sel = (val && val.selected) || [];
      const other = (val && val.other ? val.other.trim() : "");
      const parts = [...sel];
      if (other) parts.push(other);
      return parts.length ? `${cleanLabel(f.label)}: ${parts.join(", ")}` : null;
    }
    case "valuebuilder": {
      if (!Array.isArray(val) || !val.length) return null;
      const defs = f.defaults || [];
      const rank = (t) => { const i = defs.indexOf(t); return i === -1 ? 999 : i; };
      const ordered = [...val].sort((a, b) => rank(a.type) - rank(b.type));
      const items = ordered.map((e) => `${e.type} ${e.value}${e.unit ? " " + e.unit : ""}`);
      return `${cleanLabel(f.label)}: ${items.join("; ")}`;
    }
    case "medbuilder": {
      if (!Array.isArray(val) || !val.length) return null;
      return `${cleanLabel(f.label)}: ${val.map(formatMed).join("; ")}`;
    }
    case "medtable": {
      if (!Array.isArray(val)) return null;
      const rows = val
        .filter((r) => r && r.drug && r.drug.trim())
        .map((r) => [r.drug, r.dose, r.freq].map((x) => (x || "").trim()).filter(Boolean).join(" "));
      return rows.length ? `${cleanLabel(f.label)}: ${rows.join("; ")}` : null;
    }
    case "group": {
      const obj = val || {};
      const parts = [];
      f.fields.forEach((sf) => {
        if (sf.id === "dbp") return; // emitted together with systolic
        if (sf.id === "sbp") {
          const sbp = obj.sbp && String(obj.sbp).trim();
          const dbp = obj.dbp && String(obj.dbp).trim();
          if (sbp || dbp) parts.push(`BP ${sbp || "?"}/${dbp || "?"} mmHg`);
          return;
        }
        const v = obj[sf.id] && String(obj[sf.id]).trim();
        if (v) parts.push(`${sf.label} ${v}`);
      });
      return parts.length ? `${cleanLabel(f.label)}: ${parts.join("; ")}` : null;
    }
    case "valuedate": {
      let v = (val && val.value ? String(val.value).trim() : "");
      if (v && f.valueUnit && !v.endsWith(f.valueUnit)) v = v + f.valueUnit;
      const dateStr = formatDate(val);
      const lbl = cleanLabel(f.label);
      if (v && dateStr) return `${lbl}: ${v} on ${dateStr}`;
      if (v) return `${lbl}: ${v}`;
      if (dateStr) return `${lbl}: dated ${dateStr}`;
      return null;
    }
    default: {
      const raw = val && String(val).trim();
      if (!raw) return null;
      const out = f.suffix && !raw.endsWith(f.suffix) ? raw + f.suffix : raw;
      return `${cleanLabel(f.label)}: ${out}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Deterministic S/O/A assembly (built from structured inputs, no API needed)
// ---------------------------------------------------------------------------
function firstNumber(str) {
  const m = String(str == null ? "" : str).match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

// LDL-C / HDL-C entered in mmol/L convert to mg/dL by x38.67.
// Returns the rounded mg/dL number, or null if not an LDL/HDL value.
const CHOL_MMOL_TO_MGDL = 38.67;
function cholMgDl(type, valueStr) {
  if (!/ldl|hdl/i.test(type || "")) return null;
  const n = firstNumber(valueStr);
  return n == null ? null : Math.round(n * CHOL_MMOL_TO_MGDL);
}

const S_KEYWORDS = ["history", "adherence", "symptom", "hypoglycemia", "readiness", "withdrawal", "concern", "reason for visit", "past medical", "quit", "bleeding"];

function bucketOf(field) {
  if (field.bucket) return field.bucket;
  if (/follow-?up/i.test(field.label)) return "P"; // handled in the Plan, not S/O
  const l = field.label.toLowerCase();
  return S_KEYWORDS.some((k) => l.includes(k)) ? "S" : "O";
}

// Rule-based Assessment for the fully-structured Diabetes encounter.
function buildAssessment(enc, formData) {
  if (enc !== ENCOUNTERS.diabetes) {
    return "Clinical assessment to be completed by the pharmacist based on the data above.";
  }
  const parts = [];
  const a1c = firstNumber(formData.a1cCurrent && formData.a1cCurrent.value);
  const a1cPrior = firstNumber(formData.a1cPrior && formData.a1cPrior.value);
  const target = firstNumber(formData.a1cTarget);
  if (a1c != null) {
    let s = `Type 2 diabetes with a current HbA1c of ${a1c}%`;
    if (target != null) s += a1c >= target ? `, above the individualized goal of <${target}% (uncontrolled)` : `, below the individualized goal of <${target}% (at goal)`;
    if (a1cPrior != null) s += a1cPrior > a1c ? `, improved from a prior ${a1cPrior}%` : a1cPrior < a1c ? `, worsened from a prior ${a1cPrior}%` : `, unchanged from a prior ${a1cPrior}%`;
    parts.push(s + ".");
  }
  const glu = Array.isArray(formData.glucose) ? formData.glucose : [];
  const fasting = glu.find((e) => /fasting/i.test(e.type));
  if (fasting) {
    const fv = firstNumber(fasting.value);
    if (fv != null) parts.push(`Fasting glucose ${fv} mg/dL is ${fv > 130 ? "above" : fv < 80 ? "below" : "within"} the preprandial target of 80-130 mg/dL${fv > 130 ? ", suggesting room to up-titrate basal insulin if prescribed" : ""}.`);
  }
  const postprandial = glu.find((e) => /post-?prandial/i.test(e.type));
  if (postprandial) {
    const pv = firstNumber(postprandial.value);
    if (pv != null) parts.push(`2-hour post-prandial glucose ${pv} mg/dL is ${pv >= 180 ? "above" : "within"} the <180 mg/dL postprandial target.`);
  }
  const sbpV = firstNumber(formData.vitals && formData.vitals.sbp);
  const dbpV = firstNumber(formData.vitals && formData.vitals.dbp);
  if (sbpV != null && dbpV != null) {
    parts.push(`Blood pressure ${sbpV}/${dbpV} mmHg is ${sbpV >= 130 || dbpV >= 80 ? "above" : "at or below"} the <130/80 mmHg target for most adults with diabetes.`);
  }
  const labs = Array.isArray(formData.labs) ? formData.labs : [];
  const pmhSel = (formData.pmh && formData.pmh.selected) || [];
  const ascvd = pmhSel.some((x) => /ascvd|cad/i.test(x));
  const ldlEntry = labs.find((e) => /ldl/i.test(e.type));
  if (ldlEntry) {
    const rawLdl = firstNumber(ldlEntry.value);
    const isMmol = /mmol/i.test(ldlEntry.unit || "");
    const ldlMgDl = rawLdl == null ? null : (isMmol ? Math.round(rawLdl * CHOL_MMOL_TO_MGDL) : rawLdl);
    // Target LDL may be entered in mg/dL (default) or mmol/L (auto-detected and converted).
    const targetRaw = (formData.ldlTarget || "").trim();
    let targetNum = firstNumber(targetRaw);
    if (targetNum != null && /mmol/i.test(targetRaw)) targetNum = Math.round(targetNum * CHOL_MMOL_TO_MGDL);
    const goal = targetNum != null ? targetNum : (ascvd ? 55 : 100);
    const rationale = targetNum != null ? " documented goal" : (ascvd ? " goal for established ASCVD" : " goal");
    if (ldlMgDl != null) {
      const orig = isMmol ? ` (${rawLdl} mmol/L)` : "";
      parts.push(`LDL-C ${ldlMgDl} mg/dL${orig} is ${ldlMgDl >= goal ? "above" : "below"} the <${goal} mg/dL${rationale}.`);
    }
  }
  const crclEntry = labs.find((e) => /crcl/i.test(e.type));
  if (crclEntry) {
    const c = firstNumber(crclEntry.value);
    if (c != null) {
      const fn = c >= 90 ? "normal renal function" : c >= 60 ? "mild renal impairment" : c >= 30 ? "moderate renal impairment" : c >= 15 ? "severe renal impairment" : "kidney failure";
      parts.push(`CrCl ${c} mL/min indicates ${fn}, relevant for renal drug dosing.`);
    }
  }
  const bmi = firstNumber(formData.vitals && formData.vitals.bmi);
  if (bmi != null) {
    const cat = bmi >= 30 ? "obese" : bmi >= 25 ? "overweight" : bmi >= 18.5 ? "normal weight" : "underweight";
    parts.push(`BMI ${bmi} kg/m2 is in the ${cat} range.`);
  }
  const meds = Array.isArray(formData.regimen) ? formData.regimen : [];
  const cardioRenal = pmhSel.some((x) => /heart failure|ckd|ascvd|cad/i.test(x));
  if (cardioRenal && meds.some((m) => /gliflozin/i.test(m.name))) {
    parts.push("The SGLT2 inhibitor in the regimen is guideline-appropriate for the patient's cardiorenal comorbidities.");
  }
  return parts.length ? parts.join(" ") : "Clinical assessment to be completed based on the data above.";
}

function assembleSOA(enc, formData) {
  const sLines = [], oLines = [];
  enc.fields.forEach((f) => {
    const b = bucketOf(f);
    if (b === "P") return;
    if (!fieldHasValue(f, formData[f.id])) return;
    const line = serializeField(f, formData[f.id]);
    if (line) (b === "S" ? sLines : oLines).push(line);
  });
  return {
    s: sLines.length ? sLines.join("\n") : "Not documented.",
    o: oLines.length ? oLines.join("\n") : "Not documented.",
    a: buildAssessment(enc, formData),
  };
}

// Plan is the supervising pharmacist's plan, taken verbatim, one point per line,
// rendered as a dash list under a "Plan:" heading.
function buildPlanText(cpPlan) {
  const lines = (cpPlan || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  if (!lines.length) return "Plan:\n- (No plan documented by the clinical pharmacist.)";
  return "Plan:\n" + lines.map((l) => `- ${l}`).join("\n");
}

// Deterministic completeness check: flags clinically important fields left blank.
function buildCompleteness(enc, formData) {
  if (enc !== ENCOUNTERS.diabetes) return [];
  const gaps = [];
  const hv = (id) => fieldHasValue(enc.fields.find((f) => f.id === id) || {}, formData[id]);
  if (!hv("a1cCurrent")) gaps.push("Current HbA1c not documented");
  if (!(formData.a1cTarget || "").trim()) gaps.push("Target HbA1c not documented");
  if (!hv("glucose")) gaps.push("Home glucose readings not documented");
  if (!hv("regimen")) gaps.push("Current diabetes regimen not documented");
  if (!(formData.adherence || "").trim()) gaps.push("Adherence not assessed");
  const labs = Array.isArray(formData.labs) ? formData.labs : [];
  if (!labs.some((e) => /crcl/i.test(e.type))) gaps.push("Renal function (CrCl) not documented");
  if (!labs.some((e) => /ldl/i.test(e.type))) gaps.push("LDL-C not documented");
  const vit = formData.vitals || {};
  if (!((vit.sbp && String(vit.sbp).trim()) || (vit.dbp && String(vit.dbp).trim()))) gaps.push("Blood pressure not documented");
  if (!(formData.followup || "").trim()) gaps.push("Follow-up interval not documented");
  if (!(formData.__cpPlan || "").trim()) gaps.push("No clinical pharmacist plan entered");
  return gaps;
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const INPUT_BASE =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200 placeholder:text-slate-400";
const SELECT_SM =
  "w-full appearance-none rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200";
const LABEL_CLS = "block text-sm font-medium text-slate-700";

function Chevron() {
  return (
    <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Field components
// ---------------------------------------------------------------------------
function BasicField({ field, value, onChange }) {
  return (
    <div className="space-y-1">
      <label className={LABEL_CLS}>{field.label}</label>
      {field.type === "textarea" ? (
        <textarea
          rows={3}
          className={INPUT_BASE + " resize-y leading-relaxed"}
          placeholder={field.placeholder || ""}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "select" ? (
        <div className="relative">
          <select className={INPUT_BASE + " appearance-none pr-9"} value={value || ""} onChange={(e) => onChange(e.target.value)}>
            <option value="">— select —</option>
            {field.options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <Chevron />
        </div>
      ) : field.suffix ? (
        <div className="relative">
          <input
            type="text"
            className={INPUT_BASE + " pr-9"}
            placeholder={field.placeholder || ""}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{field.suffix}</span>
        </div>
      ) : (
        <input
          type="text"
          className={INPUT_BASE}
          placeholder={field.placeholder || ""}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function ChipsField({ field, value, onChange }) {
  const selected = (value && value.selected) || [];
  const other = (value && value.other) || "";
  function toggle(opt) {
    const next = selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt];
    onChange({ selected: next, other });
  }
  return (
    <div className="space-y-2">
      <label className={LABEL_CLS}>{field.label}</label>
      <div className="flex flex-wrap gap-2">
        {field.options.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={
                "rounded-full border px-3 py-1 text-sm transition " +
                (on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-teal-400")
              }
            >
              {opt}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        className={INPUT_BASE}
        placeholder={field.otherLabel || "Other"}
        value={other}
        onChange={(e) => onChange({ selected, other: e.target.value })}
      />
    </div>
  );
}

function ValueBuilderField({ field, value, onChange }) {
  const options = field.options;
  const defaults = field.defaults || [];
  const [type, setType] = useState("");
  const [val, setVal] = useState("");
  const unitFor = (label) => {
    const o = options.find((x) => x.label === label);
    return o ? o.unit : "";
  };
  const valueFor = (label) => {
    const e = value.find((x) => x.type === label);
    return e ? e.value : "";
  };
  const setReading = (label, v) => {
    const others = value.filter((x) => x.type !== label);
    const t = v.trim();
    onChange(t ? [...others, { type: label, value: t, unit: unitFor(label) }] : others);
  };
  const addedTypes = value.map((e) => e.type);
  const addable = options.filter((o) => !defaults.includes(o.label) && !addedTypes.includes(o.label));
  const currentAddType = field.typePlaceholder ? type : (type || (addable[0] ? addable[0].label : ""));
  function addOther() {
    if (!currentAddType || !val.trim()) return;
    onChange([...value, { type: currentAddType, value: val.trim(), unit: unitFor(currentAddType) }]);
    setVal("");
    setType("");
  }
  function remove(label) {
    onChange(value.filter((e) => e.type !== label));
  }
  const extras = value.filter((e) => !defaults.includes(e.type));
  return (
    <div className="space-y-2">
      <label className={LABEL_CLS}>{field.label}</label>

      {defaults.length > 0 && (
        <div className="space-y-2">
          {defaults.map((label) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-2/5 shrink-0 text-sm text-slate-600">{label}</span>
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  className={INPUT_BASE + " pr-12"}
                  placeholder="value"
                  value={valueFor(label)}
                  onChange={(e) => setReading(label, e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unitFor(label)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {addable.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-stretch gap-2">
            <div className="relative w-2/5 min-w-0">
              <select className={SELECT_SM + " pr-7"} value={currentAddType} onChange={(e) => setType(e.target.value)}>
                {field.typePlaceholder && <option value="">{field.typePlaceholder}</option>}
                {addable.map((o) => (
                  <option key={o.label} value={o.label}>{o.label}</option>
                ))}
              </select>
              <Chevron />
            </div>
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                className={INPUT_BASE + " pr-12"}
                placeholder={field.valueHint || (defaults.length ? "add another reading" : "value")}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOther(); } }}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unitFor(currentAddType)}</span>
            </div>
            <button
              type="button"
              onClick={addOther}
              disabled={!val.trim() || !currentAddType}
              className="shrink-0 rounded-lg bg-teal-700 px-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Add
            </button>
          </div>
          {cholMgDl(currentAddType, val) != null && (
            <div className="flex justify-end">
              <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200">
                ≈ {cholMgDl(currentAddType, val)} mg/dL
              </span>
            </div>
          )}
        </div>
      )}

      {extras.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {extras.map((e) => (
            <span key={e.type} className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-700">
              <span className="font-medium text-slate-800">{e.type}</span> {e.value} {e.unit}
              {cholMgDl(e.type, e.value) != null && <span className="font-semibold text-teal-700">≈ {cholMgDl(e.type, e.value)} mg/dL</span>}
              <button type="button" onClick={() => remove(e.type)} className="ml-0.5 text-slate-400 hover:text-red-500" aria-label="remove">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MedBuilderField({ field, value, onChange }) {
  const db = MED_DBS[field.db] || [];
  const selectedFor = (id) => value.find((m) => m.drugId === id);
  function toggle(drug) {
    if (selectedFor(drug.id)) {
      onChange(value.filter((m) => m.drugId !== drug.id));
      return;
    }
    let entry;
    if (drug.insulin === "prandial") {
      entry = { drugId: drug.id, name: drug.name, kind: "prandial", meals: Object.fromEntries(drug.meals.map((m) => [m, ""])) };
    } else if (drug.insulin === "basal") {
      entry = { drugId: drug.id, name: drug.name, kind: "basal", dose: "", freq: drug.freqs.length === 1 ? drug.freqs[0] : "" };
    } else {
      entry = {
        drugId: drug.id,
        name: drug.name,
        kind: "oral",
        dose: drug.strengths && drug.strengths.length === 1 ? drug.strengths[0] : "",
        freq: drug.freqs.length === 1 ? drug.freqs[0] : "",
      };
    }
    onChange([...value, entry]);
  }
  function update(id, key, v) {
    onChange(value.map((m) => (m.drugId === id ? { ...m, [key]: v } : m)));
  }
  function updateMeal(id, meal, v) {
    onChange(value.map((m) => (m.drugId === id ? { ...m, meals: { ...m.meals, [meal]: v } } : m)));
  }
  const summary = value.map(formatMed).join("; ");

  return (
    <div className="space-y-2">
      <label className={LABEL_CLS}>{field.label}</label>
      <p className="text-xs text-slate-500">Check a medication, then set dose and frequency. Strengths reflect common FDA-approved doses. Basal insulin uses a units dropdown; prandial insulin is dosed per meal.</p>
      <div className="overflow-auto rounded-lg border border-slate-200 p-3" style={{ maxHeight: "360px" }}>
        {db.map((group, gi) => (
          <div key={group.class} className={gi === 0 ? "" : "mt-3"}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.class}</div>
            {group.drugs.map((drug) => {
              const sel = selectedFor(drug.id);
              return (
                <div key={drug.id} className="py-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                    <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={!!sel} onChange={() => toggle(drug)} />
                    <span>{drug.name}</span>
                  </label>
                  {sel && (
                    <div className="ml-6 mt-1">
                      {drug.insulin === "prandial" ? (
                        <div className="grid grid-cols-3 gap-2">
                          {drug.meals.map((meal) => (
                            <div key={meal} className="space-y-1">
                              <span className="block text-xs text-slate-500">{meal}</span>
                              <div className="relative">
                                <select className={SELECT_SM + " pr-7"} value={(sel.meals && sel.meals[meal]) || ""} onChange={(e) => updateMeal(drug.id, meal, e.target.value)}>
                                  <option value="">units</option>
                                  {UNITS.map((u) => (
                                    <option key={u} value={u}>{u}</option>
                                  ))}
                                </select>
                                <Chevron />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {drug.insulin === "basal" ? (
                            <div className="relative">
                              <select className={SELECT_SM + " pr-7"} value={sel.dose} onChange={(e) => update(drug.id, "dose", e.target.value)}>
                                <option value="">units</option>
                                {UNITS.map((u) => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                              <Chevron />
                            </div>
                          ) : (
                            <div className="relative">
                              <select className={SELECT_SM + " pr-7"} value={sel.dose} onChange={(e) => update(drug.id, "dose", e.target.value)}>
                                <option value="">dose</option>
                                {drug.strengths.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <Chevron />
                            </div>
                          )}
                          <div className="relative">
                            <select className={SELECT_SM + " pr-7"} value={sel.freq} onChange={(e) => update(drug.id, "freq", e.target.value)}>
                              <option value="">frequency</option>
                              {drug.freqs.map((fr) => (
                                <option key={fr} value={fr}>{fr}</option>
                              ))}
                            </select>
                            <Chevron />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {value.length > 0 && (
        <div className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
          <span className="font-semibold">Regimen: </span>{summary}
        </div>
      )}
    </div>
  );
}

function GroupField({ field, value, onChange }) {
  function set(id, v) {
    onChange({ ...value, [id]: v });
  }
  return (
    <div className="space-y-2">
      <label className={LABEL_CLS}>{field.label}</label>
      <div className={"grid grid-cols-2 gap-3 " + (field.fields.length >= 5 ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
        {field.fields.map((sf) => (
          <div key={sf.id} className="space-y-1">
            <span className="block text-xs font-medium text-slate-500">{sf.label}</span>
            <input
              type="text"
              className={INPUT_BASE}
              placeholder={sf.placeholder || ""}
              value={(value && value[sf.id]) || ""}
              onChange={(e) => set(sf.id, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ValueDateField({ field, value, onChange }) {
  const v = value || {};
  const set = (k, val) => onChange({ ...v, [k]: val });
  const dateSelect = (key, opts, ph) => (
    <div className="relative">
      <select className={SELECT_SM + " pr-7"} value={v[key] || ""} onChange={(e) => set(key, e.target.value)}>
        <option value="">{ph}</option>
        {opts.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <Chevron />
    </div>
  );
  return (
    <div className="space-y-2">
      <label className={LABEL_CLS}>{field.label}</label>
      <div className="relative">
        <input
          type="text"
          className={INPUT_BASE + (field.valueUnit ? " pr-9" : "")}
          placeholder={field.valuePlaceholder || "value"}
          value={v.value || ""}
          onChange={(e) => set("value", e.target.value)}
        />
        {field.valueUnit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{field.valueUnit}</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {dateSelect("year", YEARS, "Year")}
        {dateSelect("month", MONTHS, "Month")}
        {dateSelect("day", DAYS, "Day")}
      </div>
    </div>
  );
}

function MedTableField({ field, value, onChange }) {
  const minRows = field.minRows || 1;
  // Pad to minRows ONLY when the field is untouched (value not yet an array).
  // Once the user edits/adds/removes, the stored array is respected exactly,
  // so deleting a row actually removes it (and the list can go to zero).
  const display = Array.isArray(value)
    ? value
    : Array.from({ length: minRows }, () => ({ drug: "", dose: "", freq: "" }));
  const clone = () => display.map((r) => ({ drug: r.drug || "", dose: r.dose || "", freq: r.freq || "" }));
  const update = (i, key, val) => {
    const next = clone();
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  };
  const addRow = () => onChange([...clone(), { drug: "", dose: "", freq: "" }]);
  const removeRow = (i) => onChange(clone().filter((_, idx) => idx !== i));
  const cell = "min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200 placeholder:text-slate-400";
  return (
    <div className="space-y-2">
      <label className={LABEL_CLS}>{field.label}</label>
      <p className="text-xs text-slate-500">Non-diabetes drugs only — leave blank if the patient takes none. Listed in the note in the order shown.</p>
      <div className="space-y-2">
        {display.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className={cell} placeholder="Drug" value={row.drug || ""} onChange={(e) => update(i, "drug", e.target.value)} />
            <input className={cell} placeholder="Dose" value={row.dose || ""} onChange={(e) => update(i, "dose", e.target.value)} />
            <input className={cell} placeholder="Frequency" value={row.freq || ""} onChange={(e) => update(i, "freq", e.target.value)} />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-slate-400 transition hover:border-rose-300 hover:text-rose-500"
              aria-label="Remove medication"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.75 2.5a.75.75 0 00-.75.75V4H4.5a.75.75 0 000 1.5h.546l.7 9.1A2 2 0 007.74 17.5h4.52a2 2 0 001.994-1.9l.7-9.1h.546a.75.75 0 000-1.5H12v-.75a.75.75 0 00-.75-.75h-2.5zM9 7.25a.75.75 0 011.5 0v6a.75.75 0 01-1.5 0v-6z" clipRule="evenodd" /></svg>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 transition hover:bg-teal-100"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 4a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 0110 4z" /></svg>
        Add medication
      </button>
    </div>
  );
}

const FULL_WIDTH_TYPES = ["textarea", "chips", "valuebuilder", "medbuilder", "medtable", "group", "valuedate"];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function AmbuScribe() {
  const [encounterKey] = useState("diabetes");
  const [formData, setFormData] = useState({});
  const [note, setNote] = useState("");
  const [flags, setFlags] = useState([]);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  const enc = ENCOUNTERS[encounterKey];

  const hasInput = useMemo(() => {
    const anyField = enc.fields.some((f) => fieldHasValue(f, formData[f.id]));
    return anyField || (formData.__cpPlan || "").trim().length > 0;
  }, [enc, formData]);

  function resetOutput() {
    setNote("");
    setFlags([]);
    setHasResult(false);
    setCopied(false);
    setCopyFailed(false);
  }

  const setField = (id, value) => setFormData((prev) => ({ ...prev, [id]: value }));

  function clearInputs() {
    setFormData({});
    resetOutput();
  }

  function renderField(f) {
    const v = formData[f.id];
    const set = (val) => setField(f.id, val);
    switch (f.type) {
      case "chips":
        return <ChipsField field={f} value={v} onChange={set} />;
      case "valuebuilder":
        return <ValueBuilderField field={f} value={v || []} onChange={set} />;
      case "medbuilder":
        return <MedBuilderField field={f} value={v || []} onChange={set} />;
      case "medtable":
        return <MedTableField field={f} value={v || []} onChange={set} />;
      case "group":
        return <GroupField field={f} value={v || {}} onChange={set} />;
      case "valuedate":
        return <ValueDateField field={f} value={v || {}} onChange={set} />;
      default:
        return <BasicField field={f} value={v || ""} onChange={set} />;
    }
  }

  const buildSOA = () => assembleSOA(enc, formData);
  const soaBlock = (soa) => `S:\n${soa.s}\n\nO:\n${soa.o}\n\nA:\n${soa.a}`;
  const cpPlanText = () => (formData.__cpPlan || "").trim();
  const attestation = () => (formData.__preceptor ? `\n\nAs discussed with ${formData.__preceptor}` : "");

  function generate() {
    setCopied(false);
    const soa = buildSOA();
    const note = `${soaBlock(soa)}\n\n${buildPlanText(cpPlanText())}${attestation()}`;
    setNote(note);
    setFlags(buildCompleteness(enc, formData));
    setHasResult(true);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  const sansStack = "'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" style={{ fontFamily: sansStack }}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 font-bold text-white shadow-sm">Rx</div>
          <div>
            <h1 className="text-xl font-semibold leading-tight text-slate-900" style={{ fontFamily: "'IBM Plex Serif', Georgia, serif" }}>AmbuScribe</h1>
            <p className="text-xs leading-tight text-slate-500">Ambulatory Care SOAP Note Assistant</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* INPUT COLUMN */}
          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="mb-2 block text-sm font-bold uppercase tracking-wide text-teal-700">Encounter / disease state</label>
              <div className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2.5 text-sm font-semibold text-teal-800">
                <span className="inline-flex h-2 w-2 rounded-full bg-teal-600" />
                {ENCOUNTERS[encounterKey].label}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-teal-700">Clinical inputs</h2>
                {hasInput && (
                  <button onClick={clearInputs} className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline">Clear inputs</button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {enc.fields.map((f) => (
                  <div key={encounterKey + ":" + f.id} className={(FULL_WIDTH_TYPES.includes(f.type) || f.fullWidth) ? "sm:col-span-2" : ""}>
                    {renderField(f)}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="mb-1 block text-sm font-bold uppercase tracking-wide text-teal-700">Ambulatory Care Clinical Pharmacist plan</label>
              <p className="mb-2 text-xs text-slate-500">One plan point per line. These are placed verbatim in the note's Plan section as a dashed list.</p>
              <textarea
                rows={5}
                className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200 placeholder:text-slate-400"
                placeholder="e.g., up-titrate basal insulin, start high-intensity statin, add GLP-1 RA, reinforce SMBG, follow up in 4-6 weeks..."
                value={formData.__cpPlan || ""}
                onChange={(e) => setField("__cpPlan", e.target.value)}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="mb-2 block text-sm font-bold uppercase tracking-wide text-teal-700">Supervising clinical pharmacist</label>
              <p className="mb-2 text-xs text-slate-500">Adds "As discussed with [name]" to the end of the note.</p>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-9 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200"
                  value={formData.__preceptor || ""}
                  onChange={(e) => setField("__preceptor", e.target.value)}
                >
                  <option value="">— select —</option>
                  {PRECEPTORS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            <div>
              <button
                onClick={generate}
                disabled={!hasInput}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Generate SOAP Note
              </button>
              {!hasInput && <p className="mt-2 text-center text-xs text-slate-400">Enter at least one field or a plan point to generate.</p>}
            </div>
          </section>

          {/* OUTPUT COLUMN */}
          <section className="space-y-5">
            {!hasResult && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm" style={{ minHeight: "16rem" }}>
                <svg className="h-8 w-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="mt-3 text-sm font-medium text-slate-500">Your generated SOAP note will appear here.</p>
                <p className="mt-1 text-xs text-slate-400">Fill in the inputs and select Generate SOAP Note.</p>
              </div>
            )}

            {hasResult && note && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-teal-700">SOAP note</h2>
                    <p className="text-xs text-slate-400">Editable — review and adjust before copying.</p>
                  </div>
                  <button onClick={handleCopy} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-teal-600 hover:text-teal-700">
                    {copied ? (
                      <><svg className="h-4 w-4 text-teal-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>Copied</>
                    ) : (
                      <><svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" /><path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" /></svg>Copy</>
                    )}
                  </button>
                </div>
                {copyFailed && (
                  <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">Copy was blocked by the browser — select the note text and copy manually.</div>
                )}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  spellCheck={false}
                  className="w-full resize-y border-0 bg-white px-5 py-4 text-sm leading-relaxed text-slate-800 outline-none"
                  style={{ minHeight: "24rem", fontFamily: sansStack }}
                />
              </div>
            )}

            {hasResult && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-teal-700">Completeness check</h2>
                {flags.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2.5 text-sm text-teal-800">
                    <svg className="h-5 w-5 shrink-0 text-teal-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                    No major documentation gaps were identified.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {flags.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.515 2.625H3.72c-1.345 0-2.188-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="mt-4 border-t border-slate-200 bg-slate-100">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <p className="text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-700">Documentation aid only.</span> All notes must be reviewed, edited, and verified by a licensed pharmacist/clinician before entry into the medical record. Do not enter protected health information you are not authorized to process.
          </p>
          <p className="mt-2 text-xs text-slate-400">AmbuScribe v1.0 — Diabetes (T2DM) module. Clinical targets reflect the ADA Standards of Care; review annually. No data is transmitted or stored by this tool.</p>
        </div>
      </footer>
    </div>
  );
}
