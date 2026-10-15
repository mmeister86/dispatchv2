import { Component, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { RefreshCw } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { useStore } from "@/lib/store";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
import { Button } from "@/components/ui/button";
import { Section, Status } from "@/components/shared";
class PilotBoundary extends Component<
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
        Messwerte konnten nicht geladen werden. Bitte aktualisieren.
      </p>
    ) : (
      this.props.children
    );
  }
}
export function NativePilot() {
  const { state, nativeScope } = useStore();
  if (state.role !== "Owner" && state.role !== "Admin")
    return (
      <Section title="Pilot-Auswertung">
        <p>Diese Auswertung steht nur Ownern und Admins zur Verfügung.</p>
      </Section>
    );
  const account = state.accounts.find(
    (a) =>
      a.id === state.activeAccountId &&
      a.workspaceId === state.activeWorkspaceId,
  );
  return (
    <Section title="Pilot-Auswertung">
      <div className="stack">
        <p className="muted">
          Begrenzte Impressions-Stichprobe für{" "}
          {account?.name ?? "den ausgewählten Account"}: höchstens die letzten
          fünf bestätigten Kandidaten, ausschließlich ursprüngliche einzelne
          Textposts ohne Medien. Der weitere Umfang ist unbekannt.
        </p>
        <p className="text-sm muted">
          24 Stunden bezeichnet das Alter der einzelnen Messung nach
          Veröffentlichung, keinen Pilotzeitraum. Nutzen, Zeitersparnis, Kosten
          und der gesamte Pilot sind nicht ausgewertet.
        </p>
        {account ? (
          <PilotScope
            key={nativeScope}
            workspaceId={state.activeWorkspaceId as Id<"workspaces">}
            accountId={account.id as Id<"socialAccounts">}
          />
        ) : (
          <p role="status">Bitte einen Account auswählen.</p>
        )}
      </div>
    </Section>
  );
}
function PilotScope({
  workspaceId,
  accountId,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
}) {
  const [refreshKey, setRefreshKey] = useState<string | null>(() => {
    try {
      return crypto.randomUUID();
    } catch {
      return null;
    }
  });
  return (
    <div className="stack">
      <Button
        variant="outline"
        onClick={() => {
          try {
            setRefreshKey(crypto.randomUUID());
          } catch {
            setRefreshKey(null);
          }
        }}
      >
        <RefreshCw size={14} />
        Messwerte aktualisieren
      </Button>
      {refreshKey ? (
        <PilotBoundary key={refreshKey}>
          <PilotRead
            workspaceId={workspaceId}
            accountId={accountId}
            refreshKey={refreshKey}
          />
        </PilotBoundary>
      ) : (
        <p role="alert">
          Messwerte konnten nicht geladen werden. Bitte aktualisieren.
        </p>
      )}
    </div>
  );
}
function PilotRead({
  workspaceId,
  accountId,
  refreshKey,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
  refreshKey: string;
}) {
  const { state, nativeScope } = useStore(),
    session = authClient.useSession(),
    authId = session.data?.user.id,
    sessionId = session.data?.session.id;
  const result = useQuery(
    api.operations.pilot.get,
    !session.isPending && authId && sessionId
      ? { workspaceId, accountId, expectedAuthId: authId, refreshKey }
      : "skip",
  );
  const now = useGithubSourceProofClock(
    result?.data.until === null || !result
      ? []
      : [{ authorized: true, proofExpiresAt: result.data.until }],
  );
  if (!result) return <p role="status">Messwerte werden geladen …</p>;
  if (
    result.authId !== authId ||
    result.sessionId !== sessionId ||
    result.refreshKey !== refreshKey ||
    result.data.accountId !== accountId ||
    nativeScope !==
      `${authId}:${sessionId}:${workspaceId}:${accountId}:${state.role}`
  )
    return (
      <p role="status">
        Der Messnachweis gehört nicht mehr zur aktuellen Auswahl. Bitte
        aktualisieren.
      </p>
    );
  if (
    result.data.until !== null &&
    (!Number.isFinite(result.data.until) || result.data.until <= now)
  )
    return <p role="status">Messnachweis abgelaufen. Bitte aktualisieren.</p>;
  if (!result.data.cohorts.length)
    return (
      <p role="status">
        Keine auswertbare Beobachtung in dieser Teilstichprobe. Impressions sind
        unbekannt.
      </p>
    );
  const count = (value: number | null) =>
    value === null
      ? "Unbekannt"
      : new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(
          value,
        );
  return (
    <div className="stack" data-testid="native-pilot">
      <Status>Begrenzte Teilstichprobe · Umfang offen</Status>
      <p className="text-sm muted">
        Vergleichbare Messungen werden gemeinsam angezeigt; unterschiedliche
        ursprüngliche Definitionen bleiben getrennt. n zählt nur bekannte
        Impressions-Messwerte.
      </p>
      {result.data.cohorts.map((cohort, i) => (
        <div className="border-y py-4" key={cohort.key}>
          <h3 className="text-base font-semibold">Messgruppe {i + 1}</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="muted">Bekannte Messwerte (n)</dt>
              <dd className="text-xl font-semibold" data-testid="pilot-n">
                {cohort.impressions.n}
              </dd>
            </div>
            <div>
              <dt className="muted">Impressions · Summe</dt>
              <dd className="text-xl font-semibold" data-testid="pilot-sum">
                {count(cohort.impressions.sum)}
              </dd>
            </div>
            <div>
              <dt className="muted">Impressions · Mittelwert</dt>
              <dd className="text-xl font-semibold" data-testid="pilot-mean">
                {count(cohort.impressions.mean)}
              </dd>
            </div>
          </dl>
        </div>
      ))}
      <p className="text-sm muted">
        Impressions zählen wiederholte Sichtkontakte, keine eindeutigen
        Personen. Unbekannte oder nicht sicher addierbare Werte werden nicht als
        0 Sichtkontakte dargestellt.
      </p>
    </div>
  );
}
