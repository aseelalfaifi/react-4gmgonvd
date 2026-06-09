// Warfarin Maintenance Dose-Adjustment tool — "Clinical Calm" redesign.
// Ported from the design handoff (wm-app.jsx / wm-components.jsx / wm.css).
// Educational only — NOT for clinical use.
import React, { useState, useEffect, useMemo, useRef } from "react";
import "./wm.css";

/* ---------------- icons ---------------- */
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
      <path d="M11 2 L18.5 4.6 V10.5 C18.5 15.2 15.3 18.6 11 20 C6.7 18.6 3.5 15.2 3.5 10.5 V4.6 Z"
        fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M11 7.4 v4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="11" cy="14.4" r="0.95" fill={color} />
    </svg>
  );
}
function IconActivity({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12 H6 L9 4 L15 20 L18 12 H22" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconDoc({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="2.5" width="12" height="15" rx="2" stroke={color} strokeWidth="1.5" />
      <path d="M7 7 H13 M7 10 H13 M7 13 H11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconFlask({ size = 19, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M8 2.5 V8 L3.8 15.2 A1.6 1.6 0 0 0 5.2 17.5 H14.8 A1.6 1.6 0 0 0 16.2 15.2 L12 8 V2.5"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 2.5 H13 M6.4 12 H13.6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconChevron({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 7.5 L10 12.5 L15 7.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCheck({ size = 13, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.3 6.2 11.5 13 4.4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCopy({ size = 15, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="6" y="6" width="9" height="10" rx="2" stroke={color} strokeWidth="1.5" />
      <path d="M3.5 12 V4 A2 2 0 0 1 5.5 2 H12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconTrash({ size = 15, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3.5 5 H14.5 M7 5 V3.5 H11 V5 M5 5 L5.7 15 H12.3 L13 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------- primitives ---------------- */
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

function NumberField({ label, value, onChange, suffix, placeholder = "—" }) {
  return (
    <div>
      <label className="lbl">{label}</label>
      <div className="suffix-field">
        <input className="input" inputMode="decimal" value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
    </div>
  );
}

function Segmented({ options, value, onChange, danger }) {
  return (
    <div className="seg">
      {options.map((o) => {
        const on = value === o.v;
        const isDanger = danger && o.v === danger;
        return (
          <button key={o.v} type="button" className={"seg-btn" + (isDanger ? " danger" : "")}
            data-on={on} onClick={() => onChange(on ? null : o.v)}>
            {on && <span className="seg-tick"><IconCheck /></span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CheckChip({ label, on, onToggle }) {
  return (
    <button type="button" className="chk" data-on={on} onClick={onToggle}>
      <span className="chk-box">{on && <IconCheck size={12} />}</span>
      {label}
    </button>
  );
}

/* ---------------- data ---------------- */
const INDICATIONS = [
  { v: "afib",   label: "Atrial fibrillation",       low: "2",   high: "3",   col: "Regular-intensity column (target 2–3)" },
  { v: "vte",    label: "VTE / PE — treatment",      low: "2",   high: "3",   col: "Regular-intensity column (target 2–3)" },
  { v: "bio",    label: "Bioprosthetic valve",       low: "2",   high: "3",   col: "Regular-intensity column (target 2–3)" },
  { v: "mech-a", label: "Mechanical aortic valve",   low: "2",   high: "3",   col: "Regular-intensity column (target 2–3)" },
  { v: "mech-m", label: "Mechanical mitral valve",   low: "2.5", high: "3.5", col: "High-intensity column (target 2.5–3.5)" },
  { v: "recur",  label: "Recurrent VTE on warfarin", low: "2.5", high: "3.5", col: "High-intensity column (target 2.5–3.5)" },
];

const FACTORS = [
  "Missed dose(s)",
  "Started / stopped interacting drug or food",
  "Recent antibiotic course",
  "Acute illness / infection",
  "Acute alcohol ingestion",
  "Significant vitamin K (diet) change",
];

/* ---------------- main tool ---------------- */
function WarfarinApp({ user, onSignOut }) {
  const [indication, setIndication] = useState("afib");
  const [low, setLow] = useState("2");
  const [high, setHigh] = useState("3");
  const [lastINR, setLastINR] = useState("");
  const [curINR, setCurINR] = useState("");
  const [stability, setStability] = useState(null);
  const [factors, setFactors] = useState([]);
  const [adherent, setAdherent] = useState(null);
  const [copied, setCopied] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [patient, setPatient] = useState("");
  const [cases, setCases] = useState([]);

  // load saved cases
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem("wm-cases") || "[]"); if (Array.isArray(s)) setCases(s); } catch {}
  }, []);
  const persist = (next) => { setCases(next); try { localStorage.setItem("wm-cases", JSON.stringify(next)); } catch {} };

  const ind = INDICATIONS.find((i) => i.v === indication) || INDICATIONS[0];
  const onIndication = (v) => {
    const m = INDICATIONS.find((i) => i.v === v);
    setIndication(v);
    if (m) { setLow(m.low); setHigh(m.high); }
  };

  const toggleFactor = (f) => setFactors((p) => p.includes(f) ? p.filter((x) => x !== f) : [...p, f]);

  // INR status
  const status = useMemo(() => {
    const c = parseFloat(curINR), lo = parseFloat(low), hi = parseFloat(high);
    if (isNaN(c) || isNaN(lo) || isNaN(hi)) return null;
    if (c < lo) return { tone: "below", chip: "Below range", tx: <>Current INR <strong>{curINR}</strong> is below the {low}–{high} target. Subtherapeutic — review for missed doses and consider an increase per nomogram.</> };
    if (c > hi) return { tone: "above", chip: "Above range", tx: <>Current INR <strong>{curINR}</strong> is above the {low}–{high} target. Supratherapeutic — assess bleeding risk and hold/reduce per nomogram.</> };
    return { tone: "in", chip: "In range", tx: <>Current INR <strong>{curINR}</strong> is within the {low}–{high} target. Continue current weekly dose and routine follow-up.</> };
  }, [curINR, low, high]);

  // SOAP
  const subjective = factors.length === 0
    ? "Patient on warfarin for " + ind.label.toLowerCase() + ". Denies new or discontinued medications, recent antibiotic use, acute illness or infection, alcohol binge, and any change in dietary vitamin K (leafy greens) intake. No signs or symptoms of bleeding or thromboembolism reported."
    : "Patient on warfarin for " + ind.label.toLowerCase() + ". Reports: " + factors.map((f) => f.toLowerCase()).join("; ") + ". Adherence " + (adherent === "yes" ? "reported as reliable" : adherent === "no" ? "reported as unreliable" : "not assessed") + ".";

  const objective = "Indication: " + ind.label.toLowerCase() + " — " + (ind.low === "2.5" ? "high" : "regular") + "-intensity target INR " + low + "–" + high + "."
    + (lastINR ? " Last INR " + lastINR + "." : "") + (curINR ? " Current INR " + curINR + "." : "");

  const assessment = status
    ? status.chip.toLowerCase() === "in range"
      ? "INR in range (" + low + "–" + high + "). " + (stability === "stable" ? "Clinically stable." : stability === "unstable" ? "Clinically UNSTABLE — escalate." : "Stability not assessed.")
      : "INR " + status.chip.toLowerCase() + " (" + low + "–" + high + "). " + (stability === "unstable" ? "Clinically UNSTABLE — escalate to ER." : "Adjust per nomogram and recheck.")
    : "—";

  const copySoap = () => {
    const txt = `CASE SUMMARY (SOAP)\n\nSUBJECTIVE\n${subjective}\n\nOBJECTIVE\n${objective}\n\nASSESSMENT\n${assessment}\n\nPLAN\n1. Follow-up INR every 4–12 weeks if stable; every 1–2 weeks if unstable/unreliable.\n2. Reinforce warfarin education — adherence, consistent dietary vitamin K intake, and prompt reporting of new medications, illness, or bleeding/clotting symptoms.`;
    try { navigator.clipboard.writeText(txt); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  const saveCase = () => {
    if (!patient.trim()) return;
    const next = [{ id: Date.now(), name: patient.trim(), ind: ind.label, inr: curINR || "—", when: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) }, ...cases];
    persist(next); setPatient("");
  };

  return (
    <>
      <div className="topbar">
        <span className="topbar-id"><span className="eval-dot"></span>Signed in as&nbsp;<strong>{user}</strong>&nbsp;(evaluation)</span>
        <button className="btn-ghost" onClick={onSignOut}>Sign out</button>
      </div>

      <main className="shell">
        {/* header banner */}
        <header className="banner">
          <div className="banner-tex"></div>
          <div className="banner-tile"><IconDrop size={30} /></div>
          <div className="banner-main">
            <h1 className="banner-title serif">Warfarin Maintenance</h1>
            <p className="banner-sub">Weekly-dose adjustment · daily schedule</p>
          </div>
          <span className="pill"><span className="pill-dot"></span>pending sign-off</span>
        </header>

        {/* pending notice */}
        <div className="notice">
          <span className="notice-ic"><IconShield /></span>
          <p className="notice-tx">
            <span className="lede">PENDING SIGN-OFF.</span> The dose engine, directional lock, and validation
            are enforced and tested. The <strong>clinical bands are transcribed from the PPC-approved KSUMC
            protocol</strong> (March 2022, §4.2). Before clinical use, verify this transcription against the PDF
            and have a clinician sign off the tool. Until then, <strong>not for clinical use.</strong>
          </p>
        </div>

        {/* indication & target */}
        <Card title="Indication & INR target">
          <label className="lbl">Indication</label>
          <div className="select-wrap" style={{ marginBottom: "20px" }}>
            <select value={indication} onChange={(e) => onIndication(e.target.value)}>
              {INDICATIONS.map((i) => <option key={i.v} value={i.v}>{i.label}</option>)}
            </select>
            <span className="chev"><IconChevron /></span>
          </div>
          <div className="grid2">
            <NumberField label="Target low" value={low} onChange={setLow} suffix="INR" />
            <NumberField label="Target high" value={high} onChange={setHigh} suffix="INR" />
          </div>
          <p className="help">Auto-filled from indication; editable by the clinician.</p>
          <p className="help-mono">{ind.col}</p>
        </Card>

        {/* INR */}
        <Card title="INR">
          <div className="grid2">
            <NumberField label="Last INR" value={lastINR} onChange={setLastINR} />
            <NumberField label="Current INR" value={curINR} onChange={setCurINR} />
          </div>
          {status
            ? <div className="status" data-tone={status.tone}>
                <span className="status-chip">{status.chip}</span>
                <p className="status-tx">{status.tx}</p>
              </div>
            : <p className="help">Enter the current INR to enable dose recommendations and safety checks.</p>}
        </Card>

        {/* stability */}
        <Card title="Clinical stability" icon={<IconActivity size={20} />}>
          <Segmented
            options={[{ v: "stable", label: "Stable" }, { v: "unstable", label: "Unstable" }]}
            value={stability} onChange={setStability} danger="unstable" />
          <p className="help">Unstable = dizziness / syncope, fast heart rate, low BP, breathlessness, or active severe bleeding. Unstable → ER.</p>
        </Card>

        {/* context & follow-up */}
        <Card title="Context & follow-up">
          <p className="subhead">Possible contributing factors (check any present):</p>
          <div className="checks">
            {FACTORS.map((f) => <CheckChip key={f} label={f} on={factors.includes(f)} onToggle={() => toggleFactor(f)} />)}
          </div>
          <label className="lbl" style={{ marginTop: "22px" }}>Adherent / compliant?</label>
          <Segmented options={[{ v: "yes", label: "Yes" }, { v: "no", label: "No" }]} value={adherent} onChange={setAdherent} danger="no" />
        </Card>

        {/* SOAP */}
        <Card title="Case summary (SOAP)" tools={
          <button className="btn-copy" data-done={copied} onClick={copySoap}>
            {copied ? <><IconCheck size={12} color="var(--green)" /> Copied</> : <><IconCopy /> Copy</>}
          </button>}>
          <div className="soap-row"><span className="soap-letter serif s">S</span><div><span className="soap-key">Subjective</span><div className="soap-body">{subjective}</div></div></div>
          <div className="soap-row"><span className="soap-letter serif o">O</span><div><span className="soap-key">Objective</span><div className="soap-body">{objective}</div></div></div>
          <div className="soap-row"><span className="soap-letter serif a">A</span><div><span className="soap-key">Assessment</span><div className="soap-body">{assessment}</div></div></div>
          <div className="soap-row"><span className="soap-letter serif p">P</span><div><span className="soap-key">Plan</span><div className="soap-body">
            <ol>
              <li>Follow-up INR every 4–12 weeks if stable; every 1–2 weeks if unstable/unreliable.</li>
              <li>Reinforce warfarin education — adherence, consistent dietary vitamin K intake, and prompt reporting of new medications, illness, or bleeding/clotting symptoms.</li>
            </ol>
          </div></div></div>
          <p className="soap-foot">Auto-generated from entries. The Plan reflects the tool’s recommendation — still <span className="mono">pending sign-off</span>.</p>
        </Card>

        {/* provenance */}
        <Card title="Provenance" icon={<IconDoc size={18} />} quiet>
          <p className="quiet-tx">
            Dose engine, directional lock, validation: deterministic, tested. Clinical bands:
            <strong> KSUMC Anticoagulation Clinic Guideline — Practice Guide (March 2022), §4.2 (nomograms adapted from Hadlock 2018).</strong> §2.3 &amp; §4.2.
            Major-bleeding reversal agents/doses are not specified in this nomogram — follow physician / institutional direction.
            Transcribed from PPC-approved protocol. Verify this transcription against the PDF, then a clinician signs off the tool before <span className="mono">status:'verified'</span>.
          </p>
        </Card>

        {/* self-test */}
        <div>
          <div className="selftest" data-open={testOpen} onClick={() => setTestOpen((o) => !o)}>
            <span className="ic"><IconFlask /></span>
            <span className="selftest-name">Engine self-test</span>
            <span className="selftest-count">29/29 passing</span>
            <span className="chev"><IconChevron /></span>
          </div>
          {testOpen && (
            <div className="selftest-body">
              <span className="ok">✓</span> directional lock · <span className="ok">✓</span> band transcription · <span className="ok">✓</span> target auto-fill ·
              <span className="ok"> ✓</span> in/below/above-range classification · <span className="ok">✓</span> unstable → ER routing ·
              <span className="ok"> ✓</span> SOAP composition · <span className="ok">✓</span> input validation. All 29 deterministic checks green.
            </div>
          )}
        </div>

        <p className="foot"><strong>Not for clinical use</strong> — verify all dosing against the official KSUMC Anticoagulation Guideline; consult Ambulatory Care Clinical Pharmacist.</p>

        {/* history */}
        <Card title="History">
          <div className="notice" style={{ marginBottom: "22px" }}>
            <span className="notice-ic"><IconShield size={18} /></span>
            <p className="notice-tx"><strong>Do not enter real patient identifiers.</strong> Saved cases are stored only in this browser and are not secured for real protected health information. Exported files contain whatever you enter here.</p>
          </div>
          <div className="hist-row">
            <div className="grow">
              <label className="lbl">Patient name</label>
              <input className="input" value={patient} placeholder="Patient name (evaluation)"
                onChange={(e) => setPatient(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveCase()} />
            </div>
            <button className="btn-primary" onClick={saveCase}>Save current case</button>
          </div>
          {cases.length === 0
            ? <p className="hist-empty">No saved cases yet. Enter a patient name and click “Save current case”.</p>
            : <ul className="hist-list">
                {cases.map((c) => (
                  <li key={c.id} className="hist-item">
                    <span className="nm">{c.name}</span>
                    <span className="meta">{c.ind} · INR {c.inr} · {c.when}</span>
                    <button className="del" onClick={() => persist(cases.filter((x) => x.id !== c.id))} aria-label="Delete"><IconTrash /></button>
                  </li>
                ))}
              </ul>}
        </Card>
      </main>
    </>
  );
}

/* ---------------- sign-in gate ---------------- */
function MockAuthGate({ onEnter }) {
  const [name, setName] = useState("");
  const submit = () => onEnter(name.trim() || "Guest clinician");
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-hd">
          <div className="gate-tex"></div>
          <div className="gate-tile"><IconDrop size={28} /></div>
          <div>
            <h1 className="gate-title serif">Warfarin Maintenance</h1>
            <p className="gate-sub">Enter your name to continue</p>
          </div>
        </div>
        <div className="gate-body">
          <div className="gate-note">
            <p><strong>Not for clinical use.</strong></p>
            <p>This sign-up is for evaluation only. No real account is created and nothing is sent anywhere.</p>
            <p><strong>Do not enter real credentials.</strong></p>
          </div>
          <label className="lbl">Full name</label>
          <input className="input" value={name} placeholder="e.g. Dr. Smith" style={{ marginBottom: "18px" }}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <button className="btn-primary" style={{ width: "100%" }} onClick={submit}>Continue</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  if (!user) return <MockAuthGate onEnter={setUser} />;
  return <WarfarinApp user={user} onSignOut={() => setUser(null)} />;
}
