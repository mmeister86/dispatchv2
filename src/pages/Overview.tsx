import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  GitPullRequest,
  CheckCheck,
  CalendarDays,
  Lightbulb,
  Clock,
  PenLine,
  Radio,
  ChevronRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { demoMode } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { approved, currentVersion } from "@/lib/model";
import {
  PageHeader,
  Section,
  Status,
  AccountIcon,
  PublishBadge,
  formatDate,
  TextLink,
} from "@/components/shared";
export function OverviewPage() {
  const { state, createDraft } = useStore();
  const nav = useNavigate();
  const drafts = state.drafts.filter(
    (d) => d.workspaceId === state.activeWorkspaceId,
  );
  const schedules = state.schedules.filter(
    (s) => s.workspaceId === state.activeWorkspaceId,
  );
  const upcoming = schedules
    .filter((s) => s.status === "scheduled")
    .sort((a, b) => a.at.localeCompare(b.at));
  const ideas = state.ideas.filter(
    (i) => i.workspaceId === state.activeWorkspaceId && i.status === "new",
  );
  const review = drafts.filter(
    (d) => !approved(d) && currentVersion(d).text.some((t) => t.trim()),
  );
  const issues = schedules.filter((s) =>
    ["partial", "uncertain", "failed"].includes(s.status),
  );
  const greeting =
    new Date().getHours() < 11
      ? "Guten Morgen"
      : new Date().getHours() < 18
        ? "Guten Tag"
        : "Guten Abend";
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("de-DE", {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: state.preferences.timezone,
        }).format(new Date())}
        title={`${greeting}, ${state.preferences.name}.`}
        description="Deine Arbeit hat Geschichten. Gib ihnen einen guten Platz."
        actions={
          <Button
            onClick={() => {
              const id = createDraft("Unbenannter Entwurf");
              if (id) nav(`/drafts/${id}`);
            }}
            disabled={state.role === "Viewer"}
          >
            <Plus size={16} />
            Neuer Entwurf
          </Button>
        }
      />
      {!state.preferences.onboardingDone && (
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#ddd9bc] bg-[#f0f0df] p-4 dark:bg-secondary">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#e4e5ce] text-[#667449]">
              <CheckCheck size={18} />
            </span>
            <div>
              <strong className="text-sm">
                Mach Dispatch zu deinem Workspace
              </strong>
              <p className="mt-1 mb-0 text-xs text-[#687054] dark:text-muted-foreground">
                Zielgruppe, Schreibstil und Accounts in wenigen Schritten
                einrichten.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/onboarding">
              Einrichtung fortsetzen
              <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
      )}
      <div className="mb-8 grid grid-cols-2 gap-x-5 gap-y-4 border-y py-5 md:grid-cols-4">
        {[
          {
            label: "Entwürfe in Arbeit",
            value: drafts.length,
            icon: PenLine,
            to: "/drafts",
            detail: `${review.length} warten auf Freigabe`,
          },
          {
            label: "Geplante Beiträge",
            value: upcoming.length,
            icon: CalendarDays,
            to: "/calendar",
            detail: "Mit freigegebener Version",
          },
          {
            label: "Neue Ideen",
            value: ideas.length,
            icon: Lightbulb,
            to: "/ideas",
            detail: "Aus deinen Quellen",
          },
          {
            label: "Aufmerksamkeit nötig",
            value: issues.length,
            icon: Clock,
            to: "/calendar?view=agenda",
            detail: "Ausgänge und Teilthreads",
          },
        ].map((m) => (
          <Link key={m.label} to={m.to} className="group">
            <div className="flex items-center gap-2 text-xs muted">
              <m.icon size={14} />
              {m.label}
            </div>
            <div className="mt-2 flex items-end gap-4">
              <span className="text-3xl font-semibold tracking-tight">
                {m.value}
              </span>
              <ArrowUpRight
                size={15}
                className="mb-1 text-muted-foreground group-hover:text-primary"
              />
            </div>
            <p className="mt-1 mb-0 text-[11px] muted">{m.detail}</p>
          </Link>
        ))}
      </div>
      <div className="content-grid">
        <div className="stack">
          <section>
            <div className="section-heading">
              <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                <h2>Als Nächstes</h2>
                <span className="text-xs muted">Dein Redaktionsplan</span>
              </div>
              <TextLink to="/calendar">Kalender öffnen</TextLink>
            </div>
            <div className="surface overflow-hidden">
              {upcoming.length ? (
                upcoming.slice(0, 4).map((s, i) => {
                  const d = drafts.find((d) => d.id === s.draftId);
                  const a = state.accounts.find((a) => a.id === s.accountId);
                  return (
                    <Link
                      to={`/drafts/${s.draftId}`}
                      key={s.id}
                      className={`flex items-center gap-4 p-5 hover:bg-muted/40 ${i ? "border-t" : ""}`}
                    >
                      <div className="min-w-12 text-center">
                        <span className="block text-[10px] uppercase muted">
                          {new Intl.DateTimeFormat("de-DE", {
                            weekday: "short",
                            timeZone: state.preferences.timezone,
                          }).format(new Date(s.at))}
                        </span>
                        <span className="text-2xl font-semibold">
                          {new Intl.DateTimeFormat("de-DE", {
                            day: "2-digit",
                            timeZone: state.preferences.timezone,
                          }).format(new Date(s.at))}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <AccountIcon channel={a?.channel ?? "X"} size={18} />
                          <span className="text-[11px] muted">
                            {a?.handle} ·{" "}
                            {formatDate(s.at, state.preferences.timezone, {
                              day: undefined,
                              month: undefined,
                            })}
                          </span>
                          <PublishBadge status={s.status} />
                        </div>
                        <h3 className="mb-1 truncate text-sm">{d?.title}</h3>
                        <p className="mb-0 truncate text-xs muted">
                          {s.text[0]}
                        </p>
                      </div>
                      <ChevronRight size={16} className="muted" />
                    </Link>
                  );
                })
              ) : (
                <div className="p-7">
                  <p className="muted">Dein Kalender hat noch Platz.</p>
                  <TextLink to="/plans">Planvorschläge prüfen</TextLink>
                </div>
              )}
            </div>
          </section>
          <section>
            <div className="section-heading">
              <h2>Geschichten aus deiner Arbeit</h2>
              <TextLink to="/signals">Alle Signale</TextLink>
            </div>
            <div className="surface divide-y">
              {!demoMode && (
                <p className="p-5 text-sm muted">
                  Noch keine Quellen verbunden. Du kannst deinen Workspace ohne
                  GitHub einrichten.
                </p>
              )}
              {(demoMode
                ? [
                    {
                      title: "Kalenderansicht aufgeräumt",
                      repo: "dispatch / Pull Request #128",
                      desc: "Vier kleine Verbesserungen, die den Alltag leichter machen.",
                      icon: GitPullRequest,
                      color: "#687d55",
                    },
                    {
                      title: "Release v0.8 ist bereit",
                      repo: "dispatch / Release",
                      desc: "Ein guter Anlass, zu zeigen, woran du gearbeitet hast.",
                      icon: Radio,
                      color: "#bc6945",
                    },
                  ]
                : []
              ).map((s, i) => (
                <Link
                  to={`/signals?signal=${i + 1}`}
                  key={s.title}
                  className="flex items-start gap-4 p-5 hover:bg-muted/40"
                >
                  <span style={{ color: s.color }} className="mt-1">
                    <s.icon size={20} />
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="mb-1 text-sm">{s.title}</h3>
                      <span className="text-[10px] muted">Demo</span>
                    </div>
                    <p className="mb-2 text-[11px] muted">{s.repo}</p>
                    <p className="mb-0 text-xs leading-relaxed">{s.desc}</p>
                  </div>
                  <ArrowUpRight size={16} className="muted" />
                </Link>
              ))}
            </div>
          </section>
          <div className="rounded-lg bg-[#e9ede3] p-5 dark:bg-secondary">
            <span className="eyebrow">Dein nächster guter Beitrag</span>
            <h3 className="mt-3 mb-2">Weniger überlegen. Mehr erzählen.</h3>
            <p className="mb-4 text-xs leading-relaxed muted">
              {demoMode
                ? "Drei Vorschläge aus Arbeitssignalen und Recherche — bereit für deinen redaktionellen Blick."
                : "Dein Workspace startet mit einem leeren Redaktionsplan. Sobald die Inhalte angebunden sind, findest du hier deine Vorschläge."}
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/plans">
                Wochenplan ansehen
                <ArrowRight size={14} />
              </Link>
            </Button>
          </div>
        </div>
        <aside className="stack">
          <Section
            title="Bereit für deinen Blick"
            actions={<Status>{review.length}</Status>}
          >
            {review.slice(0, 3).map((d) => (
              <Link
                key={d.id}
                to={`/drafts/${d.id}`}
                className="block border-b py-3 first:pt-0 last:border-0 last:pb-0"
              >
                <span className="mb-2 block text-[10px] muted">
                  {d.pillar} · v{currentVersion(d).number}
                </span>
                <h3 className="mb-2 text-sm leading-snug">{d.title}</h3>
                <span className="inline-flex items-center gap-1 text-xs text-primary">
                  Entwurf prüfen
                  <ArrowRight size={12} />
                </span>
              </Link>
            ))}
            {!review.length && (
              <p className="muted text-xs">
                {drafts.length
                  ? "Alle Entwürfe sind freigegeben."
                  : "Noch keine Entwürfe vorhanden."}
              </p>
            )}
          </Section>
          <Section title="Dein Themenmix">
            {!demoMode ? (
              <p className="muted text-xs">
                {state.preferences.topics ||
                  "Lege deine Themen im Profil fest."}
              </p>
            ) : (
              <>
                <div className="mb-4 flex h-2 overflow-hidden rounded-full">
                  <span className="w-[45%] bg-[#6c7e5e]" />
                  <span className="w-[30%] bg-[#bc7758]" />
                  <span className="w-[25%] bg-[#b8b399]" />
                </div>
                {[
                  ["Building in public", "45 %", "#6c7e5e"],
                  ["Learnings", "30 %", "#bc7758"],
                  ["Produktupdates", "25 %", "#b8b399"],
                ].map(([name, n, c]) => (
                  <div key={name} className="mb-3 flex justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span
                        style={{ background: c }}
                        className="size-2 rounded-full"
                      />
                      {name}
                    </span>
                    <span className="muted">{n}</span>
                  </div>
                ))}
                <TextLink to="/settings/strategy">
                  Strategie bearbeiten
                </TextLink>
                <p className="mt-3 mb-0 text-[10px] muted">
                  Beispielhafte Zielverteilung
                </p>
              </>
            )}
          </Section>
          <Section title="Ein ruhiger Überblick">
            <p className="text-xs leading-relaxed muted">
              {demoMode ? "Demo-Workspace" : "Workspace"} ·{" "}
              {
                state.accounts.filter(
                  (a) =>
                    a.workspaceId === state.activeWorkspaceId && a.connected,
                ).length
              }{" "}
              verbundene Accounts.{" "}
              {demoMode
                ? "Alle Abläufe sind lokal simuliert."
                : "Dein Profil und dein Workspace sind gespeichert."}
            </p>
            <TextLink to="/analytics">Performance erkunden</TextLink>
          </Section>
        </aside>
      </div>
    </div>
  );
}
