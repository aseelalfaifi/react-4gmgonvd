// Ambulatory Care Pharmacy — unified site shell.
// Sign-in gate → encounter selector → two encounter tools:
//   /warfarin  → Anticoagulation Clinic (Warfarin Maintenance)
//   /diabetes  → Diabetes (T2DM) (AmbuScribe SOAP assistant)
// Evaluation only — NOT for clinical use.
import React, { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Link, Navigate } from "react-router-dom";
import WarfarinApp from "./WarfarinTool";
import AmbuScribe from "./AmbuScribe";
import "./wm.css";

/* ---------------- icons ---------------- */
function DropIcon({ size = 26 }) {
  const id = "gdrop" + size;
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
function DocIcon({ size = 26, color = "var(--teal-700)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2.5" stroke={color} strokeWidth="1.6" />
      <path d="M8.5 8 H15.5 M8.5 12 H15.5 M8.5 16 H13" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
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
          <div className="gate-tile"><DropIcon size={28} /></div>
          <div>
            <h1 className="gate-title serif">Ambulatory Care Pharmacy</h1>
            <p className="gate-sub">Clinical documentation tools — enter your name to continue</p>
          </div>
        </div>
        <div className="gate-body">
          <div className="gate-note">
            <p><strong>Not for clinical use.</strong></p>
            <p>For evaluation only. No real account is created and nothing is sent anywhere.</p>
            <p><strong>Do not enter real patient identifiers.</strong></p>
          </div>
          <label className="lbl" htmlFor="gate-name">Full name</label>
          <input id="gate-name" className="input" value={name} placeholder="e.g. Dr. Aseel" style={{ marginBottom: "18px" }}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <button className="btn-primary" style={{ width: "100%" }} onClick={submit}>Continue</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- shared site shell ---------------- */
function Layout({ user, onSignOut, children }) {
  const linkClass = ({ isActive }) => "nav-link" + (isActive ? " active" : "");
  return (
    <>
      <div className="topbar site-topbar">
        <Link to="/" className="brand">
          <span className="brand-tile"><DropIcon size={18} /></span>
          <span className="brand-name">Ambulatory Care</span>
        </Link>
        <nav className="site-nav">
          <NavLink to="/warfarin" className={linkClass}>Anticoagulation Clinic</NavLink>
          <NavLink to="/diabetes" className={linkClass}>Diabetes</NavLink>
        </nav>
        <div className="site-user">
          <span className="topbar-id"><span className="eval-dot"></span>Signed in as&nbsp;<strong>{user}</strong></span>
          <button className="btn-ghost" onClick={onSignOut}>Sign out</button>
        </div>
      </div>
      {children}
    </>
  );
}

/* ---------------- encounter selector ---------------- */
function EncounterHome() {
  return (
    <div className="home">
      <div className="home-hero">
        <h1 className="serif">Select an encounter</h1>
        <p>Open the documentation tool for the clinic encounter you're seeing.</p>
      </div>
      <div className="enc-grid">
        <Link to="/warfarin" className="enc-card">
          <div className="enc-ic" style={{ background: "linear-gradient(150deg, #fbe2e6, #f6cdd3)" }}><DropIcon size={26} /></div>
          <h2 className="serif">Anticoagulation Clinic</h2>
          <p>Warfarin maintenance dose-adjustment — KSUMC nomogram bands, directional lock, weekly schedule, and SOAP summary.</p>
          <span className="enc-go">Open Warfarin tool →</span>
        </Link>
        <Link to="/diabetes" className="enc-card">
          <div className="enc-ic" style={{ background: "linear-gradient(150deg, #d3eef0, #bfe3e6)" }}><DocIcon size={26} /></div>
          <h2 className="serif">Diabetes (T2DM)</h2>
          <p>AmbuScribe — ambulatory care SOAP note assistant for diabetes encounters, assembled from structured inputs.</p>
          <span className="enc-go">Open AmbuScribe →</span>
        </Link>
      </div>
      <p className="foot" style={{ marginTop: "30px" }}>
        <strong>Not for clinical use</strong> — evaluation tools. Verify all output and do not enter real patient identifiers.
      </p>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  if (!user) return <MockAuthGate onEnter={setUser} />;
  return (
    <BrowserRouter>
      <Layout user={user} onSignOut={() => setUser(null)}>
        <Routes>
          <Route path="/" element={<EncounterHome />} />
          <Route path="/warfarin" element={<WarfarinApp />} />
          <Route path="/diabetes" element={<AmbuScribe />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
