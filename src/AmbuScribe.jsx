import React, { useState, useMemo, useEffect } from "react";

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
  "T1DM", "T2DM", "Hypertension", "Dyslipidemia", "CKD", "ASCVD / CAD", "Heart failure",
  "Obesity", "Diabetic retinopathy", "Diabetic neuropathy", "Diabetic nephropathy",
  "NAFLD", "OSA", "Hypothyroidism", "Depression / anxiety",
];

// Condition-specific labs surfaced when the matching comorbidity is in the PMH.
const COND_LABS = {
  "CKD": [
    { label: "eGFR", unit: "mL/min/1.73m²" },
    { label: "Bicarbonate", unit: "mmol/L" },
    { label: "Phosphate", unit: "mg/dL" },
    { label: "Calcium", unit: "mg/dL" },
    { label: "PTH", unit: "pg/mL" },
    { label: "Hemoglobin", unit: "g/dL" },
  ],
  "Heart failure": [
    { label: "Ejection fraction", unit: "%" },
    { label: "NT-proBNP", unit: "pg/mL" },
    { label: "Sodium", unit: "mmol/L" },
    { label: "eGFR", unit: "mL/min/1.73m²" },
  ],
  "ASCVD / CAD": [
    { label: "hsCRP", unit: "mg/L" },
    { label: "Lp(a)", unit: "nmol/L" },
  ],
  "Hypertension": [
    { label: "Sodium", unit: "mmol/L" },
    { label: "eGFR", unit: "mL/min/1.73m²" },
  ],
  "Diabetic nephropathy": [
    { label: "eGFR", unit: "mL/min/1.73m²" },
  ],
  "NAFLD": [
    { label: "Platelets", unit: "×10⁹/L" },
    { label: "GGT", unit: "U/L" },
  ],
  "Hypothyroidism": [
    { label: "TSH", unit: "mIU/L" },
    { label: "Free T4", unit: "pmol/L" },
  ],
  "T1DM": [
    { label: "TSH", unit: "mIU/L" },
    { label: "TTG-IgA", unit: "U/mL" },
    { label: "C-peptide", unit: "ng/mL" },
  ],
};
function conditionLabs(formData) {
  const sel = (formData.pmh && formData.pmh.selected) || [];
  const base = new Set(LAB_GROUPS.flatMap((g) => g.items.map((i) => i.label.toLowerCase())));
  const seen = new Set();
  const out = [];
  sel.forEach((cond) => (COND_LABS[cond] || []).forEach((item) => {
    const key = item.label.toLowerCase();
    if (base.has(key) || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  }));
  return out;
}

const HYPO_FREQ = ["None", "Rare (<1/week)", "Occasional (1-3/week)", "Frequent (>3/week)", "Daily"];
const HYPO_SEV = ["None", "Mild (self-treated)", "Moderate", "Severe (required assistance)"];

// Supervising clinical pharmacists (preceptors) for the attestation line.
const PRECEPTORS = [
  { name: "Dr. Bashayr Alsuwayni", title: "Consultant Ambulatory Care Clinical Pharmacist" },
  { name: "Prof. Abdulaziz Alhossan", title: "Consultant Ambulatory Care Clinical Pharmacist" },
  { name: "Dr. Nasir Binshannar", title: "Consultant Ambulatory Care Clinical Pharmacist" },
  { name: "Dr. Ghada Bawazeer", title: "Consultant Ambulatory Care Clinical Pharmacist" },
  { name: "Dr. Eman Alfi", title: "Consultant Ambulatory Care Clinical Pharmacist" },
  { name: "Dr. Nawar Alotaibi", title: "Consultant Ambulatory Care Clinical Pharmacist" },
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

// Labs grouped by body system; the user types values directly into each row.
const LAB_GROUPS = [
  { system: "Renal", items: [
    { label: "CrCl", unit: "mL/min" },
    { label: "A/C", unit: "mg/g" },
  ]},
  { system: "Electrolytes", items: [
    { label: "Potassium", unit: "mmol/L" },
  ]},
  { system: "Lipids", items: [
    { label: "LDL-C", unit: "mmol/L" },
    { label: "HDL-C", unit: "mmol/L" },
    { label: "Triglycerides", unit: "mmol/L" },
    { label: "Total cholesterol", unit: "mmol/L" },
  ]},
  { system: "Hepatic", items: [
    { label: "ALT", unit: "U/L" },
    { label: "AST", unit: "U/L" },
  ]},
  { system: "Vitamins / other", items: [
    { label: "Vitamin B12", unit: "pg/mL" },
    { label: "Vitamin D", unit: "ng/mL" },
  ]},
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
    label: "Diabetes Mellitus",
    guideline: "the ADA Standards of Care in Diabetes (current edition)",
    fields: [
      { id: "pmh", label: "Past medical history", type: "chips", options: PMH_OPTIONS, otherLabel: "Other conditions" },
      { id: "a1cCurrent", label: "Current HbA1c", type: "valuedate", valuePlaceholder: "e.g., 8.4", valueUnit: "%", range: [3, 20] },
      { id: "a1cPrior", label: "Prior HbA1c", type: "valuedate", valuePlaceholder: "e.g., 9.1", valueUnit: "%", range: [3, 20] },
      { id: "a1cTarget", label: "Target HbA1c", type: "text", suffix: "%", placeholder: "e.g., <7" },
      { id: "glucose", label: "Home glucose readings", type: "valuebuilder", options: GLUCOSE_TYPES, defaults: ["Fasting", "2-hr post-prandial"], range: [20, 600] },
      { id: "regimen", label: "Current diabetes regimen", type: "medbuilder", db: "diabetes" },
      { id: "homeMeds", label: "Home medications (other than DM medications)", type: "medtable", minRows: 1 },
      { id: "adherence", label: "Adherence", type: "select", options: ADHERENCE_OPTS },
      { id: "hypoFreq", label: "Hypoglycemia frequency", type: "select", options: HYPO_FREQ },
      { id: "hypoSev", label: "Hypoglycemia severity", type: "select", options: HYPO_SEV },
      { id: "hypoNote", label: "Hypoglycemia details (timing, triggers, awareness)", type: "text" },
      { id: "hyperglycemia", label: "Hyperglycemia symptoms", type: "text", placeholder: "Polyuria, polydipsia, blurred vision, fatigue, none reported..." },
      { id: "vitals", label: "Vitals", type: "group", fields: [
        { id: "weight", label: "Weight", placeholder: "kg", unit: "kg", range: [20, 400] },
        { id: "bmi", label: "BMI", placeholder: "kg/m2", unit: "kg/m²", range: [10, 80] },
        { id: "sbp", label: "Systolic BP", placeholder: "mmHg", unit: "mmHg", range: [50, 280] },
        { id: "dbp", label: "Diastolic BP", placeholder: "mmHg", unit: "mmHg", range: [30, 180] },
        { id: "hr", label: "HR", placeholder: "bpm", unit: "bpm", range: [20, 250] },
      ]},
      { id: "labs", label: "Relevant labs", type: "labsystems", groups: LAB_GROUPS },
      { id: "ldlTarget", label: "Target LDL", type: "text", placeholder: "e.g., <55 mg/dL or <1.4 mmol/L" },
      { id: "ascvdRisk", label: "ASCVD 10-year risk score (optional)", type: "text", placeholder: "e.g., 12.5%" },
      { id: "followup", label: "Follow-up interval", type: "text", fullWidth: true },
    ],
  },
};


// ---------------------------------------------------------------------------
// ADA Standards of Care — comprehensive diabetes evaluation
//   Table 4.1 = components by visit (visit codes: I=Initial, F=Follow-up, A=Annual)
//   Table 4.2 = assessment, planning, and referral
// Transcribed for documentation coverage; verify against the current ADA
// Standards of Care. Not for clinical use.
// ---------------------------------------------------------------------------
const VISITS = [
  { key: "initial", label: "Initial", code: "I" },
  { key: "followup", label: "Follow-up", code: "F" },
  { key: "annual", label: "Annual", code: "A" },
];

const EVAL_TABLE = [
  { group: "Diabetes & family history", items: [
    { id: "onset", label: "Characteristics at onset (age, symptoms/signs)", v: "I" },
    { id: "prevtx", label: "Previous treatment plans and response", v: "I" },
    { id: "hosp", label: "Frequency, cause, and severity of past hospitalizations", v: "I" },
    { id: "fhdm", label: "Family history of diabetes (first-degree relative)", v: "I" },
    { id: "fhai", label: "Family history of autoimmune disorders", v: "I" },
  ]},
  { group: "Complications & comorbidities", items: [
    { id: "comorb", label: "Common comorbidities (obesity, OSA, MASLD)", v: "IA", link: "pmh" },
    { id: "htnlipid", label: "High blood pressure or abnormal lipids", v: "IA" },
    { id: "vascular", label: "Macro- and microvascular complications", v: "IA" },
    { id: "hypo", label: "Hypoglycemia: awareness, frequency, causes, timing", v: "IFA", link: "hypo" },
    { id: "hemo", label: "Hemoglobinopathies or anemias", v: "IA" },
    { id: "dental", label: "Last dental visit", v: "IA" },
    { id: "foothx", label: "Last foot exam", v: "IA" },
    { id: "eyehx", label: "Last dilated eye exam", v: "IA" },
    { id: "specialists", label: "Visits to specialists", v: "I" },
    { id: "disability", label: "Disability assessment & assistive devices", v: "IFA" },
    { id: "autoimmune", label: "Personal history of autoimmune disease", v: "I" },
    { id: "surgery", label: "Surgeries (metabolic surgery, transplantation)", v: "IFA" },
    { id: "interval", label: "Changes in medical/family history since last visit", v: "FA" },
  ]},
  { group: "Behavioral factors", items: [
    { id: "activity", label: "Physical activity, sleep, eating patterns, weight history", v: "IFA" },
    { id: "carbcount", label: "Familiarity with carbohydrate counting (T1D / T2D on MDI)", v: "IA" },
    { id: "osascreen", label: "Screen for OSA", v: "IFA" },
    { id: "substance", label: "Tobacco, alcohol, and substance use", v: "IA" },
  ]},
  { group: "Medications & vaccinations", items: [
    { id: "medplan", label: "Current medication plan", v: "IFA", link: "regimen" },
    { id: "medadhere", label: "Medication-taking behavior (incl. rationing)", v: "IFA", link: "adherence" },
    { id: "medintol", label: "Medication intolerance or side effects", v: "IFA" },
    { id: "cam", label: "Complementary and alternative medicine use", v: "IFA" },
    { id: "vax", label: "Vaccination history and needs", v: "IA" },
  ]},
  { group: "Technology use", items: [
    { id: "apps", label: "Health apps, online education, patient portals", v: "IFA" },
    { id: "cgm", label: "Glucose monitoring (meter/CGM): results & data use", v: "IFA", link: "glucose" },
    { id: "pump", label: "Insulin pump / connected pen settings & data", v: "IFA" },
  ]},
  { group: "Social life assessment", items: [
    { id: "support", label: "Existing social supports", v: "IA" },
    { id: "surrogate", label: "Surrogate decision maker & advance care plan", v: "IA" },
    { id: "sdoh", label: "Social determinants of health (food, housing, transport, finances, safety)", v: "IA" },
    { id: "routine", label: "Daily routine & environment (school/work, self-management)", v: "IFA" },
  ]},
  { group: "Physical examination", items: [
    { id: "anthro", label: "Height, weight, BMI; growth/pubertal development", v: "IFA", link: "vitalsWtBmi" },
    { id: "bp", label: "Blood pressure determination", v: "IFA", link: "vitalsBp" },
    { id: "ortho", label: "Orthostatic blood pressure", v: "IA" },
    { id: "fundus", label: "Fundoscopic exam (refer to eye specialist)", v: "IA" },
    { id: "thyroid", label: "Thyroid palpation", v: "IA" },
    { id: "skin", label: "Skin exam (acanthosis nigricans, injection sites, lipodystrophy)", v: "IFA" },
    { id: "footcomp", label: "Comprehensive foot exam (temp, vibration/pinprick, 10-g monofilament)", v: "IA" },
    { id: "footvis", label: "Visual foot inspection (skin, callus, deformity/ulcer, toenails)", v: "IFA" },
    { id: "pad", label: "Pedal pulses; PAD screen with ABI", v: "IA" },
    { id: "psych", label: "Screen depression, anxiety, distress, fear of hypoglycemia, disordered eating", v: "IA" },
    { id: "cognition", label: "Cognitive performance", v: "IA" },
    { id: "function", label: "Functional performance", v: "IA" },
    { id: "bone", label: "Bone health (loss of height, kyphosis)", v: "IA" },
  ]},
  { group: "Laboratory evaluation", items: [
    { id: "a1c", label: "A1C (if none within 3 months or earlier assessment needed)", v: "IFA", link: "a1c" },
    { id: "lipid", label: "Lipid profile (total, LDL, HDL, triglycerides)", v: "I", link: "lipid" },
    { id: "fib4", label: "Liver function tests (FIB-4)", v: "IA", link: "lft" },
    { id: "uacr", label: "Spot urinary albumin-to-creatinine ratio", v: "IA", link: "uacr" },
    { id: "scr", label: "Serum creatinine and eGFR", v: "IA", link: "scr" },
    { id: "tsh", label: "TSH (type 1 diabetes)", v: "IA" },
    { id: "celiac", label: "Celiac disease screening (type 1 diabetes)", v: "I" },
    { id: "b12", label: "Vitamin B12 (if metformin > 5 years)", v: "IA", link: "b12" },
    { id: "cbc", label: "CBC with platelets", v: "IA" },
    { id: "k", label: "Serum potassium (if on ACEi/ARB/diuretic)", v: "IA", link: "potassium" },
    { id: "cavitd", label: "Calcium, vitamin D, phosphorus", v: "IA", link: "vitd" },
  ]},
];

function visitCode(visitKey) { const v = VISITS.find((x) => x.key === visitKey); return v ? v.code : "I"; }
function dueAt(item, visitKey) { return item.v.includes(visitCode(visitKey)); }
function labHas(formData, re) { const labs = Array.isArray(formData.labs) ? formData.labs : []; return labs.some((e) => re.test(e.type || "") && String(e.value || "").trim() !== ""); }
function linkSatisfied(link, formData) {
  switch (link) {
    case "pmh": return fieldHasValue({ type: "chips" }, formData.pmh);
    case "hypo": return !!(formData.hypoFreq && formData.hypoFreq !== "None") || !!(formData.hypoSev && formData.hypoSev !== "None") || !!(formData.hypoNote && String(formData.hypoNote).trim());
    case "regimen": return Array.isArray(formData.regimen) && formData.regimen.length > 0;
    case "adherence": return !!(formData.adherence && String(formData.adherence).trim());
    case "glucose": return Array.isArray(formData.glucose) && formData.glucose.length > 0;
    case "vitalsWtBmi": { const v = formData.vitals || {}; return !!(String(v.weight || "").trim() || String(v.bmi || "").trim()); }
    case "vitalsBp": { const v = formData.vitals || {}; return !!(String(v.sbp || "").trim() || String(v.dbp || "").trim()); }
    case "a1c": return fieldHasValue({ type: "valuedate" }, formData.a1cCurrent);
    case "lipid": return labHas(formData, /ldl|hdl|triglyc|cholesterol/i);
    case "lft": return labHas(formData, /alt|ast/i);
    case "uacr": return labHas(formData, /a\/c|albumin/i);
    case "scr": return labHas(formData, /scr|crcl|creatinine|egfr/i);
    case "b12": return labHas(formData, /b12/i);
    case "potassium": return labHas(formData, /potassium/i);
    case "vitd": return labHas(formData, /vitamin d|calcium/i);
    default: return false;
  }
}
function computeCoverage(formData) {
  const visit = formData.__visit || "initial";
  const checks = formData.__eval || {};
  const items = [];
  EVAL_TABLE.forEach((g) => g.items.forEach((it) => {
    if (!dueAt(it, visit)) return;
    const auto = it.link ? linkSatisfied(it.link, formData) : false;
    items.push({ id: it.id, label: it.label, group: g.group, auto, done: auto || !!checks[it.id] });
  }));
  const total = items.length;
  const doneCount = items.filter((d) => d.done).length;
  const outstanding = items.filter((d) => !d.done);
  return { visit, items, total, doneCount, outstanding };
}
// Only the components the clinician explicitly TICKED go into the note; nothing
// is auto-written. (Auto-satisfied rows are already documented in S/O, so they
// are not repeated here.) Returns "" when nothing was selected.
function buildEvalSummary(formData) {
  const checks = formData.__eval || {};
  const cov = computeCoverage(formData);
  const selected = cov.items.filter((d) => !!checks[d.id]).map((d) => d.label);
  if (!selected.length) return "";
  return `Comprehensive evaluation (ADA Table 4.1) — addressed: ${selected.join("; ")}.`;
}

// ---------------------------------------------------------------------------
// Field value helpers (presence + serialization to text for the model)
// ---------------------------------------------------------------------------
function fieldHasValue(f, val) {
  switch (f.type) {
    case "chips":
      return !!(val && ((val.selected && val.selected.length) || (val.other && val.other.trim())));
    case "valuebuilder":
    case "labsystems":
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
    case "labsystems": {
      if (!Array.isArray(val) || !val.length) return null;
      const order = (f.groups || []).flatMap((g) => g.items.map((i) => i.label));
      const rank = (t) => { const i = order.indexOf(t); return i === -1 ? 999 : i; };
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

// Plausible data-entry ranges used ONLY to catch likely typos (e.g. potassium 50
// instead of 5). These are deliberately wide — not clinical reference ranges.
const VALUE_RANGES = {
  "potassium": [2, 8], "sodium": [110, 175], "bicarbonate": [5, 45],
  "crcl": [1, 200], "egfr": [1, 200], "a/c": [0, 6000], "creatinine": [0.1, 25],
  "ldl-c": [0.2, 20], "hdl-c": [0.2, 6], "triglycerides": [0.1, 60], "total cholesterol": [1, 25],
  "ldl": [0.2, 20], "hdl": [0.2, 6], "lp(a)": [0, 1000], "hscrp": [0, 60],
  "alt": [1, 3000], "ast": [1, 3000], "ggt": [1, 3000], "platelets": [5, 1200],
  "vitamin b12": [50, 3000], "vitamin d": [1, 200], "calcium": [4, 16],
  "phosphate": [0.5, 12], "phosphorus": [0.5, 12], "pth": [1, 3000], "hemoglobin": [3, 25],
  "nt-probnp": [1, 70000], "bnp": [1, 30000], "ejection fraction": [5, 85],
  "tsh": [0.01, 100], "free t4": [1, 100], "ttg-iga": [0, 400], "c-peptide": [0, 25],
};
function rangeFor(label) {
  if (!label) return null;
  const l = String(label).toLowerCase();
  let best = null;
  for (const k of Object.keys(VALUE_RANGES)) { if (l.includes(k) && (!best || k.length > best.length)) best = k; }
  return best ? VALUE_RANGES[best] : null;
}
// Returns a "double-check" message if a numeric value falls outside its plausible range.
function rangeWarn(value, range, unit) {
  if (!range) return null;
  const n = firstNumber(value);
  if (n == null) return null;
  if (n < range[0] || n > range[1]) return `Double-check: ${n}${unit ? " " + unit : ""} is outside the expected range (${range[0]}–${range[1]} ${unit || ""}).`.replace(/ \)/, ")");
  return null;
}

// T1DM CGM "glucose-distribution" metrics with their AGP targets (nonpregnant T1DM).
const CGM_METRICS = [
  { id: "mean", label: "Mean glucose", unit: "mg/dL", target: "individualized", range: [20, 600] },
  { id: "gmi", label: "GMI (CGM-estimated A1C)", unit: "%", target: "commonly <7%", ok: (n) => n < 7, range: [3, 20] },
  { id: "tir", label: "TIR (70–180 mg/dL)", unit: "%", target: ">70%", ok: (n) => n > 70, range: [0, 100] },
  { id: "tar1", label: "TAR L1 (181–250)", unit: "%", target: "combined TAR <25%", range: [0, 100] },
  { id: "tar2", label: "TAR L2 (>250)", unit: "%", target: "<5%", ok: (n) => n < 5, range: [0, 100] },
  { id: "tbr1", label: "TBR L1 (54–69)", unit: "%", target: "combined TBR <4%", range: [0, 100] },
  { id: "tbr2", label: "TBR L2 (<54)", unit: "%", target: "<1%", ok: (n) => n < 1, range: [0, 100] },
  { id: "cv", label: "CV (variability)", unit: "%", target: "≤36%", ok: (n) => n <= 36, range: [0, 100] },
];

// Builds the T1DM-specific Objective lines (CGM metrics + ISF) if entered.
function buildT1dmObjective(formData) {
  const lines = [];
  const c = formData.__cgm || {};
  const n0 = (x) => firstNumber(x) || 0;
  const has = (x) => firstNumber(x) != null;
  const parts = [];
  if (has(c.mean)) parts.push(`mean glucose ${firstNumber(c.mean)} mg/dL`);
  if (has(c.gmi)) parts.push(`GMI ${firstNumber(c.gmi)}%`);
  if (has(c.tir)) parts.push(`TIR ${firstNumber(c.tir)}%`);
  if (has(c.tar1) || has(c.tar2)) parts.push(`TAR ${n0(c.tar1) + n0(c.tar2)}% (L2 ${has(c.tar2) ? firstNumber(c.tar2) : 0}%)`);
  if (has(c.tbr1) || has(c.tbr2)) parts.push(`TBR ${n0(c.tbr1) + n0(c.tbr2)}% (L2 ${has(c.tbr2) ? firstNumber(c.tbr2) : 0}%)`);
  if (has(c.cv)) parts.push(`CV ${firstNumber(c.cv)}%`);
  if (parts.length) lines.push(`CGM glucose-distribution metrics: ${parts.join(", ")}.`);
  const isf = formData.__isf || {};
  const tdd = firstNumber(isf.tdd);
  if (tdd && tdd > 0) {
    const rule = isf.type === "regular" ? 1500 : 1800;
    lines.push(`Insulin sensitivity factor (ISF): 1 unit ≈ ${Math.round(rule / tdd)} mg/dL (${rule} ÷ TDD ${tdd} u, ${isf.type === "regular" ? "regular" : "rapid analog"}).`);
  }
  return lines.join("\n");
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
          {defaults.map((label) => {
            const warn = rangeWarn(valueFor(label), field.range, unitFor(label));
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2/5 shrink-0 text-sm text-slate-600">{label}</span>
                  <div className="relative flex-1 min-w-0">
                    <input
                      type="text"
                      className={INPUT_BASE + " pr-12" + (warn ? " border-amber-400 focus:border-amber-500 focus:ring-amber-200" : "")}
                      placeholder="value"
                      value={valueFor(label)}
                      onChange={(e) => setReading(label, e.target.value)}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unitFor(label)}</span>
                  </div>
                </div>
                {warn && <p className="ml-[40%] pl-2 text-xs font-medium text-amber-600">⚠ {warn}</p>}
              </div>
            );
          })}
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

function LabsField({ field, value, onChange, formData }) {
  const groups = field.groups || [];
  const condItems = conditionLabs(formData || {});
  const [name, setName] = useState("");
  const [val, setVal] = useState("");
  const [unit, setUnit] = useState("");
  const valueFor = (label) => { const e = value.find((x) => x.type === label); return e ? e.value : ""; };
  const setLab = (label, u, v) => {
    const others = value.filter((x) => x.type !== label);
    const t = v.trim();
    onChange(t ? [...others, { type: label, value: t, unit: u }] : others);
  };
  const predefined = new Set([...groups.flatMap((g) => g.items.map((i) => i.label)), ...condItems.map((i) => i.label)]);
  const extras = value.filter((e) => !predefined.has(e.type));
  const addExtra = () => {
    if (!name.trim() || !val.trim()) return;
    onChange([...value.filter((e) => e.type !== name.trim()), { type: name.trim(), value: val.trim(), unit: unit.trim() }]);
    setName(""); setVal(""); setUnit("");
  };
  const removeExtra = (type) => onChange(value.filter((e) => e.type !== type));
  const cell = "min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200 placeholder:text-slate-400";
  const labRow = (item) => {
    const v = valueFor(item.label);
    const conv = cholMgDl(item.label, v);
    const warn = rangeWarn(v, rangeFor(item.label), item.unit);
    return (
      <div key={item.label} className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-2/5 shrink-0 text-sm text-slate-600">{item.label}</span>
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              className={INPUT_BASE + " pr-16" + (warn ? " border-amber-400 focus:border-amber-500 focus:ring-amber-200" : "")}
              placeholder="value"
              value={v}
              onChange={(e) => setLab(item.label, item.unit, e.target.value)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{item.unit}</span>
          </div>
          {conv != null && (
            <span className="shrink-0 rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200">≈ {conv} mg/dL</span>
          )}
        </div>
        {warn && <p className="ml-[40%] pl-2 text-xs font-medium text-amber-600">⚠ {warn}</p>}
      </div>
    );
  };
  return (
    <div className="space-y-3">
      <label className={LABEL_CLS}>{field.label}</label>
      <p className="text-xs text-slate-500">Type values directly into the relevant rows; leave the rest blank. Cholesterol entered in mmol/L is auto-converted; clearly out-of-range values are flagged to re-check.</p>
      {groups.map((g) => (
        <div key={g.system} className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{g.system}</div>
          {g.items.map(labRow)}
        </div>
      ))}
      {condItems.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Condition-specific (based on PMH)</div>
          {condItems.map(labRow)}
        </div>
      )}

      {extras.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Added labs</div>
          <div className="flex flex-wrap gap-2">
            {extras.map((e) => (
              <span key={e.type} className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-700">
                <span className="font-medium text-slate-800">{e.type}</span> {e.value} {e.unit}
                <button type="button" onClick={() => removeExtra(e.type)} className="ml-0.5 text-slate-400 hover:text-red-500" aria-label="remove">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5 border-t border-slate-200 pt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Add another lab</div>
        <div className="flex items-center gap-2">
          <input type="text" className={cell} placeholder="e.g. sodium" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExtra(); } }} />
          <input type="text" className={cell} placeholder="value, e.g. 137" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExtra(); } }} />
          <input type="text" className={cell} placeholder="unit, e.g. mmol/L" value={unit} onChange={(e) => setUnit(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExtra(); } }} />
          <button type="button" onClick={addExtra} disabled={!name.trim() || !val.trim()} className="shrink-0 rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300">Add</button>
        </div>
      </div>
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
        {field.fields.map((sf) => {
          const warn = rangeWarn((value && value[sf.id]) || "", sf.range, sf.unit);
          return (
            <div key={sf.id} className="space-y-1">
              <span className="block text-xs font-medium text-slate-500">{sf.label}</span>
              <input
                type="text"
                title={warn || undefined}
                className={INPUT_BASE + (warn ? " border-amber-400 focus:border-amber-500 focus:ring-amber-200" : "")}
                placeholder={sf.placeholder || ""}
                value={(value && value[sf.id]) || ""}
                onChange={(e) => set(sf.id, e.target.value)}
              />
              {warn && <p className="text-[11px] font-medium leading-tight text-amber-600">⚠ recheck</p>}
            </div>
          );
        })}
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
          className={INPUT_BASE + (field.valueUnit ? " pr-9" : "") + (rangeWarn(v.value, field.range, field.valueUnit) ? " border-amber-400 focus:border-amber-500 focus:ring-amber-200" : "")}
          placeholder={field.valuePlaceholder || "value"}
          value={v.value || ""}
          onChange={(e) => set("value", e.target.value)}
        />
        {field.valueUnit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{field.valueUnit}</span>
        )}
      </div>
      {rangeWarn(v.value, field.range, field.valueUnit) && <p className="text-xs font-medium text-amber-600">⚠ {rangeWarn(v.value, field.range, field.valueUnit)}</p>}
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

function ComprehensiveEval({ formData, setField }) {
  const visit = formData.__visit || "initial";
  const checks = formData.__eval || {};
  const [showAll, setShowAll] = useState(false);
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const cov = computeCoverage(formData);
  const pct = cov.total ? Math.round((cov.doneCount / cov.total) * 100) : 0;
  const setVisit = (v) => setField("__visit", v);
  const toggle = (id) => setField("__eval", { ...checks, [id]: !checks[id] });
  const visitLabel = (VISITS.find((v) => v.key === visit) || VISITS[0]).label;
  const isDone = (it) => (it.link ? linkSatisfied(it.link, formData) : false) || !!checks[it.id];
  const FOCUS = " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1";
  const [expanded, setExpanded] = useState({});
  const isOpen = (grp) => !!expanded[grp];
  const toggleGroup = (grp) => setExpanded((e) => ({ ...e, [grp]: !e[grp] }));
  const Chevron = ({ open }) => (
    <svg className={"h-4 w-4 shrink-0 text-slate-400 transition-transform" + (open ? " rotate-180" : "")} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 7.5 L10 12.5 L15 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const renderRow = (it, isPlan) => {
    const auto = !isPlan && it.link ? linkSatisfied(it.link, formData) : false;
    const done = auto || !!checks[it.id];
    return (
      <button
        key={it.id}
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={it.label + (auto ? ", auto-completed from entered data" : "")}
        aria-disabled={auto}
        onClick={() => !auto && toggle(it.id)}
        disabled={auto}
        className={
          "flex w-full items-start gap-2.5 rounded-lg border border-l-4 px-3 py-2 text-left text-sm transition" + FOCUS + " " +
          (done ? "border-teal-600 border-l-teal-600 bg-teal-50 text-slate-800" : "border-slate-300 border-l-slate-300 bg-white text-slate-700 hover:border-teal-400") +
          (auto ? " cursor-default" : " cursor-pointer")
        }
      >
        <span className={"mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border " + (done ? "border-teal-700 bg-teal-700" : "border-slate-300 bg-white")}>
          {done && (
            <svg className="h-3 w-3 text-white" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8.3 6.2 11.5 13 4.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="flex-1 leading-snug">{it.label}</span>
        {auto && <span className="shrink-0 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800">auto</span>}
      </button>
    );
  };

  const groupStat = (g) => {
    const dueReq = g.items.filter((it) => dueAt(it, visit));
    return { done: dueReq.filter(isDone).length, total: dueReq.length };
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-teal-700">Comprehensive evaluation</h2>
        <span className="text-right text-xs text-slate-400">ADA Standards of Care · Table 4.1</span>
      </div>

      <div role="radiogroup" aria-label="Evaluation visit type" className="mb-3 grid grid-cols-3 gap-2">
        {VISITS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="radio"
            aria-checked={visit === v.key}
            onClick={() => setVisit(v.key)}
            className={"rounded-lg border px-3 py-2 text-sm font-semibold transition" + FOCUS + " " + (visit === v.key ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-teal-400")}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mb-3" role="status" aria-live="polite">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>{cov.doneCount} / {cov.total} components documented</span>
          <span className="font-semibold text-teal-700">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${cov.doneCount} of ${cov.total} components documented`}>
          <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: pct + "%" }} />
        </div>
      </div>

      <p className="mb-2 text-xs text-slate-500">Components due at the <span className="font-semibold text-slate-700">{visitLabel}</span> visit. Labs and vitals entered above auto-complete their rows. Tap a section to expand it.</p>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button type="button" aria-pressed={outstandingOnly} onClick={() => setOutstandingOnly((s) => !s)} className={"text-xs font-medium text-teal-700 hover:underline" + FOCUS}>
          {outstandingOnly ? "Show all due components" : "Show outstanding only"}
        </button>
        {!outstandingOnly && (
          <button type="button" aria-pressed={showAll} onClick={() => setShowAll((s) => !s)} className={"text-xs font-medium text-teal-700 hover:underline" + FOCUS}>
            {showAll ? "Hide components not due" : "Show components not due"}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {EVAL_TABLE.map((g) => {
          const stat = groupStat(g);
          const open = isOpen(g.group) || outstandingOnly || showAll;
          let arr;
          if (outstandingOnly) arr = g.items.filter((it) => dueAt(it, visit) && !isDone(it));
          else arr = showAll ? g.items : g.items.filter((it) => dueAt(it, visit));
          if (!arr.length) return null;
          return (
            <div key={g.group} className="overflow-hidden rounded-lg border border-slate-200">
              <button type="button" onClick={() => toggleGroup(g.group)} aria-expanded={open}
                className={"flex w-full items-center justify-between gap-2 bg-slate-50 px-3 py-2 text-left" + FOCUS}>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{g.group}</span>
                <span className="flex items-center gap-2">
                  {stat.total > 0 && <span className={"text-[11px] font-medium " + (stat.done === stat.total ? "text-teal-700" : "text-slate-400")}>{stat.done}/{stat.total}</span>}
                  <Chevron open={open} />
                </span>
              </button>
              {open && (
                <div className="space-y-1.5 p-2.5">
                  {arr.map((it) =>
                    dueAt(it, visit) ? (
                      renderRow(it, false)
                    ) : (
                      <div key={it.id} className="flex items-start gap-2.5 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-300">
                        <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-slate-200" />
                        <span className="flex-1 leading-snug">{it.label} · not due this visit</span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

const FULL_WIDTH_TYPES = ["textarea", "chips", "valuebuilder", "labsystems", "medbuilder", "medtable", "group", "valuedate"];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
function CgmMetrics({ formData, setField }) {
  const c = formData.__cgm || {};
  const set = (k, v) => setField("__cgm", { ...c, [k]: v });
  const num = (x) => firstNumber(x);
  const tar = (num(c.tar1) || 0) + (num(c.tar2) || 0);
  const tbr = (num(c.tbr1) || 0) + (num(c.tbr2) || 0);
  const hasTar = num(c.tar1) != null || num(c.tar2) != null;
  const hasTbr = num(c.tbr1) != null || num(c.tbr2) != null;
  const r1 = (x) => Math.round(x * 10) / 10;
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Glucose-distribution metrics (CGM)</div>
      <p className="text-xs text-slate-500">Nonpregnant T1DM targets (ADA / AGP). Enter the AGP percentages from the report.</p>
      <div className="space-y-1.5">
        {CGM_METRICS.map((m) => {
          const v = c[m.id] || "";
          const n = num(v);
          const ok = (m.ok && n != null) ? m.ok(n) : null;
          const warn = rangeWarn(v, m.range, m.unit);
          return (
            <div key={m.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2/5 shrink-0 text-sm text-slate-600">{m.label}</span>
                <div className="relative flex-1 min-w-0">
                  <input type="text" inputMode="decimal" className={INPUT_BASE + " pr-10" + (warn ? " border-amber-400 focus:border-amber-500 focus:ring-amber-200" : "")} placeholder="value" value={v} onChange={(e) => set(m.id, e.target.value)} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{m.unit}</span>
                </div>
                <span className="hidden w-28 shrink-0 text-right text-[11px] leading-tight text-slate-400 sm:block">{m.target}</span>
                {ok != null && <span className={"shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold " + (ok ? "bg-teal-100 text-teal-800" : "bg-rose-100 text-rose-600")}>{ok ? "at target" : "off target"}</span>}
              </div>
              {warn && <p className="ml-[40%] pl-2 text-xs font-medium text-amber-600">⚠ {warn}</p>}
            </div>
          );
        })}
      </div>
      {(hasTar || hasTbr) && (
        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          {hasTar && <span className={"rounded-md px-2 py-1 font-medium ring-1 " + (tar < 25 ? "bg-teal-50 text-teal-700 ring-teal-200" : "bg-rose-50 text-rose-600 ring-rose-200")}>Combined TAR {r1(tar)}% (target &lt;25%)</span>}
          {hasTbr && <span className={"rounded-md px-2 py-1 font-medium ring-1 " + (tbr < 4 ? "bg-teal-50 text-teal-700 ring-teal-200" : "bg-rose-50 text-rose-600 ring-rose-200")}>Combined TBR {r1(tbr)}% (target &lt;4%)</span>}
        </div>
      )}
    </div>
  );
}

function IsfCalculator({ formData, setField }) {
  const isf = formData.__isf || {};
  const set = (k, v) => setField("__isf", { ...isf, [k]: v });
  const type = isf.type || "rapid";
  const tdd = firstNumber(isf.tdd);
  const rule = type === "regular" ? 1500 : 1800;
  const result = tdd && tdd > 0 ? Math.round(rule / tdd) : null;
  const warn = rangeWarn(isf.tdd, [1, 500], "units");
  return (
    <div className="space-y-2 border-t border-slate-200 pt-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Correction factor / ISF</div>
      <p className="text-xs text-slate-500">ISF = 1800 ÷ TDD (rapid analog) or 1500 ÷ TDD (regular). 1 unit lowers glucose by ~ISF mg/dL.</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="block text-xs font-medium text-slate-500">Total daily dose (TDD)</span>
          <div className="relative w-32">
            <input type="text" inputMode="decimal" className={INPUT_BASE + " pr-12" + (warn ? " border-amber-400 focus:border-amber-500 focus:ring-amber-200" : "")} placeholder="e.g. 40" value={isf.tdd || ""} onChange={(e) => set("tdd", e.target.value)} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">units</span>
          </div>
        </div>
        <div className="space-y-1">
          <span className="block text-xs font-medium text-slate-500">Insulin type</span>
          <div className="flex gap-2">
            {[["rapid", "Rapid analog"], ["regular", "Regular"]].map(([k, lbl]) => (
              <button key={k} type="button" onClick={() => set("type", k)} className={"rounded-lg border px-3 py-2 text-sm font-semibold transition " + (type === k ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-teal-400")}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>
      {warn && <p className="text-xs font-medium text-amber-600">⚠ {warn}</p>}
      {result != null && (
        <div className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
          <span className="font-semibold">ISF ≈ {result} mg/dL per unit</span> <span className="text-teal-700">({rule} ÷ {tdd})</span>
        </div>
      )}
    </div>
  );
}

const DRAFT_KEY = "ambuscribe:diabetes";

export default function AmbuScribe() {
  const [encounterKey] = useState("diabetes");
  // Draft persists for the browser SESSION only (sessionStorage) — survives in-app navigation
  // and refresh, and is cleared when the tab closes. Nothing leaves the device.
  const [formData, setFormData] = useState(() => {
    try { const s = sessionStorage.getItem(DRAFT_KEY); return s ? JSON.parse(s) : {}; } catch (e) { return {}; }
  });
  const [note, setNote] = useState("");
  const [flags, setFlags] = useState([]);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  useEffect(() => {
    try {
      if (Object.keys(formData).length) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }, [formData]);

  const enc = ENCOUNTERS[encounterKey];

  const hasInput = useMemo(() => {
    const anyField = enc.fields.some((f) => fieldHasValue(f, formData[f.id]));
    const anyEval = Object.values(formData.__eval || {}).some(Boolean);
    return anyField || (formData.__cpPlan || "").trim().length > 0 || anyEval;
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
      case "labsystems":
        return <LabsField field={f} value={v || []} onChange={set} formData={formData} />;
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
  const attestation = () => {
    if (!formData.__preceptor) return "";
    const p = PRECEPTORS.find((x) => x.name === formData.__preceptor);
    return `\n\n${formData.__preceptor}${p && p.title ? ", " + p.title : ""}`;
  };

  function generate() {
    setCopied(false);
    const soa = buildSOA();
    const t1 = buildT1dmObjective(formData);
    if (t1) soa.o = soa.o === "Not documented." ? t1 : soa.o + "\n" + t1;
    const evalSummary = buildEvalSummary(formData);
    const note = `${soaBlock(soa)}\n\n${buildPlanText(cpPlanText())}${evalSummary ? "\n\n" + evalSummary : ""}${attestation()}`;
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

  const sansStack = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-50 text-slate-800" style={{ fontFamily: sansStack }}>
      <header className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl px-7 py-6 shadow-sm" style={{ background: "linear-gradient(150deg, var(--teal-700), var(--teal-950))" }}>
          <div className="pointer-events-none absolute inset-0 opacity-50" style={{ background: "radial-gradient(110% 130% at 92% -20%, rgba(255,255,255,0.14), transparent 55%), repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 12px)" }} />
          <div className="relative flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white" style={{ background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.18)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)" }}>Rx</div>
            <div>
              <h1 className="text-2xl font-semibold leading-tight text-white" style={{ fontFamily: "'Newsreader', Georgia, serif" }}>AmbuScribe</h1>
              <p className="text-sm leading-tight" style={{ color: "var(--teal-100)" }}>Ambulatory Care SOAP Note Assistant</p>
            </div>
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

            {((formData.pmh && formData.pmh.selected) || []).includes("T1DM") && (
              <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wide text-teal-700">Type 1 diabetes — glucose metrics &amp; insulin</h2>
                <CgmMetrics formData={formData} setField={setField} />
                <IsfCalculator formData={formData} setField={setField} />
              </div>
            )}

            <ComprehensiveEval formData={formData} setField={setField} />

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
              <p className="mb-2 text-xs text-slate-500">Signs the note with the supervising pharmacist's name and title.</p>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-9 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200"
                  value={formData.__preceptor || ""}
                  onChange={(e) => setField("__preceptor", e.target.value)}
                >
                  <option value="">— select —</option>
                  {PRECEPTORS.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
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
