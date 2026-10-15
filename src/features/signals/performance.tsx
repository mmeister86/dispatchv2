import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared";
export function PerformanceContext({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const { state } = useStore(),
    accounts = state.accounts.filter(
      (a) => a.workspaceId === workspaceId && a.channel === "X",
    );
  const [chosen, setChosen] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const account =
      accounts.find((a) => a.id === (chosen || state.activeAccountId)) ??
      accounts[0],
    args = account
      ? { workspaceId, accountId: account.id as Id<"socialAccounts"> }
      : ("skip" as const);
  const scope = `${workspaceId}/${account?.id ?? ""}`,
    latestScope = useRef(scope);
  latestScope.current = scope;
  useEffect(() => {
    setBusy(false);
    setError("");
  }, [scope]);
  const data = useQuery(api.content.performance.context, args),
    consent = useMutation(api.content.performance.consent);
  const clock = useGithubSourceProofClock([
      ...(data?.entries ?? []).map((e) => ({
        authorized: true,
        proofExpiresAt: e.expiresAt,
      })),
      ...(data?.configuration
        ? [{ authorized: true, proofExpiresAt: data.configuration.expiresAt }]
        : []),
    ]),
    entries = data?.entries.filter((e) => e.expiresAt > clock) ?? [];
  const configured =
      data?.configuration && data.configuration.expiresAt > clock,
    admin = ["Owner", "Admin"].includes(state.role);
  if (!account) return null;
  return (
    <Section
      title="Performance-Kontext für Content"
      description="Geschützter menschlicher Lesekontext aus eigenen Messungen; separate Zweckfreigabe. Kein automatischer Modellaufruf, keine Modellschulung und keine Übernahme als ungebundene Notiz."
    >
      <label className="text-sm">
        Kontext-Account
        <select
          className="native-select"
          aria-label="Kontext-Account"
          value={account.id}
          onChange={(e) => setChosen(e.target.value)}
        >
          {accounts.map((a) => (
            <option value={a.id} key={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {!data ? (
        <p role="status">Kontext wird geladen …</p>
      ) : (
        <>
          <p className="text-sm muted my-3">
            {!configured
              ? "Separate bestätigte Content-Verarbeitungsrechte fehlen oder sind abgelaufen. Konfiguration bleibt deaktiviert."
              : !data.enabled
                ? "Content-Kontext ist pausiert. Aktivieren bestätigt ausschließlich den angegebenen menschlichen Lesezweck."
                : !entries.length
                  ? data.reason === "PERFORMANCE_CONTENT_UNSAFE_AGGREGATE"
                    ? "Gemessene Ausgangszähler lassen keine sichere aggregierte Beschreibung zu; der Kontext bleibt unverfügbar."
                    : "Keine geeigneten eigenen Messungen im begrenzten Account-Sample verfügbar."
                  : `${entries.length} beschreibende Performance-Signale verfügbar.`}
          </p>
          <Button
            variant="outline"
            disabled={!admin || busy || (!data.enabled && !configured)}
            onClick={async () => {
              if (typeof args === "string") return;
              setBusy(true);
              setError("");
              try {
                await consent({
                  ...args,
                  enabled: !data.enabled,
                  ...(data.configuration
                    ? {
                        policyId: data.configuration.id,
                        policyFingerprint: data.configuration.fingerprint,
                      }
                    : {}),
                });
              } catch {
                if (latestScope.current !== scope) return;
                setError(
                  "Zweckfreigabe wurde nicht bestätigt; prüfe aktuelle Rechte und Policy.",
                );
              } finally {
                if (latestScope.current === scope) setBusy(false);
              }
            }}
          >
            {data.enabled
              ? "Content-Kontext pausieren"
              : "Content-Kontext aktivieren"}
          </Button>
          {configured && (
            <p className="text-xs muted mt-2">
              Zweck {data.configuration!.purpose} · Policy{" "}
              {data.configuration!.id} · bis{" "}
              {new Date(data.configuration!.expiresAt).toLocaleString("de-DE")}.
              Modellübergabe bleibt nicht freigegeben.
            </p>
          )}
          <div className="space-y-3 mt-4">
            {entries.map((e) => (
              <article key={e.cohort} className="surface p-4">
                <p className="text-sm">{e.summary}</p>
                <p className="text-xs muted mt-2">
                  performance_signal · Stand{" "}
                  {new Date(e.asOf).toLocaleString("de-DE")} · verfügbar bis{" "}
                  {new Date(e.expiresAt).toLocaleString("de-DE")}
                </p>
                <details className="text-xs mt-2">
                  <summary>Quellen, Definition und Nenner</summary>
                  <p className="break-all">
                    Kohorte {e.cohort} · Definition{" "}
                    {e.definitionVersion ?? "unbekannt"} · n={e.n}
                  </p>
                  <p className="break-all">
                    Snapshots {e.snapshotIds.join(", ")} · Versionen{" "}
                    {e.versionIds.join(", ")} · Publikationskenntnis{" "}
                    {e.knowledgeIds.join(", ") || "nicht erfasst"} · damalige
                    Analysen{" "}
                    {e.assessmentIds.join(", ") ||
                      "keine verfügbare damalige Analyse"}
                  </p>
                  {e.denominators.map((d) => (
                    <p key={d.name}>
                      {d.name}: n={d.n}, Zähler {d.numerator ?? "unbekannt"},
                      Nenner Impressionen {d.denominator ?? "unbekannt"} ·
                      Zählerkomponenten{" "}
                      {d.components?.join(" + ") ?? "unbekannt"} · fehlend{" "}
                      {d.missing
                        ?.map((x) => `${x.reason}: ${x.n}`)
                        .join(" · ") || "keine"}
                    </p>
                  ))}
                </details>
              </article>
            ))}
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </Section>
  );
}
