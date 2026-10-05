# Dispatch Mock-UI Implementation Plan

**Goal:** Alle UI-relevanten Backlog-Anteile als durchgängige lokal startbare Anwendung abdecken.
**Architecture:** Gemeinsamer React-Kontext für redaktionelle Domainzustände, ergänzende persistente Mock-Module, React-Router für direkte URLs. UI-Primitives von shadcn/ui; echte Provider sind nicht angebunden.
**Tech Stack:** React, TypeScript, Vite, Tailwind, shadcn/ui, Vitest, Playwright.

- [x] Grundlage (Root): package.json, Vite/TS-Konfiguration, shadcn-Primitives, src/lib/model.ts, src/lib/store.tsx, src/components/shared.tsx, src/App.tsx und src/index.css. `pnpm typecheck` prüft die Integration.
- [x] Redaktion (Root): Overview, Drafts/Composer, Kalender, Ideen/Signale und Pläne. Draft-Version, Account-Freigabe und Termin-Snapshot strikt trennen. `pnpm test` prüft Bearbeitung nach Freigabe, Snapshot-Erhalt, Konflikte und wiederholte Annahme.
- [x] Produktmodule (Subagent): src/pages/Research.tsx, Agent.tsx, Analytics.tsx, Media.tsx, Explore.tsx. Mock-Profile, Verlauf, Ursachen/Evidenz, lokale Dateiprüfung, Filter, Experimente, Wiederverwertung und Frühindikatoren. Keine echten APIs.
- [x] Verwaltung (Subagent): src/pages/Settings.tsx, Team.tsx, Operations.tsx, Public.tsx. Accounts/Quellen, Strategie, Usage/Billing, Datenschutz, Notifications, Autonomie, Rollen/Review, Systemstatus, öffentliche Hilfe/Auth/Onboarding. Kein echter Versand oder Checkout.
- [x] Spec-Review (Subagent): Quellen-Tasks gegen Ansichten prüfen; fehlende relevante UI-Abläufe konkret melden und schließen.
- [x] Qualitätsprüfung (Root und Reviewer): `pnpm build`, `pnpm test`, `pnpm test:e2e`; Desktop/mobile Browserkontrolle und Accessibility. Fehler beheben, UI-Task-Mapping und Grenzen dokumentieren.
- [x] Backlog-Tracking (Root): TASK-69 Kriterien nach Nachweis abhaken; Ursprungstasks per CLI mit UI-Abdeckung ergänzen. Kein Task wird ohne Nutzerabnahme auf Done gesetzt.

Validierungsnachweis: `.docs/reviews/task-69-ui-validation.md`. 75 UI-Anteile per CLI dokumentiert. Nutzerabnahme und sämtliche echten Backend-/Provider-Arbeiten bleiben getrennt und offen.
