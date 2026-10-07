import { Component, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { RefreshCw, ArrowUpRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Health } from "../../../convex/operations/health";
import { authClient } from "@/lib/auth-client";
import { useStore } from "@/lib/store";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
import { Button } from "@/components/ui/button";
import { Section, Status } from "@/components/shared";

const families: Record<Health["families"][number]["family"], string> = {
  publishing: "Veröffentlichung",
  github: "GitHub",
  media: "Medien",
  research: "Öffentliche Recherche",
  generation: "Öffentliche Generierung",
  own_metrics: "Eigene Messwerte",
  own_history: "Eigene Historie",
  jev_analyzer: "Beitragsanalyse",
  intent_routing: "Absichtszuordnung",
  embedding: "Inhaltssuche",
  output_verification: "Ausgabeprüfung",
};
const states: Record<string, string> = {
  queued: "Eingeplant",
  running: "In Bearbeitung",
  blocked: "Blockiert",
  cancelled: "Abgebrochen",
  completed: "Ablauf beendet",
  ready: "Vorbereitet",
  stopped: "Gestoppt",
  failed: "Fehlgeschlagen",
  uploading: "Upload ausstehend",
  validating: "Validierung ausstehend",
  deleting: "Löschung ausstehend",
  missing: "Beleg fehlt",
  requesting: "Abgleich angefordert",
  accepted: "Anforderung angenommen",
  unknown: "Ergebnis ungeklärt",
  processed: "Lokal verarbeitet",
  scheduled: "Geplant",
  publishing: "Veröffentlichung läuft",
  published: "Veröffentlichungsbeleg vorhanden",
  partial: "Teilweise beendet",
  partially_published: "Teilweise veröffentlicht",
  reconciliation_required: "Abgleich erforderlich",
  pending: "Ausstehend",
  empty: "Keine Ergebnisse",
  budget_exhausted: "Rahmen ausgeschöpft",
  configuration_required: "Konfiguration erforderlich",
  removed: "Entfernt",
  sent: "Nutzung ausstehend",
  settled: "Nutzung erfasst",
  reserved: "Reserviert",
  confirmed: "Bestätigt",
  aborted: "Abgebrochen",
  deleted: "Löschbeleg vorhanden",
};
const time = (n: number | null) =>
  n === null ? "Nicht angegeben" : new Date(n).toLocaleString("de-DE");
const micros = (n: number, currency: string) =>
  `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 6 }).format(n / 1000000)} ${currency}`;
const terminal = (state: string) =>
  [
    "completed",
    "published",
    "cancelled",
    "stopped",
    "failed",
    "processed",
    "aborted",
  ].includes(state);
function route(
  r: NonNullable<Health["families"][number]["rows"][number]["recovery"]>,
) {
  switch (r.kind) {
    case "draft":
      return `/drafts/${r.id}`;
    case "research":
      return "/research";
    case "media":
      return "/media";
    case "signals":
      return "/signals";
    case "ideas":
      return "/ideas";
    case "plans":
      return "/plans";
  }
}
class HealthBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">
        Betriebsbelege konnten nicht geladen werden. Bitte den Nachweis
        aktualisieren.
      </p>
    ) : (
      this.props.children
    );
  }
}
export function NativeHealth() {
  const { state, nativeScope } = useStore();
  if (state.role !== "Owner" && state.role !== "Admin")
    return (
      <Section title="Betriebsbelege">
        <p>Diese Übersicht steht nur Ownern und Admins zur Verfügung.</p>
      </Section>
    );
  return <HealthScope key={nativeScope} />;
}
function HealthScope() {
  const { state, nativeScope } = useStore(),
    [accountId, setAccountId] = useState(""),
    [refreshKey, setRefreshKey] = useState(() => crypto.randomUUID());
  const accounts = state.accounts.filter(
      (a) => a.workspaceId === state.activeWorkspaceId,
    ),
    selected = accounts.find((a) => a.id === accountId);
  const validSelection = !accountId || !!selected;
  return (
    <Section title="Betriebsbelege">
      <div className="stack">
        <p className="muted">
          Gespeicherte, begrenzte Belege. Keine Verbindungstests; private Chats
          sind ausgeschlossen.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="stack flex-1 min-w-0">
            Bereich
            <select
              className="w-full rounded border p-2"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setRefreshKey(crypto.randomUUID());
              }}
            >
              <option value="">Gesamter Workspace</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.channel}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            onClick={() => setRefreshKey(crypto.randomUUID())}
          >
            <RefreshCw size={14} />
            Nachweis aktualisieren
          </Button>
        </div>
        {validSelection ? (
          <HealthBoundary key={`${nativeScope}:${accountId}:${refreshKey}`}>
            <HealthRead
              workspaceId={state.activeWorkspaceId as Id<"workspaces">}
              accountId={
                accountId ? (accountId as Id<"socialAccounts">) : undefined
              }
              refreshKey={refreshKey}
            />
          </HealthBoundary>
        ) : (
          <p role="status">Account-Auswahl aktualisieren.</p>
        )}
      </div>
    </Section>
  );
}
function HealthRead({
  workspaceId,
  accountId,
  refreshKey,
}: {
  workspaceId: Id<"workspaces">;
  accountId?: Id<"socialAccounts">;
  refreshKey: string;
}) {
  const { state, nativeScope } = useStore(),
    session = authClient.useSession(),
    authId = session.data?.user.id,
    sessionId = session.data?.session.id;
  const data = useQuery(
    api.operations.health.get,
    authId && sessionId ? { workspaceId, accountId, refreshKey } : "skip",
  );
  const horizons = data
    ? [
        data.validUntil,
        ...data.families.flatMap((f) =>
          f.rows.flatMap((r) =>
            terminal(r.state)
              ? []
              : [r.deadline, r.leaseUntil, r.notBefore].filter(
                  (n): n is number => n !== null && n > 0,
                ),
          ),
        ),
      ]
    : [];
  const now = useGithubSourceProofClock(
    horizons.map((proofExpiresAt) => ({ authorized: true, proofExpiresAt })),
  );
  if (!data) return <p role="status">Betriebsbelege werden geladen …</p>;
  const expectedScope = `${authId}:${sessionId}:${workspaceId}:${state.activeAccountId}:${state.role}`;
  if (
    data.authId !== authId ||
    data.sessionId !== sessionId ||
    data.workspaceId !== workspaceId ||
    data.accountId !== (accountId ?? null) ||
    nativeScope !== expectedScope
  )
    return (
      <p role="status">
        Der Nachweis gehört nicht mehr zur aktuellen Auswahl. Bitte
        aktualisieren.
      </p>
    );
  if (data.validUntil <= now)
    return <p role="status">Nachweis abgelaufen. Bitte aktualisieren.</p>;
  return (
    <div className="stack" data-testid="native-health">
      <div className="flex flex-wrap items-center gap-2">
        <Status>Begrenzte Stichprobe</Status>
        <span className="text-sm muted">Erfasst: {time(data.observedAt)}</span>
      </div>
      <p className="text-sm muted">
        {data.coverage.accountsLoaded} Accounts im Rahmen
        {data.coverage.moreEligibleAccounts
          ? " · Weitere Accounts nicht ausgewertet"
          : ""}
        . Kein Gesamtbestand und keine Aussage zur Erreichbarkeit externer
        Dienste.
      </p>
      {data.coverage.reasons.includes("read_budget") && (
        <p role="status" className="text-sm">
          Leserahmen erreicht. Weitere Bereiche wurden nicht ausgewertet.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {data.families.map((f) => (
          <section
            key={f.family}
            className="rounded-lg border p-4 stack min-w-0"
            aria-label={families[f.family]}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold">{families[f.family]}</h4>
              <Status>
                {f.coverage === "not_evaluated"
                  ? "Nicht ausgewertet"
                  : "Begrenzter Nachweis"}
              </Status>
            </div>
            {f.coverage === "not_evaluated" ? (
              <p className="text-sm muted">
                Für diesen Bereich liegt in dieser Übersicht kein ausgewerteter
                Nachweis vor.
              </p>
            ) : (
              <>
                <p className="text-sm muted">
                  {f.sampledRows} erfasste Vorgänge
                  {f.moreEligibleRows
                    ? " · Weitere Vorgänge außerhalb der Stichprobe"
                    : ""}
                  {f.moreEligibleRows === null ? " · Umfang offen" : ""}.
                </p>
                {f.rows.length === 0 && (
                  <p className="text-sm">
                    Keine Belege in dieser Stichprobe. Daraus folgt keine
                    Aussage zum Systemzustand.
                  </p>
                )}
                {f.rows.map((r) => (
                  <ReceiptRow key={r.parent.id} row={r} now={now} />
                ))}
              </>
            )}
            {f.reason === "child_cap" && (
              <p className="text-sm muted">
                Finanzbelege sind auf die ausgewählte Stichprobe begrenzt.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
function ReceiptRow({
  row: r,
  now,
}: {
  row: Health["families"][number]["rows"][number];
  now: number;
}) {
  const overdue =
    r.overdue ||
    (!terminal(r.state) &&
      ((r.deadline !== null && r.deadline <= now) ||
        (r.leaseUntil !== null && r.leaseUntil > 0 && r.leaseUntil <= now)));
  return (
    <div className="border-t pt-3 stack text-sm min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <Status
          tone={
            overdue ||
            r.code === "attention" ||
            r.code === "usage_unresolved" ||
            r.state === "unknown" ||
            r.state === "failed"
              ? "orange"
              : "neutral"
          }
        >
          {states[r.state] ?? "Beleg gespeichert"}
        </Status>
        {overdue && <span>Frist erreicht · Prüfung nötig</span>}
        {r.code === "attention" && !overdue && (
          <span>Offener Vorgang · Abgleich nötig</span>
        )}
      </div>
      <p className="muted">Erfasst: {time(r.recordedAt)}</p>
      {r.outcomes.length > 0 && (
        <p>
          Ergebnisse:{" "}
          {r.outcomes.map((s) => states[s] ?? "Beleg gespeichert").join(" · ")}
        </p>
      )}
      {r.notBefore !== null && r.notBefore > now && (
        <p>Wartefrist bis {time(r.notBefore)}</p>
      )}
      {r.localReceipt === true && <p>Lokaler Eingangsbeleg vorhanden</p>}
      {r.receipts.length > 0 ? (
        <ul className="stack list-none m-0 p-0">
          {r.receipts.map((t) => (
            <li key={t.attemptId} className="break-words">
              <span className="font-medium">
                {states[t.state] ?? "Beleg gespeichert"}
              </span>{" "}
              · Gebunden: {micros(t.heldMicros, t.currency)} · Beobachtet:{" "}
              {t.estimatedMicros === null
                ? "ungeklärt"
                : micros(t.estimatedMicros, t.currency)}
              {t.settledAt !== null
                ? ` · Verbucht: ${t.estimatedMicros === null ? "ungeklärt" : micros(t.estimatedMicros, t.currency)}`
                : " · Noch nicht verbucht"}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Kein Finanzbeleg in dieser Stichprobe.</p>
      )}
      {r.moreReceipts && (
        <p className="muted">
          Weitere Finanzbelege nicht angezeigt; kein Gesamtbetrag.
        </p>
      )}
      {r.recovery && (
        <Link
          className="inline-flex items-center gap-1 text-primary underline underline-offset-4 self-start"
          to={route(r.recovery)}
        >
          Vorhandenen Vorgang öffnen
          <ArrowUpRight size={14} />
        </Link>
      )}
    </div>
  );
}
