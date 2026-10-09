import { NativeArchiveExport } from "@/features/settings/data-archive";
import { NativeNotificationSettings } from "@/features/settings/notifications";
import {
  NativeProfileExport,
  NativePreferencesExport,
  WorkspaceVersionsExport,
} from "@/features/settings/data-export";
import { ContentStrategy } from "@/features/settings/content-strategy";
import { IntelligenceProfiles } from "@/features/intelligence/profiles";
import { GithubSources } from "@/features/settings/github";
import { ModelConfiguration } from "@/features/settings/models";
import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  Download,
  GitBranch,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AccountIcon,
  DemoNote,
  PageHeader,
  Section,
  Status,
} from "@/components/shared";
import { useStore, useWorkspaceLocalState } from "@/lib/store";
import { disconnectAccount, uid, now, type Channel } from "@/lib/model";
import { demoMode } from "@/lib/auth-client";
import { EmptyState } from "@/components/shared";
import { toast } from "sonner";
import { SocialAccounts } from "@/features/settings/social-accounts";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="block">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ id?: string }>, { id })
        : children}
    </div>
  );
}
function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-5 py-3">
      <div>
        <span className="font-medium">{label}</span>
        {description && (
          <p className="muted text-xs mt-1 mb-0 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <Switch
        aria-label={label}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
const navigation = [
  ["profile", "Mein Profil"],
  ["workspaces", "Workspaces"],
  ["integrations", "Verbindungen"],
  ["sources", "Quellen & Datenschutz"],
  ["strategy", "Marke & Strategie"],
  ["notifications", "Benachrichtigungen"],
  ["billing", "Plan & Abrechnung"],
  ["automation", "Automatisierung"],
  ["data", "Daten & Sicherheit"],
];
export function SettingsPage() {
  const { tab = "profile" } = useParams();
  const { state, nativeScope } = useStore();
  const admin = state.role === "Owner" || state.role === "Admin";
  const content: Record<string, ReactNode> = {
    profile: <ProfileSettings />,
    workspaces: <WorkspaceSettings admin={admin} />,
    integrations: <IntegrationSettings admin={admin} />,
    sources: <SourceSettings admin={admin} />,
    strategy: <StrategySettings admin={admin} />,
    notifications: <NotificationSettings />,
    billing: <BillingSettings admin={admin} />,
    automation: <AutomationSettings admin={admin} />,
    data: <DataSettings admin={admin} />,
  };
  return (
    <>
      <PageHeader
        eyebrow="Dein Arbeitsraum"
        title="Einstellungen"
        description="Ein guter Workflow beginnt mit den richtigen Grundlagen."
      />
      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav
          aria-label="Einstellungen"
          className="flex gap-1 overflow-auto pb-3 lg:flex-col"
        >
          {navigation.map(([id, label]) => (
            <Link
              key={id}
              to={`/settings/${id}`}
              aria-current={tab === id ? "page" : undefined}
              className={`whitespace-nowrap rounded-md px-3 py-2.5 text-sm ${tab === id ? "bg-secondary font-semibold" : "muted hover:bg-secondary"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="stack min-w-0">
          {!admin && (
            <DemoNote>
              Aktive Rolle: {state.role}. Änderungen an Verbindungen, Team,
              Abrechnung und Richtlinien benötigen Owner- oder Admin-Rechte.
            </DemoNote>
          )}
          {!demoMode && tab === "integrations" ? (
            <IntegrationGuidance />
          ) : !demoMode && tab === "strategy" ? (
            <ContentStrategy />
          ) : !demoMode && tab === "notifications" ? (
            <CloudNotificationSettings />
          ) : !demoMode && tab === "data" ? (
            <>
              <NativeProfileExport key={nativeScope} />
              <NativePreferencesExport key={`preferences:${nativeScope}`} />
              <NativeArchiveExport key={`archive:${nativeScope}`} />
              {admin && (
                <>
                  <WorkspaceVersionsExport key={`versions:${nativeScope}`} />
                </>
              )}
            </>
          ) : !demoMode && !["profile", "workspaces"].includes(tab) ? (
            <EmptyState
              title="Dieser Bereich wird noch angebunden"
              description="Es wurden keine Verbindungen oder Einstellungen simuliert. Dein Profil und deine Workspaces sind bereits verfügbar."
            />
          ) : (
            (content[tab] ?? (
              <Section title="Bereich nicht gefunden">
                <Link to="/settings/profile">Zum Profil</Link>
              </Section>
            ))
          )}
        </div>
      </div>
    </>
  );
}
function IntegrationGuidance() {
  const { state } = useStore();
  const readiness = useQuery(api.auth.capabilities, {});
  return (
    <>
      <SocialAccounts key={state.activeWorkspaceId} />
      <GithubSources key={`github:${state.activeWorkspaceId}`} />
      <ModelConfiguration key={`models:${state.activeWorkspaceId}`} />
      <Section
        title="Kritische E-Mail-Benachrichtigungen"
        description="Zustellprobleme bleiben im Kalender und Überblick sichtbar."
      >
        <Status
          tone={
            readiness?.emailDelivery && !readiness.restrictedSender
              ? "green"
              : "orange"
          }
        >
          {!readiness
            ? "Konfiguration wird geladen …"
            : !readiness.emailDelivery
              ? "RESEND_API_KEY fehlt"
              : readiness.restrictedSender
                ? "AUTH_EMAIL_FROM fehlt"
                : "Absender und Zugang konfiguriert"}
        </Status>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
          <li>
            Die Administration hinterlegt RESEND_API_KEY und einen freigegebenen
            Absender als AUTH_EMAIL_FROM im Convex-Deployment. SITE_URL muss auf
            die App-Adresse zeigen.
          </li>
          <li>
            Der Absender muss beim E-Mail-Provider für den Versand freigegeben
            sein. Ohne eigenen konfigurierten Absender bleibt die kritische
            Publishing-Benachrichtigung sichtbar blockiert.
          </li>
          <li>
            Bei einem Zustellfehler die Provider-Konfiguration prüfen. Eine
            gespeicherte Benachrichtigung ist erst als gesendet markiert, wenn
            der Provider den Versand bestätigt; diese Seite löst keine
            Test-E-Mail oder Wiederholung aus.
          </li>
        </ol>
      </Section>
      <Section
        title="Medien & weitere Provider"
        description="R2-Medien und GitHub-Repository-Zugriff werden separat aktiviert."
      >
        <p className="text-sm">
          Für R2 fehlen noch der verifizierte Upload-/Finalisierungsflow und
          autorisierte Vorschauen. Die Administration benötigt den vorgesehenen
          Bucket und dessen serverseitige S3-Zugangskonfiguration. Es werden
          hier keine Ressourcen angelegt.
        </p>
        <p className="mb-0 text-sm">
          GitHub-Anmeldung und Repository-Zugriff sind getrennte Berechtigungen.
          Repository-Zugriff benötigt den separaten App-Verbindungsflow und eine
          ausdrückliche Auswahl der erlaubten Repositories.
        </p>
      </Section>
    </>
  );
}
function ProfileSettings() {
  const { state, saveProfile } = useStore();
  const [profile, setProfile] = useState(state.preferences);
  const [busy, setBusy] = useState(false);
  const readOnly = state.role === "Viewer";
  return (
    <>
      {!demoMode && <IntelligenceProfiles audienceOnly />}
      <Section
        title="Dein Profil"
        description="So möchtest du arbeiten — und so soll Dispatch dich verstehen."
      >
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (readOnly || busy) return;
            setBusy(true);
            if (await saveProfile(profile))
              toast.success(
                demoMode ? "Profil lokal gespeichert." : "Profil gespeichert.",
              );
            setBusy(false);
          }}
        >
          <div className="form-grid">
            <Field label="Dein Name">
              <Input
                required
                value={profile.name}
                disabled={readOnly}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </Field>
            <Field label="Sprache">
              <select
                className="native-select"
                disabled={readOnly}
                value={profile.language}
                onChange={(e) =>
                  setProfile({ ...profile, language: e.target.value })
                }
              >
                <option>Deutsch</option>
                <option>English</option>
              </select>
            </Field>
            <Field label="Zeitzone">
              <select
                className="native-select"
                disabled={readOnly}
                value={profile.timezone}
                onChange={(e) =>
                  setProfile({ ...profile, timezone: e.target.value })
                }
              >
                {[
                  "Europe/Berlin",
                  "Europe/London",
                  "America/New_York",
                  "America/Los_Angeles",
                  "Asia/Tokyo",
                  "UTC",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Tonalität">
              <Input
                value={profile.tone}
                disabled={readOnly}
                onChange={(e) =>
                  setProfile({ ...profile, tone: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Für wen schreibst du?">
            <Textarea
              value={profile.audience}
              disabled={readOnly}
              onChange={(e) =>
                setProfile({ ...profile, audience: e.target.value })
              }
            />
          </Field>
          <Field label="Deine Themen">
            <Input
              value={profile.topics}
              disabled={readOnly}
              onChange={(e) =>
                setProfile({ ...profile, topics: e.target.value })
              }
            />
          </Field>
          <div className="flex items-center gap-3">
            <Button disabled={readOnly || busy}>
              {busy ? "Wird gespeichert…" : "Änderungen speichern"}
            </Button>
            <span className="muted text-xs">
              {demoMode
                ? "Gilt für dein lokales Demo-Profil."
                : "Gilt für dein Profil im aktiven Workspace."}
            </span>
          </div>
        </form>
      </Section>
      <DemoNote>
        Sprache und Zeitzone sind Profileinstellungen. Die Oberfläche bleibt
        vorerst auf Deutsch.
      </DemoNote>
      <Section
        title="Projekt & Einrichtung"
        description="Projektbeschreibung und restliche Einrichtung kannst du jederzeit im Setup bearbeiten. Quellen und Kanäle bleiben optional."
      >
        <Button variant="outline" asChild>
          <Link to="/onboarding">
            {state.preferences.onboardingDone
              ? "Projekt und Einrichtung bearbeiten"
              : "Einrichtung fortsetzen"}
          </Link>
        </Button>
      </Section>
    </>
  );
}
function WorkspaceSettings({ admin }: { admin: boolean }) {
  const { state, createWorkspace } = useStore();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  return (
    <Section
      title="Workspaces & Marken"
      description="Jede Marke hat eigene Entwürfe, Quellen, Regeln und Team-Einstellungen."
    >
      <div className="divide-y">
        {state.workspaces.map((w) => (
          <div
            key={w.id}
            className="flex items-center justify-between gap-3 py-4"
          >
            <div>
              <p className="font-semibold mb-1">{w.name}</p>
              <p className="muted text-xs mb-0">{w.description}</p>
            </div>
            <Status
              tone={w.id === state.activeWorkspaceId ? "green" : "neutral"}
            >
              {w.id === state.activeWorkspaceId ? "Aktiv" : "Workspace"}
            </Status>
          </div>
        ))}
      </div>
      <form
        className="flex flex-wrap gap-2 mt-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!admin || !name.trim() || busy) return;
          setBusy(true);
          if (await createWorkspace(name.trim())) {
            setName("");
            toast.success("Workspace erstellt.");
          }
          setBusy(false);
        }}
      >
        <Input
          aria-label="Name des neuen Workspace"
          className="flex-1 min-w-48"
          placeholder="Name deiner Marke"
          required
          value={name}
          disabled={!admin}
          onChange={(e) => setName(e.target.value)}
        />
        <Button disabled={!admin}>
          <Plus size={15} />
          Workspace erstellen
        </Button>
      </form>
    </Section>
  );
}
function IntegrationSettings({ admin }: { admin: boolean }) {
  const { state, setState } = useStore();
  const [channel, setChannel] = useState<Channel>("Mastodon");
  const [handle, setHandle] = useState("");
  const [instance, setInstance] = useState("");
  const [metadata, setMetadata] = useWorkspaceLocalState<
    Record<string, { connectedAt: string; instance?: string }>
  >("connection-metadata", {});
  const [github, setGitBranch] = useWorkspaceLocalState("github", {
    login: false,
    installed: false,
    repos: ["dispatch/calendar"],
    monitors: ["dispatch/calendar"],
    privateConsent: false,
    events: ["Releases", "Pull Requests"],
  });
  const [repo, setRepo] = useState("");
  const accounts = state.accounts.filter(
    (a) => a.workspaceId === state.activeWorkspaceId,
  );
  const connect = (id: string, connected: boolean) => {
    if (!admin) return;
    setState((s) =>
      connected
        ? {
            ...s,
            accounts: s.accounts.map((a) =>
              a.id === id ? { ...a, connected: true } : a,
            ),
          }
        : disconnectAccount(s, id),
    );
    if (connected)
      setMetadata((m) => ({ ...m, [id]: { ...m[id], connectedAt: now() } }));
  };
  return (
    <>
      <Section
        title="Social Accounts"
        description="Ein Platz für jede Stimme. Verbindungen in dieser Demo sind simuliert."
      >
        <div className="divide-y">
          {accounts.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap gap-3 items-center justify-between py-4"
            >
              <div className="flex gap-3 items-center">
                <AccountIcon channel={a.channel} size={34} />
                <div>
                  <p className="font-semibold mb-1">
                    {a.channel}{" "}
                    <span className="muted font-normal">{a.handle}</span>
                  </p>
                  <p className="muted text-xs mb-0">
                    {a.connected
                      ? "Lesen · Entwürfe · simuliertes Publizieren"
                      : "Verbindung getrennt"}
                    {metadata[a.id]?.instance &&
                      ` · ${metadata[a.id].instance}`}
                  </p>
                  {metadata[a.id]?.connectedAt && (
                    <p className="muted text-xs mt-1 mb-0">
                      Lokal verbunden:{" "}
                      {new Date(metadata[a.id].connectedAt).toLocaleDateString(
                        "de-DE",
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Status tone={a.connected ? "green" : "orange"}>
                  {a.connected ? "Demo verbunden" : "Getrennt"}
                </Status>
                {a.connected && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!admin}
                    onClick={() => connect(a.id, true)}
                  >
                    Erneuern
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!admin}
                  onClick={() => connect(a.id, !a.connected)}
                >
                  {a.connected ? "Trennen" : "Demo verbinden"}
                </Button>
              </div>
            </div>
          ))}
        </div>
        <form
          className="stack pt-6 border-t mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!admin) return;
            if (channel === "Mastodon") {
              try {
                const url = new URL(instance);
                if (url.protocol !== "https:") throw new Error();
              } catch {
                toast.error("Eine gültige HTTPS-Instanz eingeben.");
                return;
              }
            }
            const id = uid("account");
            setState((s) => ({
              ...s,
              accounts: [
                ...s.accounts,
                {
                  id,
                  workspaceId: s.activeWorkspaceId,
                  name: s.preferences.name,
                  channel,
                  handle: handle.trim(),
                  connected: true,
                  color: "#627743",
                },
              ],
            }));
            setMetadata((m) => ({
              ...m,
              [id]: {
                connectedAt: now(),
                ...(channel === "Mastodon" ? { instance } : {}),
              },
            }));
            setHandle("");
          }}
        >
          <div className="form-grid">
            <Field label="Kanal">
              <select
                className="native-select"
                value={channel}
                disabled={!admin}
                onChange={(e) => setChannel(e.target.value as Channel)}
              >
                {["X", "LinkedIn", "Bluesky", "Mastodon"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Profilname / Handle">
              <Input
                required
                disabled={!admin}
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@deinprofil"
              />
            </Field>
            {channel === "Mastodon" && (
              <Field label="Mastodon-Instanz">
                <Input
                  type="url"
                  required
                  placeholder="https://mastodon.social"
                  value={instance}
                  disabled={!admin}
                  onChange={(e) => setInstance(e.target.value)}
                />
              </Field>
            )}
          </div>
          <Button className="self-start" variant="outline" disabled={!admin}>
            <Plus size={15} />
            Demo-Account hinzufügen
          </Button>
        </form>
        <p className="muted text-xs leading-relaxed mt-4 mb-0">
          Trennen stoppt neue Veröffentlichungen für diesen Account. Entwürfe
          und bereits veröffentlichte öffentliche Beiträge bleiben erhalten. Es
          werden keine Zugangsdaten gespeichert.
        </p>
      </Section>
      <Section
        title="GitHub"
        description="Anmeldung und Repository-Zugriff sind zwei getrennte Berechtigungen."
        actions={<GitBranch size={20} />}
      >
        <div className="flex flex-wrap gap-2 mb-5">
          <Button
            variant="outline"
            disabled={!admin}
            onClick={() => setGitBranch((g) => ({ ...g, login: !g.login }))}
          >
            {github.login
              ? "GitHub-Anmeldung trennen"
              : "GitHub-Anmeldung simulieren"}
          </Button>
          <Button
            disabled={!admin || !github.login}
            onClick={() =>
              setGitBranch((g) => ({
                ...g,
                installed: !g.installed,
                ...(g.installed ? { monitors: [] } : {}),
              }))
            }
          >
            {github.installed
              ? "Repository-Zugriff widerrufen"
              : "App-Installation simulieren"}
          </Button>
        </div>
        <Status tone={github.installed ? "green" : "neutral"}>
          {github.installed
            ? "Repository-App lokal installiert"
            : "Kein Repository-Zugriff"}
        </Status>
        <div className="mt-5 divide-y">
          {github.repos.map((r) => (
            <Toggle
              key={r}
              label={r}
              description="Nur ausgewählte Repositories werden im Demo-Monitor beobachtet."
              checked={github.monitors.includes(r)}
              disabled={!admin || !github.installed}
              onChange={(enabled) =>
                setGitBranch((g) => ({
                  ...g,
                  monitors: enabled
                    ? [...g.monitors, r]
                    : g.monitors.filter((x) => x !== r),
                }))
              }
            />
          ))}
        </div>
        <form
          className="flex gap-2 mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!admin || !github.installed) return;
            if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
              toast.error("Repository als organisation/name angeben.");
              return;
            }
            setGitBranch((g) => ({
              ...g,
              repos: [...new Set([...g.repos, repo])],
            }));
            setRepo("");
          }}
        >
          <Input
            aria-label="GitHub Repository"
            placeholder="organisation/repository"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            disabled={!admin || !github.installed}
          />
          <Button variant="outline" disabled={!admin || !github.installed}>
            Auswählen
          </Button>
        </form>
        <Toggle
          label="Privaten Kontext erlauben"
          description="Ausdrückliche Zustimmung. Private Inhalte dürfen nur als Kontext dienen und erscheinen niemals automatisch in öffentlichen Posts."
          checked={github.privateConsent}
          disabled={!admin || !github.installed}
          onChange={(privateConsent) =>
            setGitBranch({ ...github, privateConsent })
          }
        />
        <div className="flex flex-wrap gap-3 mt-3">
          {["Releases", "Pull Requests", "Issues", "Commits"].map((event) => (
            <label className="flex items-center gap-2 text-sm" key={event}>
              <input
                type="checkbox"
                disabled={!admin || !github.installed}
                checked={github.events.includes(event)}
                onChange={(e) =>
                  setGitBranch((g) => ({
                    ...g,
                    events: e.target.checked
                      ? [...g.events, event]
                      : g.events.filter((x) => x !== event),
                  }))
                }
              />
              {event}
            </label>
          ))}
        </div>
        <DemoNote>
          Keine OAuth-Verbindung oder GitHub-Anfrage. Die Auswahl bleibt
          ausschließlich im lokalen Workspace.
        </DemoNote>
      </Section>
    </>
  );
}
type Source = {
  id: string;
  url: string;
  type: string;
  consent: boolean;
  enabled: boolean;
  retention: number;
};
function SourceSettings({ admin }: { admin: boolean }) {
  const [sources, setSources] = useWorkspaceLocalState<Source[]>("sources", [
    {
      id: "source-demo",
      url: "https://example.com/product-feed.xml",
      type: "RSS",
      consent: true,
      enabled: true,
      retention: 30,
    },
  ]);
  const [url, setUrl] = useState("");
  const [type, setType] = useState("RSS");
  const [consent, setConsent] = useState(false);
  return (
    <>
      <Section
        title="Öffentliche Quellen"
        description="Du entscheidest, welche Quellen Kontext liefern — und wie lange er bleibt."
      >
        <form
          className="stack mb-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!admin || !consent) return;
            try {
              const u = new URL(url);
              if (
                !["https:", "http:"].includes(u.protocol) ||
                u.username ||
                u.password
              )
                throw new Error();
              if (sources.some((s) => s.url === url)) throw new Error();
            } catch {
              toast.error(
                "Eine öffentliche HTTP(S)-URL ohne Zugangsdaten eingeben, die noch nicht hinzugefügt wurde.",
              );
              return;
            }
            setSources((s) => [
              ...s,
              {
                id: uid("source"),
                url,
                type,
                consent,
                enabled: true,
                retention: 30,
              },
            ]);
            setUrl("");
            setConsent(false);
          }}
        >
          <div className="flex flex-wrap gap-3">
            <select
              className="native-select max-w-36"
              aria-label="Quellentyp"
              value={type}
              disabled={!admin}
              onChange={(e) => setType(e.target.value)}
            >
              <option>RSS</option>
              <option>Artikel</option>
            </select>
            <Input
              type="url"
              aria-label="Quellen-URL"
              required
              className="flex-1 min-w-48"
              value={url}
              disabled={!admin}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <label className="text-xs flex items-start gap-2 leading-relaxed">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={consent}
              disabled={!admin}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Ich darf diese Quelle verwenden. Keine privaten Links, Tokens oder
            personenbezogenen Inhalte hinzufügen.
          </label>
          <Button disabled={!admin || !consent} className="self-start">
            Quelle hinzufügen
          </Button>
        </form>
        <div className="divide-y">
          {sources.map((source) => (
            <div key={source.id} className="py-4">
              <div className="flex flex-wrap gap-3 justify-between">
                <div className="min-w-0">
                  <span className="eyebrow">
                    {source.type} · Zustimmung erteilt
                  </span>
                  <p className="break-all font-medium mt-1 mb-2">
                    {source.url}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!admin}
                  onClick={() =>
                    setSources((s) => s.filter((x) => x.id !== source.id))
                  }
                >
                  <Trash2 size={14} />
                  Entfernen
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <Switch
                  aria-label={`Quelle ${source.url} aktivieren`}
                  checked={source.enabled}
                  disabled={!admin}
                  onCheckedChange={(enabled) =>
                    setSources((s) =>
                      s.map((x) =>
                        x.id === source.id ? { ...x, enabled } : x,
                      ),
                    )
                  }
                />
                <Status>
                  {source.enabled ? "Bereit · Demo, kein Abruf" : "Pausiert"}
                </Status>
                <label className="flex items-center gap-2 text-xs">
                  Aufbewahrung
                  <select
                    className="native-select w-auto"
                    value={source.retention}
                    disabled={!admin}
                    onChange={(e) =>
                      setSources((s) =>
                        s.map((x) =>
                          x.id === source.id
                            ? { ...x, retention: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                  >
                    {[7, 30, 90].map((days) => (
                      <option key={days} value={days}>
                        {days} Tage
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ))}
          {sources.length === 0 && (
            <p className="muted">
              Noch keine Quellen. Ein öffentlicher Artikel ist ein guter Anfang.
            </p>
          )}
        </div>
      </Section>
      <DemoNote>
        Quelle entfernen widerruft die lokale Nutzungserlaubnis. Bereits
        übernommene Entwürfe bleiben erhalten. Aufbewahrung ist eine simulierte
        Richtlinie; es werden keine Artikel abgerufen.
      </DemoNote>
    </>
  );
}
const strategyDefault = {
  pillars: [
    { name: "Building in public", weight: 50 },
    { name: "Learnings", weight: 30 },
    { name: "Produktupdates", weight: 20 },
  ],
  positioning: "Ehrliche Einblicke für Menschen, die bessere Produkte bauen.",
  samples: "Heute ein Feature gestrichen. Und das Produkt ist besser geworden.",
  forbidden: "revolutionär, game-changing, garantiert",
  version: 1,
};
function StrategySettings({ admin }: { admin: boolean }) {
  const [committed, setCommitted] = useWorkspaceLocalState(
    "strategy",
    strategyDefault,
  );
  const [strategy, setStrategy] = useState(committed);
  const [history, setHistory] = useWorkspaceLocalState<
    (typeof strategyDefault)[]
  >("strategy-history", []);
  const [decision, setDecision] = useWorkspaceLocalState(
    "strategy-suggestion",
    "offen",
  );
  const [pillar, setPillar] = useState("");
  const total = strategy.pillars.reduce((sum, p) => sum + p.weight, 0);
  const save = (next: typeof strategyDefault) => {
    if (!admin) return;
    setHistory((h) => [...h, committed]);
    const versioned = { ...next, version: committed.version + 1 };
    setStrategy(versioned);
    setCommitted(versioned);
  };
  return (
    <>
      <Section
        title="Deine inhaltlichen Säulen"
        description="Gewichte geben Orientierung. Zusammen sollen sie 100 % ergeben."
        actions={
          <Status tone={total === 100 ? "green" : "orange"}>
            {total} / 100 %
          </Status>
        }
      >
        <div className="divide-y">
          {strategy.pillars.map((p, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <span className="flex-1 font-medium">{p.name}</span>
              <Input
                className="w-20"
                type="number"
                min="0"
                max="100"
                aria-label={`Gewicht ${p.name}`}
                value={p.weight}
                disabled={!admin}
                onChange={(e) =>
                  setStrategy((s) => ({
                    ...s,
                    pillars: s.pillars.map((x, n) =>
                      n === i
                        ? {
                            ...x,
                            weight: Math.max(
                              0,
                              Math.min(100, Number(e.target.value)),
                            ),
                          }
                        : x,
                    ),
                  }))
                }
              />
              <span className="muted text-xs">%</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${p.name} entfernen`}
                disabled={!admin || strategy.pillars.length <= 1}
                onClick={() =>
                  setStrategy((s) => ({
                    ...s,
                    pillars: s.pillars.filter((_, n) => n !== i),
                  }))
                }
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
        <form
          className="flex gap-2 mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!admin || !pillar.trim()) return;
            setStrategy((s) => ({
              ...s,
              pillars: [...s.pillars, { name: pillar.trim(), weight: 0 }],
            }));
            setPillar("");
          }}
        >
          <Input
            aria-label="Neue Säule"
            placeholder="Neue inhaltliche Säule"
            value={pillar}
            disabled={!admin}
            onChange={(e) => setPillar(e.target.value)}
          />
          <Button variant="outline" disabled={!admin}>
            <Plus size={15} />
            Hinzufügen
          </Button>
        </form>
      </Section>
      <Section
        title="Markenprofil & Stil"
        description="Deine eigene Stimme, nachvollziehbar versioniert."
      >
        <div className="stack">
          <Field label="Positionierung">
            <Textarea
              value={strategy.positioning}
              disabled={!admin}
              onChange={(e) =>
                setStrategy({ ...strategy, positioning: e.target.value })
              }
            />
          </Field>
          <Field label="Eigene Textbeispiele">
            <Textarea
              value={strategy.samples}
              disabled={!admin}
              onChange={(e) =>
                setStrategy({ ...strategy, samples: e.target.value })
              }
            />
          </Field>
          <Field label="Formulierungen vermeiden">
            <Input
              value={strategy.forbidden}
              disabled={!admin}
              onChange={(e) =>
                setStrategy({ ...strategy, forbidden: e.target.value })
              }
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!admin || total !== 100}
              onClick={() => {
                save(strategy);
                toast.success("Neue Profilversion lokal gespeichert.");
              }}
            >
              Version {strategy.version + 1} speichern
            </Button>
            <Button
              variant="outline"
              disabled={
                !admin ||
                (!history.length &&
                  JSON.stringify(strategy) === JSON.stringify(committed))
              }
              onClick={() => {
                if (JSON.stringify(strategy) !== JSON.stringify(committed)) {
                  setStrategy(committed);
                  return;
                }
                const previous = history[history.length - 1];
                setHistory((h) => h.slice(0, -1));
                setStrategy(previous);
                setCommitted(previous);
              }}
            >
              Letzte Änderung rückgängig
            </Button>
            <Button
              variant="ghost"
              disabled={!admin}
              onClick={() => save(strategyDefault)}
            >
              Profil zurücksetzen
            </Button>
          </div>
        </div>
      </Section>
      <Section
        title="Korrekturvorschlag"
        description="Beispielvorschlag — keine KI-Verarbeitung."
      >
        <p className="font-medium">
          „Produkte bauen, die sich leicht anfühlen.“
        </p>
        <p className="muted text-sm leading-relaxed">
          Grund: Deine Textbeispiele betonen einfache Abläufe stärker als neue
          Features. Die Formulierung könnte diese Haltung deutlicher machen.
        </p>
        {decision === "offen" ? (
          <div className="flex gap-2">
            <Button
              disabled={!admin}
              variant="outline"
              onClick={() => {
                save({
                  ...strategy,
                  positioning: "Produkte bauen, die sich leicht anfühlen.",
                });
                setDecision("angenommen");
              }}
            >
              <Check size={15} />
              Annehmen
            </Button>
            <Button
              disabled={!admin}
              variant="ghost"
              onClick={() => setDecision("abgelehnt")}
            >
              Ablehnen
            </Button>
          </div>
        ) : (
          <Status>{decision}</Status>
        )}
      </Section>
      <Section title="Profil-Nachvollziehbarkeit">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <span className="eyebrow">Aktive Version</span>
            <p className="font-semibold mt-2 mb-0">v{strategy.version}</p>
          </div>
          <div>
            <span className="eyebrow">Quellen</span>
            <p className="text-sm mt-2 mb-0">Dein Profil · eigene Beispiele</p>
          </div>
          <div>
            <span className="eyebrow">Grenzen</span>
            <p className="text-sm mt-2 mb-0">Demo · keine Profil-Analyse</p>
          </div>
        </div>
        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-medium">
            Versionsverlauf ({history.length})
          </summary>
          {history.map((h, i) => (
            <div className="py-3 border-b text-sm" key={i}>
              <strong>Version {h.version}</strong>
              <p className="muted mt-1 mb-0">{h.positioning}</p>
            </div>
          ))}
          {!history.length && (
            <p className="muted text-sm mt-3">
              Noch keine gespeicherten Änderungen.
            </p>
          )}
        </details>
      </Section>
    </>
  );
}
function CloudNotificationSettings() {
  return <NativeNotificationSettings />;
}
function NotificationSettings() {
  const { state } = useStore();
  const [prefs, setPrefs] = useWorkspaceLocalState("notifications", {
    inApp: true,
    email: false,
    summaries: true,
    research: true,
    quiet: true,
    start: "20:00",
    end: "08:00",
  });
  const readOnly = state.role === "Viewer";
  return (
    <>
      <Section
        title="Das Wichtige erreicht dich"
        description="Pflichtmeldungen zu Sicherheit und fehlgeschlagenen Veröffentlichungen bleiben in der App sichtbar."
      >
        <Toggle
          label="In-App-Zusammenfassungen"
          checked={prefs.inApp}
          disabled={readOnly}
          onChange={(inApp) => setPrefs({ ...prefs, inApp })}
        />
        <Toggle
          label="E-Mail-Zusammenfassungen"
          description="Nur lokale Präferenz — es werden keine E-Mails versendet."
          checked={prefs.email}
          disabled={readOnly}
          onChange={(email) => setPrefs({ ...prefs, email })}
        />
        <Toggle
          label="Wöchentlicher Überblick"
          checked={prefs.summaries}
          disabled={readOnly}
          onChange={(summaries) => setPrefs({ ...prefs, summaries })}
        />
        <Toggle
          label="Research-Zusammenfassungen"
          description="Lokale Präferenz für neue Erkenntnisse aus freigegebenen Quellen."
          checked={prefs.research}
          disabled={readOnly}
          onChange={(research) => setPrefs({ ...prefs, research })}
        />
        <Toggle
          label="Ruhezeiten"
          description={`Zeitzone: ${state.preferences.timezone}. Pflichtmeldungen sind davon ausgenommen.`}
          checked={prefs.quiet}
          disabled={readOnly}
          onChange={(quiet) => setPrefs({ ...prefs, quiet })}
        />
        {prefs.quiet && (
          <div className="form-grid mt-3">
            <Field label="Ab">
              <Input
                type="time"
                value={prefs.start}
                disabled={readOnly}
                onChange={(e) => setPrefs({ ...prefs, start: e.target.value })}
              />
            </Field>
            <Field label="Bis">
              <Input
                type="time"
                value={prefs.end}
                disabled={readOnly}
                onChange={(e) => setPrefs({ ...prefs, end: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Section>
      <DemoNote>
        Alle Änderungen werden sofort lokal gespeichert. Zustellung und
        Ruhezeiten werden nicht ausgeführt.
      </DemoNote>
    </>
  );
}
function BillingSettings({ admin }: { admin: boolean }) {
  const { state } = useStore();
  const [billing, setBilling] = useWorkspaceLocalState("billing", {
    plan: "Studio",
    status: "Testphase",
    cancelled: false,
    invoice: false,
  });
  const [checkout, setCheckout] = useState(false);
  const usage = [
    [
      "Social Accounts",
      state.accounts.filter((a) => a.workspaceId === state.activeWorkspaceId)
        .length,
      billing.plan === "Starter" ? 2 : 8,
    ],
    ["Repositories", 1, 5],
    ["Research-Abfragen", 12, 50],
    ["KI-Entwürfe", 28, 100],
    ["Teammitglieder", 2, 5],
    [
      "Speicher (MB)",
      Math.round(
        state.media
          .filter((m) => m.workspaceId === state.activeWorkspaceId)
          .reduce((n, m) => n + m.size, 0) / 1000000,
      ),
      1000,
    ],
    [
      "Geplante Beiträge",
      state.schedules.filter(
        (s) =>
          s.workspaceId === state.activeWorkspaceId && s.status === "scheduled",
      ).length,
      billing.plan === "Starter" ? 10 : 100,
    ],
  ] as const;
  return (
    <>
      <Section
        title="Mehr Raum für gute Inhalte"
        description="Beispielplan. Preise und Kontingente sind Demo-Werte."
        actions={<Status tone="orange">{billing.status}</Status>}
      >
        <div className="flex flex-wrap gap-6 items-center justify-between">
          <div>
            <h2 className="mb-1">{billing.plan}</h2>
            <p className="muted mb-0">
              {billing.plan === "Studio" ? "29" : "12"} € / Monat · Demo
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!admin} onClick={() => setCheckout(true)}>
              Plan wechseln <ArrowUpRight size={15} />
            </Button>
            <Button
              variant="outline"
              disabled={!admin}
              onClick={() =>
                setBilling({
                  ...billing,
                  cancelled: !billing.cancelled,
                  status: billing.cancelled
                    ? "Aktiv"
                    : "Gekündigt zum Periodenende",
                })
              }
            >
              {billing.cancelled ? "Kündigung zurücknehmen" : "Plan kündigen"}
            </Button>
          </div>
        </div>
        {checkout && (
          <div className="mt-5 border-t pt-5">
            <h3>Planänderung prüfen</h3>
            <p className="muted text-sm">
              Starter: 2 Accounts, 10 geplante Beiträge. Studio: 8 Accounts, 100
              geplante Beiträge. Bestehende Inhalte bleiben beim Downgrade
              erhalten; oberhalb des Limits werden neue Aktionen gesperrt.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Starter", "Studio"].map((plan) => (
                <Button
                  key={plan}
                  variant="outline"
                  disabled={!admin}
                  onClick={() => {
                    setBilling({
                      ...billing,
                      plan,
                      status: "Aktiv · Demo",
                      cancelled: false,
                      invoice: true,
                    });
                    setCheckout(false);
                  }}
                >
                  Demo-{plan} wählen
                </Button>
              ))}
              <Button variant="ghost" onClick={() => setCheckout(false)}>
                Abbrechen
              </Button>
            </div>
            <DemoNote>
              Kein Checkout, keine Zahlung und kein Vertrag. Nur der lokale
              Demo-Plan ändert sich.
            </DemoNote>
          </div>
        )}
      </Section>
      <Section title="Nutzung in diesem Workspace">
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {usage.map(([label, current, limit]) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-2">
                <span>{label}</span>
                <span
                  className={current > limit ? "text-destructive" : "muted"}
                >
                  {current} / {limit}
                </span>
              </div>
              <Progress
                aria-label={`${label}: ${current} von ${limit}`}
                value={Math.min(100, (current / limit) * 100)}
              />
              {current > limit && (
                <p className="text-xs text-destructive mt-2 mb-0">
                  Limit überschritten. Inhalte bleiben erhalten; neue Aktionen
                  im Produktionsplan würden pausieren.
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>
      <Section
        title="Abrechnungszustände testen"
        description="Nur für die Demo. Keine Auswirkung auf deine Daten."
      >
        <select
          className="native-select"
          aria-label="Demo Abrechnungszustand"
          disabled={!admin}
          value={billing.status}
          onChange={(e) => setBilling({ ...billing, status: e.target.value })}
        >
          {[
            ...new Set([
              billing.status,
              "Testphase",
              "Aktiv",
              "Limit überschritten",
              "Zahlung fehlgeschlagen",
              "Kulanzfrist · 7 Tage",
              "Testphase abgelaufen",
            ]),
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {[
          "Zahlung fehlgeschlagen",
          "Testphase abgelaufen",
          "Limit überschritten",
        ].includes(billing.status) && (
          <p role="status" className="text-sm text-destructive mt-4 mb-0">
            {billing.status}. Export und Lesen bleiben verfügbar. Plan wechseln
            oder Demo-Zustand auf Aktiv zurücksetzen.
          </p>
        )}
      </Section>
      <Section title="Rechnungen">
        {billing.invoice ? (
          <div className="flex flex-wrap justify-between gap-3">
            <span>DEMO-2026-001 · {billing.plan} · Keine echte Rechnung</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const blob = new Blob(
                  [
                    `Demo-Rechnung DEMO-2026-001\nPlan: ${billing.plan}\nKein Zahlungsbeleg. Betrag: 0 EUR.`,
                  ],
                  { type: "text/plain" },
                );
                downloadBlob(blob, "dispatch-demo-rechnung.txt");
              }}
            >
              <Download size={14} />
              Beispiel herunterladen
            </Button>
          </div>
        ) : (
          <p className="muted text-sm mb-0">
            Während der simulierten Testphase gibt es keine Rechnungen.
          </p>
        )}
      </Section>
    </>
  );
}
function AutomationSettings({ admin }: { admin: boolean }) {
  const { state } = useStore();
  const accounts = state.accounts.filter(
    (a) => a.workspaceId === state.activeWorkspaceId,
  );
  const [storedPolicy, setStoredPolicy] = useWorkspaceLocalState("automation", {
    enabled: false,
    kill: false,
    source: "Nur freigegebene öffentliche Quellen",
    topics: "Produktupdates",
    channel: "X",
    frequency: 2,
    start: "09:00",
    end: "17:00",
    excluded: "Private Daten, Kundennamen, Sicherheitsvorfälle",
    version: 1,
    daily: 2,
    mode: "Nur Shadow-Modus",
    accountIds: state.accounts
      .filter((a) => a.workspaceId === state.activeWorkspaceId && a.connected)
      .map((a) => a.id),
    stoppedAccounts: [] as string[],
    format: "Einzelbeitrag",
    dateStart: new Date().toISOString().slice(0, 10),
    dateEnd: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });
  const setPolicy = (next: typeof storedPolicy) =>
    setStoredPolicy({ ...next, version: storedPolicy.version + 1 });
  const [shadowTime, setShadowTime] = useState("10:00");
  const [logs, setLogs] = useWorkspaceLocalState<string[]>(
    "automation-logs",
    [],
  );
  const policy = {
    ...storedPolicy,
    accountIds:
      storedPolicy.accountIds ??
      accounts.filter((a) => a.connected).map((a) => a.id),
    stoppedAccounts: storedPolicy.stoppedAccounts ?? [],
    format: storedPolicy.format ?? "Einzelbeitrag",
    dateStart: storedPolicy.dateStart ?? new Date().toISOString().slice(0, 10),
    dateEnd:
      storedPolicy.dateEnd ??
      new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  };
  const [candidates, setCandidates] = useWorkspaceLocalState<
    {
      id: string;
      accountId: string;
      title: string;
      version: number;
      created: string;
      status: string;
      format: string;
    }[]
  >("automation-candidates", []);
  const today = new Date().toISOString().slice(0, 10);
  const scopeValid = policy.accountIds.some(
    (id) =>
      !policy.stoppedAccounts.includes(id) &&
      accounts.some(
        (a) => a.id === id && a.connected && a.channel === policy.channel,
      ),
  );
  const datesValid =
    !!policy.dateStart &&
    !!policy.dateEnd &&
    policy.dateStart <= today &&
    policy.dateEnd >= today;
  const windowValid =
    !!shadowTime &&
    !!policy.start &&
    !!policy.end &&
    (policy.start <= policy.end
      ? shadowTime >= policy.start && shadowTime <= policy.end
      : shadowTime >= policy.start || shadowTime <= policy.end);
  const shadow = () => {
    if (
      !admin ||
      !policy.enabled ||
      policy.kill ||
      !scopeValid ||
      !datesValid ||
      !windowValid
    )
      return;
    const dailyCount = candidates.filter(
      (c) => c.created.slice(0, 10) === today,
    ).length;
    const weeklyCount = candidates.filter(
      (c) => Date.parse(c.created) >= Date.now() - 7 * 86400000,
    ).length;
    if (dailyCount >= policy.daily || weeklyCount >= policy.frequency) {
      record("Shadow-Prüfung blockiert: Tages- oder Wochenlimit erreicht.");
      return;
    }
    const account = accounts.find(
      (a) =>
        a.connected &&
        a.channel === policy.channel &&
        policy.accountIds.includes(a.id) &&
        !policy.stoppedAccounts.includes(a.id),
    );
    if (!account) return;
    setCandidates((cs) => [
      {
        id: uid("candidate"),
        accountId: account.id,
        title: `Beispielidee: ${policy.topics || "Produktupdate"}`,
        version: policy.version,
        created: now(),
        status: "offen",
        format: policy.format,
      },
      ...cs,
    ]);
    record(
      `Shadow v${policy.version}: Kandidat für ${account.handle} erstellt. Nur Review, keine Veröffentlichung.`,
    );
  };
  const record = (message: string) =>
    setLogs((l) =>
      [`${new Date().toLocaleTimeString("de-DE")} · ${message}`, ...l].slice(
        0,
        20,
      ),
    );
  return (
    <>
      <Section
        title="Du behältst die Kontrolle"
        description="Automatisierung ist standardmäßig aus. Diese Demo prüft Regeln ohne Jobs oder Veröffentlichungen."
        actions={<ShieldCheck size={20} />}
      >
        <Toggle
          label="Richtlinie aktivieren"
          description="Gilt ausschließlich für lokale Shadow-Prüfungen."
          checked={policy.enabled}
          disabled={!admin || policy.kill || !scopeValid || !datesValid}
          onChange={(enabled) => {
            setPolicy({ ...policy, enabled, version: policy.version + 1 });
            record(
              enabled
                ? "Richtlinie aktiviert"
                : "Richtlinie widerrufen. Keine neuen automatischen Jobs.",
            );
          }}
        />
        <Toggle
          label="Globaler Stopp"
          description="Widerruft alle zukünftigen automatischen Aktionen in diesem Workspace. Bereits abgeschlossene öffentliche Beiträge bleiben erhalten."
          checked={policy.kill}
          disabled={!admin}
          onChange={(kill) => {
            setPolicy({
              ...policy,
              kill,
              enabled: kill ? false : policy.enabled,
              version: policy.version + 1,
            });
            if (kill)
              setCandidates((cs) =>
                cs.map((c) =>
                  c.status === "offen" ? { ...c, status: "gestoppt" } : c,
                ),
              );
            record(
              kill
                ? "Globaler Stopp gesetzt. Neue Aktionen gesperrt."
                : "Stopp aufgehoben. Richtlinie bleibt deaktiviert.",
            );
          }}
        />
        <div className="mt-5 border-t pt-5">
          <h3>Account-Bereich & Stopps</h3>
          <div className="divide-y">
            {accounts.map((account) => (
              <div
                className="flex flex-wrap justify-between gap-3 py-3"
                key={account.id}
              >
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={!admin}
                    checked={policy.accountIds.includes(account.id)}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        accountIds: e.target.checked
                          ? [...policy.accountIds, account.id]
                          : policy.accountIds.filter((id) => id !== account.id),
                        version: policy.version + 1,
                      })
                    }
                  />
                  {account.channel} · {account.handle}
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!admin}
                  onClick={() => {
                    const stopped = policy.stoppedAccounts.includes(account.id);
                    setPolicy({
                      ...policy,
                      stoppedAccounts: stopped
                        ? policy.stoppedAccounts.filter(
                            (id) => id !== account.id,
                          )
                        : [...policy.stoppedAccounts, account.id],
                      version: policy.version + 1,
                    });
                    if (!stopped)
                      setCandidates((cs) =>
                        cs.map((c) =>
                          c.accountId === account.id && c.status === "offen"
                            ? { ...c, status: "gestoppt" }
                            : c,
                        ),
                      );
                    record(
                      `${account.handle}: ${stopped ? "Account-Stopp aufgehoben" : "Account-Stopp gesetzt"}.`,
                    );
                  }}
                >
                  {policy.stoppedAccounts.includes(account.id)
                    ? "Account fortsetzen"
                    : "Diesen Account stoppen"}
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="form-grid mt-5">
          <Field label="Aktiv ab">
            <Input
              type="date"
              disabled={!admin}
              value={policy.dateStart}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  dateStart: e.target.value,
                  version: policy.version + 1,
                })
              }
            />
          </Field>
          <Field label="Aktiv bis">
            <Input
              type="date"
              disabled={!admin}
              value={policy.dateEnd}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  dateEnd: e.target.value,
                  version: policy.version + 1,
                })
              }
            />
          </Field>
          <Field label="Erlaubtes Format">
            <select
              className="native-select"
              disabled={!admin}
              value={policy.format}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  format: e.target.value,
                  version: policy.version + 1,
                })
              }
            >
              <option>Einzelbeitrag</option>
              <option>Thread</option>
              <option>Bildbeitrag</option>
            </select>
          </Field>
          <Field label="Quellenbereich">
            <Input
              value={policy.source}
              disabled={!admin}
              onChange={(e) => setPolicy({ ...policy, source: e.target.value })}
            />
          </Field>
          <Field label="Erlaubte Themen">
            <Input
              value={policy.topics}
              disabled={!admin}
              onChange={(e) => setPolicy({ ...policy, topics: e.target.value })}
            />
          </Field>
          <Field label="Kanal">
            <select
              className="native-select"
              disabled={!admin}
              value={policy.channel}
              onChange={(e) =>
                setPolicy({ ...policy, channel: e.target.value })
              }
            >
              {["X", "LinkedIn", "Bluesky", "Mastodon"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Max. Aktionen pro Woche">
            <Input
              type="number"
              min="1"
              max="14"
              value={policy.frequency}
              disabled={!admin}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  frequency: Math.max(1, Math.min(14, Number(e.target.value))),
                })
              }
            />
          </Field>
          <Field label="Zeitfenster ab">
            <Input
              type="time"
              value={policy.start}
              disabled={!admin}
              onChange={(e) => setPolicy({ ...policy, start: e.target.value })}
            />
          </Field>
          <Field label="Zeitfenster bis">
            <Input
              type="time"
              value={policy.end}
              disabled={!admin}
              onChange={(e) => setPolicy({ ...policy, end: e.target.value })}
            />
          </Field>
          <Field label="Tageslimit">
            <Input
              type="number"
              min="1"
              max="5"
              value={policy.daily}
              disabled={!admin}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  daily: Math.max(1, Math.min(5, Number(e.target.value))),
                })
              }
            />
          </Field>
          <Field label="Uhrzeit der Shadow-Prüfung (simuliert)">
            <Input
              type="time"
              value={shadowTime}
              disabled={!admin}
              onChange={(e) => setShadowTime(e.target.value)}
            />
          </Field>
          <Field label="Modus">
            <Input value={policy.mode} readOnly />
          </Field>
        </div>
        <Field label="Ausschlüsse">
          <Textarea
            className="mt-2"
            value={policy.excluded}
            disabled={!admin}
            onChange={(e) => setPolicy({ ...policy, excluded: e.target.value })}
          />
        </Field>
        <div className="flex flex-wrap gap-2 mt-5">
          <Button
            disabled={!admin}
            variant="outline"
            onClick={() => {
              setPolicy({ ...policy, version: policy.version + 1 });
              record(`Richtlinie v${policy.version + 1} gespeichert`);
            }}
          >
            Neue Richtlinienversion speichern
          </Button>
          <Button
            disabled={
              !admin ||
              !policy.enabled ||
              policy.kill ||
              !scopeValid ||
              !datesValid ||
              !windowValid
            }
            onClick={shadow}
          >
            Shadow-Prüfung simulieren
          </Button>
          <Button
            disabled={!admin || !policy.enabled}
            variant="ghost"
            onClick={() => {
              setPolicy({
                ...policy,
                enabled: false,
                version: policy.version + 1,
              });
              setCandidates((cs) =>
                cs.map((c) =>
                  c.status === "offen" ? { ...c, status: "gestoppt" } : c,
                ),
              );
              record(
                "Erlaubnis widerrufen. Wartende automatische Aktionen gestoppt.",
              );
            }}
          >
            Erlaubnis widerrufen
          </Button>
        </div>
        <p className="muted text-xs mt-4 mb-0">
          Policy v{policy.version} · Manuell geplante Beiträge werden vom
          Automations-Stopp nicht verändert. Laufende Remote-Vorgänge könnten in
          Produktion nur abgeglichen werden.
        </p>
      </Section>
      <Section
        title="Shadow-Kandidaten"
        description="Entscheide über die Beispielidee. Annahme ist keine Freigabe und startet keine Veröffentlichung."
      >
        {candidates.length ? (
          <div className="divide-y">
            {candidates.map((candidate) => (
              <div className="py-4" key={candidate.id}>
                <div className="flex flex-wrap gap-3 justify-between mb-2">
                  <span className="font-semibold">{candidate.title}</span>
                  <Status
                    tone={
                      candidate.status === "angenommen" ? "green" : "neutral"
                    }
                  >
                    {candidate.status}
                  </Status>
                </div>
                <p className="muted text-xs">
                  {accounts.find((a) => a.id === candidate.accountId)?.handle ??
                    "Account entfernt"}{" "}
                  · {candidate.format} · Policy v{candidate.version}
                </p>
                <p className="muted text-xs">
                  Grund: erlaubtes Thema, freigegebener Account-Bereich, lokales
                  Zeit- und Mengenlimit. Quellen sind nur Beispiele.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      !admin ||
                      candidate.status !== "offen" ||
                      !policy.enabled ||
                      policy.kill ||
                      policy.stoppedAccounts.includes(candidate.accountId)
                    }
                    onClick={() =>
                      setCandidates((cs) =>
                        cs.map((c) =>
                          c.id === candidate.id
                            ? { ...c, status: "angenommen" }
                            : c,
                        ),
                      )
                    }
                  >
                    Idee annehmen
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!admin || candidate.status !== "offen"}
                    onClick={() =>
                      setCandidates((cs) =>
                        cs.map((c) =>
                          c.id === candidate.id
                            ? { ...c, status: "abgelehnt" }
                            : c,
                        ),
                      )
                    }
                  >
                    Ablehnen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted text-sm mb-0">
            Noch keine Kandidaten. Wähle einen verbundenen Account und einen
            gültigen Zeitraum für eine Shadow-Prüfung.
          </p>
        )}
      </Section>
      <Section title="Shadow-Protokoll">
        {logs.length ? (
          <ol className="space-y-3 text-xs leading-relaxed">
            {logs.map((l, i) => (
              <li key={i} className="border-b pb-3">
                {l}
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted mb-0 text-sm">
            Noch keine Prüfungen. Aktiviere eine Richtlinie, um ihr Verhalten
            lokal zu simulieren.
          </p>
        )}
      </Section>
    </>
  );
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function DataSettings({ admin }: { admin: boolean }) {
  const { state, setState } = useStore();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [exportReady, setExportReady] = useState(false);
  const [typed, setTyped] = useState("");
  const [scope, setScope] = useState(
    state.role === "Owner" ? "workspace" : "account",
  );
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [retention, setRetention] = useWorkspaceLocalState("retention", {
    logs: 30,
    unused: 90,
  });
  const [team, setTeam] = useWorkspaceLocalState<
    { id: string; role: string }[]
  >("team-members", [
    { id: "self", role: "Owner" },
    { id: "lea", role: "Editor" },
  ]);
  const isOwner = state.role === "Owner";
  const workspaceName =
    state.workspaces.find((w) => w.id === state.activeWorkspaceId)?.name ??
    "Workspace";
  const token = scope === "workspace" ? workspaceName : "KONTO LÖSCHEN";
  const otherOwners = team.filter(
    (m) => m.id !== "self" && m.role === "Owner",
  ).length;
  const exportData = () => {
    setProgress(15);
    setExportReady(false);
    setTimeout(() => {
      setProgress(100);
      setExportReady(true);
    }, 500);
  };
  const mayDeleteAccount =
    state.role !== "Viewer" &&
    !(
      team.some((m) => m.id === "self" && m.role === "Owner") &&
      otherOwners === 0 &&
      team.length > 1
    );
  const performDelete = () => {
    if (
      typed !== token ||
      (scope === "workspace" ? !isOwner : !mayDeleteAccount)
    )
      return;
    setDeleting(true);
    setDeleteError("");
    setTimeout(() => {
      if (simulateFailure) {
        setDeleting(false);
        setSimulateFailure(false);
        setDeleteError(
          "Simulierter Löschfehler. Es wurden keine Daten entfernt. Du kannst die Aktion erneut versuchen.",
        );
        return;
      }
      const ws = state.activeWorkspaceId;
      if (scope === "account") {
        for (const workspace of state.workspaces) {
          const key = `dispatch-${workspace.id}-team-members`;
          if (workspace.id === ws)
            setTeam((ms) => ms.filter((m) => m.id !== "self"));
          else {
            try {
              const list = JSON.parse(localStorage.getItem(key) ?? "[]");
              localStorage.setItem(
                key,
                JSON.stringify(
                  list.filter((m: { id: string }) => m.id !== "self"),
                ),
              );
            } catch {
              /* Preserve data if an unrelated member list is invalid. */
            }
          }
        }
        ["dispatch-onboarding-step", "dispatch-onboarding-project"].forEach(
          (key) => localStorage.removeItem(key),
        );
        setState((s) => ({
          ...s,
          preferences: {
            ...s.preferences,
            name: "",
            audience: "",
            tone: "",
            topics: "",
            onboardingDone: false,
          },
          schedules: s.schedules.map((slot) => ({
            ...slot,
            ...(slot.authorization?.by === s.preferences.name
              ? {
                  authorization: {
                    ...slot.authorization,
                    by: "Ehemaliges Mitglied",
                  },
                }
              : {}),
          })),
          drafts: s.drafts.map((d) => ({
            ...d,
            approvals: d.approvals?.map((a) =>
              a.by === s.preferences.name
                ? { ...a, by: "Ehemaliges Mitglied" }
                : a,
            ),
            reviews: d.reviews?.map((r) =>
              r.by === s.preferences.name
                ? { ...r, by: "Ehemaliges Mitglied" }
                : r,
            ),
            assignee:
              d.assignee === s.preferences.name ? undefined : d.assignee,
            comments: d.comments.map((c) =>
              c.author === s.preferences.name
                ? { ...c, author: "Ehemaliges Mitglied" }
                : c,
            ),
            ...(d.approval?.by === s.preferences.name
              ? { approval: { ...d.approval, by: "Ehemaliges Mitglied" } }
              : {}),
          })),
        }));
        setDeleting(false);
        setDeleted(true);
        navigate("/login");
        return;
      }
      Object.keys(localStorage)
        .filter((k) => k.startsWith(`dispatch-${ws}-`))
        .forEach((k) => localStorage.removeItem(k));
      setState((s) => {
        const remaining = s.workspaces.filter((w) => w.id !== ws);
        const workspaces = remaining.length
          ? remaining
          : [
              {
                id: uid("ws"),
                name: "Neuer Workspace",
                description: "Leerer lokaler Workspace",
              },
            ];
        const accounts = s.accounts.filter((a) => a.workspaceId !== ws);
        return {
          ...s,
          workspaces,
          activeWorkspaceId: workspaces[0].id,
          activeAccountId:
            accounts.find((a) => a.workspaceId === workspaces[0].id)?.id ?? "",
          accounts,
          drafts: s.drafts.filter((d) => d.workspaceId !== ws),
          ideas: s.ideas.filter((d) => d.workspaceId !== ws),
          schedules: s.schedules.filter((d) => d.workspaceId !== ws),
          media: s.media.filter((d) => d.workspaceId !== ws),
        };
      });
      setDeleting(false);
      setDeleted(true);
      setDeleteOpen(false);
      toast.success("Workspace und lokale Inhalte gelöscht.");
    }, 650);
  };
  return (
    <>
      <Section
        title="Deine Daten gehören dir"
        description="Exportiere den aktiven Workspace als lesbare JSON-Datei."
      >
        <div className="flex gap-3 flex-wrap">
          <Button
            variant="outline"
            disabled={!admin || (progress > 0 && progress < 100)}
            onClick={exportData}
          >
            <Download size={15} />
            Export vorbereiten
          </Button>
          {exportReady && (
            <Button
              onClick={() => {
                const ws = state.activeWorkspaceId;
                const settings = Object.fromEntries(
                  Object.keys(localStorage)
                    .filter((k) => k.startsWith(`dispatch-${ws}-`))
                    .map((k) => [
                      k,
                      JSON.parse(localStorage.getItem(k) ?? "null"),
                    ]),
                );
                downloadBlob(
                  new Blob(
                    [
                      JSON.stringify(
                        {
                          exportedAt: now(),
                          workspace: state.workspaces.find((w) => w.id === ws),
                          preferences: state.preferences,
                          accounts: state.accounts.filter(
                            (a) => a.workspaceId === ws,
                          ),
                          drafts: state.drafts.filter(
                            (d) => d.workspaceId === ws,
                          ),
                          ideas: state.ideas.filter(
                            (d) => d.workspaceId === ws,
                          ),
                          schedules: state.schedules.filter(
                            (d) => d.workspaceId === ws,
                          ),
                          media: state.media.filter(
                            (d) => d.workspaceId === ws,
                          ),
                          settings,
                        },
                        null,
                        2,
                      ),
                    ],
                    { type: "application/json" },
                  ),
                  "dispatch-workspace.json",
                );
              }}
            >
              JSON herunterladen
            </Button>
          )}
        </div>
        {progress > 0 && (
          <div role="status" className="mt-4">
            <Progress aria-label="Datenexport-Fortschritt" value={progress} />
            <p className="muted text-xs mt-2 mb-0">
              {exportReady
                ? "Export bereit. Keine Passwörter, Tokens oder OAuth-Schlüssel enthalten."
                : "Lokalen Export vorbereiten…"}
            </p>
          </div>
        )}
      </Section>
      <Section title="Aufbewahrung">
        <div className="form-grid">
          <Field label="Ereignisprotokolle">
            <select
              className="native-select"
              disabled={!admin}
              value={retention.logs}
              onChange={(e) =>
                setRetention({ ...retention, logs: Number(e.target.value) })
              }
            >
              {[7, 30, 90].map((n) => (
                <option value={n} key={n}>
                  {n} Tage
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ungenutzte Quellendaten">
            <select
              className="native-select"
              disabled={!admin}
              value={retention.unused}
              onChange={(e) =>
                setRetention({ ...retention, unused: Number(e.target.value) })
              }
            >
              {[30, 90, 365].map((n) => (
                <option value={n} key={n}>
                  {n} Tage
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="muted text-xs mt-4 mb-0">
          Lokale Präferenzen, keine automatische Löschung in der Demo.
          Öffentliche Social-Beiträge werden niemals über die Dateneinstellungen
          gelöscht.
        </p>
      </Section>
      <Section
        title="Workspace oder Konto löschen"
        description="Workspace-Löschung nur als Owner. Kontolöschung entfernt dein Profil und deine Mitgliedschaft; gemeinsam genutzte Inhalte bleiben erhalten."
      >
        <Dialog
          open={deleteOpen}
          onOpenChange={(open) => {
            if (!deleting) {
              setDeleteOpen(open);
              setTyped("");
              setDeleted(false);
              setDeleteError("");
              setSimulateFailure(false);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              variant="outline"
              disabled={state.role === "Viewer"}
              className="text-destructive"
            >
              <Trash2 size={15} />
              Löschung vorbereiten
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lokale Daten löschen</DialogTitle>
              <DialogDescription>
                Workspace-Löschung entfernt die zugehörigen lokalen Inhalte.
                Kontolöschung entfernt nur deine Identität und Mitgliedschaft;
                geteilte Workspaces und ihre Inhalte bleiben erhalten. Externe
                Accounts und öffentliche Beiträge bleiben erhalten.
              </DialogDescription>
            </DialogHeader>
            <Field label="Umfang">
              <select
                className="native-select"
                value={scope}
                disabled={deleting}
                onChange={(e) => {
                  setScope(e.target.value);
                  setTyped("");
                }}
              >
                <option value="workspace" disabled={!isOwner}>
                  Aktiver Workspace
                </option>
                <option value="account">Alle lokalen Konto-Daten</option>
              </select>
            </Field>
            {scope === "account" && !mayDeleteAccount && (
              <p className="text-sm text-destructive">
                Übertrage zuerst die Verantwortung an ein anderes Teammitglied
                unter Team. Der letzte Owner kann sein Konto nicht verlassen.
              </p>
            )}
            <Field label={`Zur Bestätigung „${token}“ eingeben`}>
              <Input
                value={typed}
                disabled={deleting}
                autoComplete="off"
                onChange={(e) => setTyped(e.target.value)}
              />
            </Field>
            <label className="text-xs flex gap-2 items-center">
              <input
                type="checkbox"
                checked={simulateFailure}
                disabled={deleting}
                onChange={(e) => setSimulateFailure(e.target.checked)}
              />
              Demo-Löschfehler einmal simulieren
            </label>
            {deleteError && (
              <p role="alert" className="text-sm text-destructive">
                {deleteError}
              </p>
            )}
            <Button
              variant="destructive"
              disabled={
                typed !== token ||
                deleting ||
                deleted ||
                (scope === "workspace" ? !isOwner : !mayDeleteAccount)
              }
              onClick={performDelete}
            >
              {deleting
                ? "Lokale Daten werden gelöscht…"
                : deleteError
                  ? "Löschung erneut versuchen"
                  : "Endgültig lokal löschen"}
            </Button>
            {deleting && (
              <Progress aria-label="Simulierte Datenlöschung" value={60} />
            )}
          </DialogContent>
        </Dialog>
      </Section>
      <DemoNote>
        Verbindungen trennen widerruft Zugriff. Workspace-Löschung entfernt
        zugehörige lokale Inhalte. Kontolöschung erfordert bei einem Team zuerst
        eine Owner-Übergabe.
      </DemoNote>
    </>
  );
}
