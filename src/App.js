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
// Umbrella brand mark (rounded medical cross) — used on the gate + top nav.
function BrandMark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9.4" y="3" width="5.2" height="18" rx="2.4" fill="#fff" />
      <rect x="3" y="9.4" width="18" height="5.2" rx="2.4" fill="#fff" />
    </svg>
  );
}

/* ---------------- sign-in gate ---------------- */
function MockAuthGate({ onEnter }) {
  const [name, setName] = useState("");
  const submit = () => onEnter(name.trim() || "Guest clinician");
  return (
    <div className="gate">
      <div className="gate-aurora" aria-hidden="true"></div>
      <div className="gate-card">
        <div className="gate-hd">
          <div className="gate-tex"></div>
          <div className="gate-tile"><BrandMark size={26} /></div>
          <div className="gate-hd-text">
            <h1 className="gate-title serif">Ambulatory Care Pharmacy</h1>
            <p className="gate-sub">Clinical documentation toolkit</p>
          </div>
        </div>
        <div className="gate-body">
          <label className="lbl" htmlFor="gate-name">Your name</label>
          <input id="gate-name" className="input gate-input" value={name} placeholder="e.g. Dr. Aseel" autoFocus
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <button className="btn-primary gate-btn" onClick={submit}>Continue →</button>

          <div className="gate-tools">
            <div className="gate-tools-label">Available encounters</div>
            <div className="gate-tool">
              <span className="gate-tool-ic drop"><DropIcon size={16} /></span>
              <div>
                <div className="gate-tool-name">Anticoagulation Clinic</div>
                <div className="gate-tool-desc">Warfarin maintenance dosing</div>
              </div>
            </div>
            <div className="gate-tool">
              <span className="gate-tool-ic doc"><DocIcon size={16} /></span>
              <div>
                <div className="gate-tool-name">Diabetes Mellitus</div>
                <div className="gate-tool-desc">AmbuScribe SOAP generator</div>
              </div>
            </div>
          </div>

          <p className="gate-disclaimer">
            <strong>Not for clinical use.</strong> Evaluation only — nothing is stored or sent. Do not enter real patient identifiers.
          </p>
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
          <span className="brand-tile"><BrandMark size={17} /></span>
          <span className="brand-name">Ambulatory Care</span>
        </Link>
        <nav className="site-nav">
          <NavLink to="/warfarin" className={linkClass}>Anticoagulation Clinic</NavLink>
          <NavLink to="/diabetes" className={linkClass}>Diabetes Mellitus</NavLink>
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
        <p>Open any of the following documentation tool.</p>
      </div>
      <div className="enc-grid">
        <Link to="/warfarin" className="enc-card">
          <div className="enc-ic" style={{ background: "linear-gradient(150deg, #fbe2e6, #f6cdd3)" }}><DropIcon size={26} /></div>
          <h2 className="serif">Anticoagulation Clinic</h2>
          <p>Warfarin maintenance dose-adjustment based on KSUMC Anticoagulation Clinic Guideline.</p>
          <span className="enc-go">Open Warfarin tool →</span>
        </Link>
        <Link to="/diabetes" className="enc-card">
          <div className="enc-ic" style={{ background: "linear-gradient(150deg, #d3eef0, #bfe3e6)" }}><DocIcon size={26} /></div>
          <h2 className="serif">Diabetes Mellitus</h2>
          <p>AmbuScribe — Ambulatory Care SOAP assistant generator.</p>
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
  // Persist sign-in for the browser session so reloading or deep-linking to
  // /warfarin or /diabetes doesn't drop back to the gate (cleared on sign-out
  // or when the tab closes). Evaluation only — just a display name, no auth.
  const [user, setUser] = useState(() => {
    try { return sessionStorage.getItem("acp-user"); } catch (e) { return null; }
  });
  const enter = (name) => { try { sessionStorage.setItem("acp-user", name); } catch (e) {} setUser(name); };
  const signOut = () => { try { sessionStorage.removeItem("acp-user"); } catch (e) {} setUser(null); };
  if (!user) return <MockAuthGate onEnter={enter} />;
  return (
    <BrowserRouter>
      <Layout user={user} onSignOut={signOut}>
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
