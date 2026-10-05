import { ResearchPipeline, ResearchInbox } from "./pipeline";
import { SourceSearch } from "./source-search";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Section, EmptyState } from "@/components/shared";
type Config = Doc<"researchProfileVersions">["config"];
type Attempt = { execute: () => Promise<unknown>; success: () => void };
const empty: Config = {
  topics: "",
  project: "",
  audience: "",
  languages: ["de"],
  regions: [],
  preferredSources: [],
  exclusions: "",
  freshnessDays: 7,
  topicCount: 5,
  frequency: "manual",
  timeZone: "Europe/Berlin",
  clock: "09:00",
  weekday: 1,
  cap: null,
  autoHandoff: false,
};
const date = (at: number | null) =>
  at === null
    ? "—"
    : new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(at) + " UTC";
function errorText(e: unknown) {
  const s = e instanceof Error ? e.message : String(e);
  if (s.includes("REVISION_CONFLICT"))
    return "Das Profil wurde inzwischen geändert. Deine Eingaben bleiben erhalten; öffne die aktuelle Version für einen neuen Speicherversuch.";
  if (s.includes("OPERATION_CONFLICT"))
    return "Diese Anfrage hatte bereits andere Eingaben. Prüfe die gespeicherte Version, bevor du eine neue Anfrage beginnst.";
  if (s.includes("CONFIGURATION") || s.includes("ROLE_ACCESS"))
    return "Aktuelle Verarbeitungs- und Preisfreigabe, ausreichende Provider-, Workspace- und Accountdeckung sowie Editor-Rechte erforderlich. Das Profil bleibt gespeichert; Research-Aufrufe sind noch nicht verfügbar.";
  return "Die Aktion wurde nicht bestätigt. Eingaben bleiben erhalten; prüfe Profil, Account und Berechtigung und versuche es erneut.";
}
export function RealResearch() {
  const { state } = useStore();
  if (!state.activeAccountId)
    return (
      <>
        <PageHeader
          title="Research"
          description="Profile und begrenzte Rechercheaufträge."
        />
        <EmptyState
          title="Account auswählen"
          description="Wähle einen Workspace-Account für dein Research-Profil."
        />
      </>
    );
  return (
    <ResearchAccount
      key={`${state.activeWorkspaceId}:${state.activeAccountId}`}
      workspaceId={state.activeWorkspaceId as Id<"workspaces">}
      accountId={state.activeAccountId as Id<"socialAccounts">}
    />
  );
}
function ResearchAccount({
  workspaceId,
  accountId,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
}) {
  const { state } = useStore();
  const row = useQuery(api.research.profiles.get, { workspaceId, accountId });
  const configuration = useQuery(api.research.profiles.configuration, {
    workspaceId,
    accountId,
  });
  const [selectedId, setSelectedId] = useState<Id<"researchOrders"> | null>(
    null,
  );
  const [capCurrency, setCapCurrency] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const history = useQuery(
    api.research.runs.history,
    row
      ? {
          workspaceId,
          profileId: row.profile._id,
          paginationOpts: { numItems: 10, cursor },
        }
      : "skip",
  );
  const create = useMutation(api.research.profiles.create),
    change = useMutation(api.research.profiles.change),
    start = useMutation(api.research.runs.start),
    stop = useMutation(api.research.runs.stop);
  const [buffer, setBuffer] = useState<Config | null>(null),
    [revision, setRevision] = useState(0),
    [capText, setCapText] = useState(""),
    [capChanged, setCapChanged] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [failedAttempt, setFailedAttempt] = useState<Attempt | null>(null);
  const mounted = useRef(false),
    pending = useRef(false),
    latestBuffer = useRef(buffer),
    context = useRef({ role: state.role, epoch: 0 });
  latestBuffer.current = buffer;
  if (context.current.role !== state.role)
    context.current = { role: state.role, epoch: context.current.epoch + 1 };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const editable = state.role !== "Viewer" && !row?.profile.deleted;
  const writable = editable && !failedAttempt;
  async function runAttempt(attempt: Attempt, retry = false) {
    if (pending.current || state.role === "Viewer") return;
    const epoch = context.current.epoch;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await attempt.execute();
      if (mounted.current) setFailedAttempt(null);
      if (mounted.current && context.current.epoch === epoch) {
        attempt.success();
        setMessage(
          retry
            ? "Ursprüngliche Anfrage bestätigt. Der aktuelle Profilzustand bleibt maßgeblich."
            : "Aktion bestätigt.",
        );
      }
    } catch (e) {
      if (mounted.current) setFailedAttempt(attempt);
      if (mounted.current && context.current.epoch === epoch)
        setError(errorText(e));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function command(
    fn: (key: string) => Promise<unknown>,
    success: () => void,
  ) {
    if (failedAttempt) return;
    const key = crypto.randomUUID();
    await runAttempt({ execute: () => fn(key), success });
  }
  function edit() {
    const c = row?.version.config ?? empty;
    setBuffer(structuredClone(c));
    setRevision(row?.profile.revision ?? 0);
    setCapText(c.cap ? String(c.cap.limitMicros / 1e6) : "");
    setCapChanged(false);
    setCapCurrency("");
    setError("");
  }
  const selectedCurrency =
    buffer?.cap?.currency ?? (capCurrency || configuration?.currency);
  const approvedCurrencies =
    configuration?.currencies ??
    (configuration?.currency ? [configuration.currency] : []);
  async function save() {
    if (!buffer) return;
    let cap: Config["cap"] = capChanged ? null : buffer.cap;
    if (capChanged && capText.trim()) {
      if (
        !selectedCurrency ||
        !approvedCurrencies.includes(selectedCurrency) ||
        !/^\d{1,7}(?:\.\d{1,6})?$/.test(capText)
      ) {
        setError(
          "Setze ein endliches Auftragslimit mit höchstens sechs Nachkommastellen in der aktuell freigegebenen Währung.",
        );
        return;
      }
      const [whole, fraction = ""] = capText.split(".");
      const limitMicros = Number(whole) * 1e6 + Number(fraction.padEnd(6, "0"));
      cap = { currency: selectedCurrency!, limitMicros };
    }
    const config = { ...buffer, cap };
    const acknowledge = () => {
      if (latestBuffer.current === buffer) setBuffer(null);
    };
    if (revision > 0 && row)
      await command(
        (key) =>
          change({
            workspaceId,
            profileId: row.profile._id,
            expectedRevision: revision,
            commandKey: key,
            action: { kind: "save", config },
          }),
        acknowledge,
      );
    else
      await command(
        (key) => create({ workspaceId, accountId, commandKey: key, config }),
        acknowledge,
      );
  }
  const profile = row?.profile;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Research"
        description="Ein gespeichertes Profil je Account; Profiländerungen gelten nur für neue Aufträge."
      />
      <Section title="Verfügbarkeit">
        <p>
          Quellenadapter benötigen eine aktuelle ausdrückliche Freigabe. Alte
          vorbereitete Zeitpläne bleiben blockiert; Inbox-Ergebnisse bleiben
          Review; automatische Übergabe ist deaktiviert.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Kostenpflichtige Recherche benötigt einen freigegebenen
          Verarbeitungspfad, aktuelle Suchpreise, ein endliches Limit in der
          tatsächlichen Abrechnungswährung und drei gedeckte Budgets. Ein
          API-Schlüssel allein aktiviert nichts.
        </p>
      </Section>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {failedAttempt && (
        <div className="space-y-2">
          <p>
            Die ursprüngliche Anfrage ist noch nicht bestätigt. Wiederholen
            prüft dieselben Eingaben; Verwerfen entfernt nur diese
            Wiederholungsoption, keine gespeicherte Änderung.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || state.role === "Viewer"}
              onClick={() => runAttempt(failedAttempt, true)}
            >
              Ursprüngliche Anfrage wiederholen
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setFailedAttempt(null);
                setError("");
                setMessage("");
              }}
            >
              Wiederholungsoption verwerfen
            </Button>
          </div>
        </div>
      )}
      {row === undefined ? (
        <p>Research-Profil wird geladen …</p>
      ) : (
        <Section title="Research-Profil">
          {!row ? (
            <p>
              Noch kein Research-Profil. Neue Profile beginnen manuell und ohne
              Budget.
            </p>
          ) : (
            <>
              <p>{row.version.config.topics}</p>
              <p className="text-sm text-muted-foreground">
                {profile!.deleted
                  ? "Gelöscht · historischer Beleg bleibt erhalten"
                  : profile!.paused
                    ? "Pausiert"
                    : "Manuelle Aufträge möglich"}{" "}
                · Zeitplan{" "}
                {profile!.scheduleActive
                  ? profile!.scheduleKind === "workflow"
                    ? "aktiv (ausdrücklich freigegebener Workflow)"
                    : "aktiv (nur blockierte Auftragsbelege)"
                  : "inaktiv"}
              </p>
              <dl className="grid grid-cols-3 gap-4 my-4">
                <div>
                  <dt>Nächster Zeitplan-Aufruf</dt>
                  <dd>{date(profile!.nextAt)}</dd>
                </div>
                <div>
                  <dt>Letzter Research-Erfolg</dt>
                  <dd>—</dd>
                </div>
                <div>
                  <dt>Budget verwendet</dt>
                  <dd>Nicht verfügbar</dd>
                </div>
              </dl>
              {profile!.scheduleReason && (
                <p>Zeitplan gestoppt: {profile!.scheduleReason}</p>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!writable || busy} onClick={edit}>
              {row ? "Aktuelle Version öffnen" : "Profil erstellen"}
            </Button>
            {row && !profile!.deleted && (
              <>
                <Button
                  disabled={
                    !writable ||
                    busy ||
                    profile!.paused ||
                    !!profile!.activeOrderId ||
                    !!buffer
                  }
                  onClick={() =>
                    command(
                      (key) =>
                        start({
                          workspaceId,
                          profileId: profile!._id,
                          expectedRevision: profile!.revision,
                          operationKey: key,
                        }),
                      () => {},
                    )
                  }
                >
                  Auftrag anlegen
                </Button>
                <Button
                  variant="outline"
                  disabled={!writable || busy}
                  onClick={() =>
                    command(
                      (key) =>
                        change({
                          workspaceId,
                          profileId: profile!._id,
                          expectedRevision: profile!.revision,
                          commandKey: key,
                          action: { kind: "pause", paused: !profile!.paused },
                        }),
                      () => {},
                    )
                  }
                >
                  {profile!.paused ? "Pause aufheben" : "Pausieren"}
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    !writable ||
                    busy ||
                    profile!.paused ||
                    !!buffer ||
                    row.version.config.frequency === "manual"
                  }
                  onClick={() =>
                    command(
                      (key) =>
                        change({
                          workspaceId,
                          profileId: profile!._id,
                          expectedRevision: profile!.revision,
                          commandKey: key,
                          action: {
                            kind: profile!.scheduleActive
                              ? "deactivate"
                              : "activate",
                          },
                        }),
                      () => {},
                    )
                  }
                >
                  {profile!.scheduleActive
                    ? "Zeitplan deaktivieren"
                    : "Zeitplan ausdrücklich aktivieren"}
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    !writable ||
                    busy ||
                    profile!.paused ||
                    !!buffer ||
                    row.version.config.frequency === "manual"
                  }
                  onClick={() =>
                    command(
                      (key) =>
                        change({
                          workspaceId,
                          profileId: profile!._id,
                          expectedRevision: profile!.revision,
                          commandKey: key,
                          action: {
                            kind: "activate-workflow",
                            language: row.version.config.languages[0],
                            operations: ["web-search"],
                          },
                        }),
                      () => {},
                    )
                  }
                >
                  Web-Workflow periodisch aktivieren
                </Button>
                <Button
                  variant="outline"
                  disabled={!writable || busy}
                  onClick={() =>
                    command(
                      (key) =>
                        change({
                          workspaceId,
                          profileId: profile!._id,
                          expectedRevision: profile!.revision,
                          commandKey: key,
                          action: { kind: "delete" },
                        }),
                      () => setBuffer(null),
                    )
                  }
                >
                  Profil löschen
                </Button>
              </>
            )}
          </div>
        </Section>
      )}
      {buffer && (
        <Section title="Profil bearbeiten">
          <fieldset
            disabled={busy || !editable}
            className="grid gap-4 sm:grid-cols-2"
          >
            {(
              [
                ["topics", "Themen"],
                ["project", "Projektbezug"],
                ["audience", "Zielgruppe"],
                ["exclusions", "Ausschlüsse"],
              ] as const
            ).map(([field, label]) => (
              <label key={field}>
                {label}
                <Textarea
                  value={buffer[field]}
                  onChange={(e) =>
                    setBuffer({ ...buffer, [field]: e.target.value })
                  }
                />
              </label>
            ))}
            <label>
              Sprachen (Komma getrennt)
              <Input
                value={buffer.languages.join(",")}
                onChange={(e) =>
                  setBuffer({ ...buffer, languages: e.target.value.split(",") })
                }
              />
            </label>
            <label>
              Regionen (Komma getrennt)
              <Input
                value={buffer.regions.join(",")}
                onChange={(e) =>
                  setBuffer({
                    ...buffer,
                    regions: e.target.value ? e.target.value.split(",") : [],
                  })
                }
              />
            </label>
            <label>
              Bevorzugte HTTPS-Quellen (eine je Zeile)
              <Textarea
                value={buffer.preferredSources.join("\n")}
                onChange={(e) =>
                  setBuffer({
                    ...buffer,
                    preferredSources: e.target.value
                      ? e.target.value.split("\n")
                      : [],
                  })
                }
              />
            </label>
            <p className="text-sm text-muted-foreground">
              Sprachen wie de/en, Regionen wie DE/EU/global. Regionen und
              Quellen sind Wünsche; unterstützte Quellen, Verfügbarkeit und
              Zugriffsrechte sind noch nicht bestätigt.
            </p>
            <label>
              Frischefenster (Tage)
              <Input
                type="number"
                min="1"
                max="90"
                value={buffer.freshnessDays}
                onChange={(e) =>
                  setBuffer({
                    ...buffer,
                    freshnessDays: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Themenanzahl
              <Input
                type="number"
                min="1"
                max="20"
                value={buffer.topicCount}
                onChange={(e) =>
                  setBuffer({ ...buffer, topicCount: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Häufigkeit
              <select
                className="w-full border rounded p-2"
                disabled={!row}
                value={buffer.frequency}
                onChange={(e) =>
                  setBuffer({
                    ...buffer,
                    frequency: e.target.value as Config["frequency"],
                  })
                }
              >
                <option value="manual">Manuell</option>
                <option value="daily">Täglich</option>
                <option value="weekly">Wöchentlich</option>
              </select>
            </label>
            <label>
              IANA-Zeitzone
              <Input
                value={buffer.timeZone}
                onChange={(e) =>
                  setBuffer({ ...buffer, timeZone: e.target.value })
                }
              />
            </label>
            <label>
              Lokale Uhrzeit
              <Input
                type="time"
                value={buffer.clock}
                onChange={(e) =>
                  setBuffer({ ...buffer, clock: e.target.value })
                }
              />
            </label>
            <label>
              Wochentag
              <select
                className="w-full border rounded p-2"
                value={buffer.weekday}
                onChange={(e) =>
                  setBuffer({ ...buffer, weekday: Number(e.target.value) })
                }
              >
                {[
                  "Sonntag",
                  "Montag",
                  "Dienstag",
                  "Mittwoch",
                  "Donnerstag",
                  "Freitag",
                  "Samstag",
                ].map((s, i) => (
                  <option value={i} key={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Auftragslimit{" "}
              {buffer.cap?.currency ??
                selectedCurrency ??
                "(Währung noch nicht freigegeben)"}
              <Input
                inputMode="decimal"
                disabled={
                  !row ||
                  !selectedCurrency ||
                  !approvedCurrencies.includes(selectedCurrency)
                }
                value={capText}
                onChange={(e) => {
                  setCapText(e.target.value);
                  setCapChanged(true);
                  setBuffer({ ...buffer });
                }}
              />
            </label>
            {!buffer.cap && approvedCurrencies.length > 1 && (
              <label>
                Limit-Währung
                <select
                  value={capCurrency}
                  onChange={(e) => {
                    setCapCurrency(e.target.value);
                    setCapChanged(true);
                    setBuffer({ ...buffer });
                  }}
                  className="w-full border rounded p-2"
                >
                  <option value="">Währung ausdrücklich auswählen</option>
                  {approvedCurrencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            )}
            {buffer.cap && (
              <Button
                variant="outline"
                onClick={() => {
                  setBuffer({ ...buffer, cap: null });
                  setCapText("");
                  setCapChanged(true);
                }}
              >
                Auftragslimit entfernen
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              Fehlgeschlagene Anfragen können mit der sichtbaren
              Wiederholungsoption exakt geprüft werden. Aktuelle Version öffnen
              beginnt eine neue Bearbeitung. Keine automatische Inbox-Übergabe.
              Änderungen deaktivieren den bisherigen Zeitplan; erneute
              Aktivierung ist ausdrücklich erforderlich. Bei Sommerzeit-Lücken
              entfällt die lokale Ausführung, bei doppelter Uhrzeit gilt die
              frühere Instanz.
            </p>
            <Button disabled={!!failedAttempt} onClick={save}>
              Profil speichern
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setBuffer(null);
                setError("");
              }}
            >
              Bearbeitung schließen
            </Button>
          </fieldset>
        </Section>
      )}
      {row && !profile!.deleted && (
        <ResearchPipeline
          workspaceId={workspaceId}
          profileId={profile!._id}
          revision={profile!.revision}
          config={row.version.config}
          disabled={
            !writable ||
            busy ||
            profile!.paused ||
            !!buffer ||
            !!profile!.activeOrderId
          }
          command={command}
          onSelect={setSelectedId}
        />
      )}
      {row && !profile!.deleted && (
        <SourceSearch
          workspaceId={workspaceId}
          accountId={accountId}
          profileId={profile!._id}
          revision={profile!.revision}
          config={row.version.config}
          disabled={
            !writable ||
            busy ||
            profile!.paused ||
            !!buffer ||
            !!profile!.activeOrderId
          }
          command={command}
          selectedId={selectedId}
          onSelect={setSelectedId}
          canInvalidate={state.role === "Owner" || state.role === "Admin"}
        />
      )}
      <Section title="Auftragshistorie">
        {!row ? (
          <p>Noch keine Aufträge.</p>
        ) : !history ? (
          <p>Aufträge werden geladen …</p>
        ) : (
          <>
            {!history.page.length && <p>Noch keine Aufträge.</p>}
            <div className="space-y-3">
              {history.page.map((o) => (
                <div
                  className="flex flex-wrap justify-between gap-2 border-b py-3"
                  key={o._id}
                >
                  <div>
                    <p>
                      {date(o.createdAt)} · {o.occasion} · {o.state}
                    </p>
                    <p className="text-sm">{o.config.topics}</p>
                    <p className="text-sm text-muted-foreground">
                      {o.reason ??
                        (o.state === "completed"
                          ? "Quellensuche beendet; Belege separat prüfen"
                          : "Auftrag wartet auf Prüfung")}{" "}
                      · Quellensuche oder Workflow-Beleg; Ergebnisse separat
                      prüfen
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedId(o._id)}
                  >
                    Quellenbelege anzeigen
                  </Button>
                  {(o.state === "queued" || o.state === "running") && (
                    <Button
                      variant="outline"
                      disabled={!writable || busy}
                      onClick={() =>
                        command(
                          () => stop({ workspaceId, orderId: o._id }),
                          () => {},
                        )
                      }
                    >
                      Auftrag stoppen
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                disabled={!cursor}
                onClick={() => setCursor(null)}
              >
                Neueste Aufträge
              </Button>
              <Button
                variant="outline"
                disabled={history.isDone}
                onClick={() => setCursor(history.continueCursor)}
              >
                Ältere Aufträge
              </Button>
            </div>
          </>
        )}
      </Section>
      <ResearchInbox
        workspaceId={workspaceId}
        orderId={selectedId}
        disabled={!writable || busy}
        command={command}
      />
    </div>
  );
}
