# Ambulatory Care Pharmacy — Documentation Tools

**Live:** https://ambulatory-care-documentation-tools.vercel.app

A single-page web app that brings two ambulatory-care clinical pharmacy
documentation tools under one sign-in and one URL — each clinic encounter opens
its own tool:

- **Anticoagulation Clinic** (`/warfarin`) — Warfarin maintenance
  dose-adjustment based on the KSUMC Anticoagulation Clinic Guideline: INR /
  nomogram bands, directional lock, weekly schedule + tablet solver, and an
  auto-composed SOAP summary.
- **Diabetes Mellitus** (`/diabetes`) — **AmbuScribe**, an Ambulatory Care SOAP
  note assistant that assembles a SOAP note from structured inputs (labs grouped
  by body system, diabetes regimen builder, deterministic completeness check).

> ⚠️ **Not for clinical use.** Evaluation / educational build only. The clinical
> content is pending clinician sign-off; nothing is stored or transmitted, and
> you should **not enter real patient identifiers**.

## Tech

- React 18 + Create React App (`react-scripts` 5)
- `react-router-dom` for client-side routing (SPA rewrite via `vercel.json`)
- One shared design system ("Clinical Calm") across two styling layers:
  - `src/wm.css` — oklch design tokens + the Warfarin tool & app shell
  - **Tailwind CSS** (compiled with its own CLI to `src/tailwind.output.css`)
    for AmbuScribe, with its theme remapped onto the same tokens so both tools
    match
- Typography: **Inter** (UI), **Newsreader** (headings), **IBM Plex Mono** (labels)

## Routes

| Path        | Tool                                          |
| ----------- | --------------------------------------------- |
| `/`         | Encounter selector                            |
| `/warfarin` | Anticoagulation Clinic — Warfarin Maintenance |
| `/diabetes` | Diabetes Mellitus — AmbuScribe                |

## Local development

Requires Node 18+ and npm.

```bash
npm install
npm run dev        # dev server at http://localhost:3000
```

The `predev` / `prestart` / `prebuild` scripts regenerate the Tailwind CSS
automatically, so there is no separate build step to remember.

Production build:

```bash
npm run build      # outputs to ./build
```

## Deployment

Hosted on **Vercel** — every push to `main` auto-deploys. `vercel.json` rewrites
all paths to `index.html`, so deep links (`/warfarin`, `/diabetes`) and page
refreshes resolve correctly.

## Project structure

```
public/index.html     # fonts + app shell
src/
  App.js              # sign-in gate, router, shared nav, encounter home
  WarfarinTool.jsx    # Warfarin dose-adjustment engine + UI (wm.css)
  AmbuScribe.jsx      # Diabetes SOAP assistant (Tailwind)
  wm.css              # Clinical Calm design system + shell / gate / home
  index.css           # Tailwind directives (compiled to tailwind.output.css)
tailwind.config.js    # Tailwind theme mapped onto the design tokens
vercel.json           # SPA rewrite for deep links
```
