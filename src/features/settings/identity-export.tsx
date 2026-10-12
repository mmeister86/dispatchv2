import { useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared";
const models = {
  user: "Profil",
  session: "Anmeldungen",
  account: "Anmeldeverbindungen",
  oauthApplication: "Eigene OAuth-Anwendungen",
  oauthConsent: "Eigene OAuth-Einwilligungen",
  oauthAccessToken: "OAuth-Berechtigungsmetadaten",
} as const;
export function NativeIdentityExport() {
  const { state, nativeScope } = useStore();
  const { data: session } = authClient.useSession();
  const convex = useConvex();
  const [model, setModel] = useState<keyof typeof models>("user");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const paging = useRef({
    cursor: null as string | null,
    bound: null as number | null,
    done: false,
    number: 1,
  });
  const scope = `${nativeScope}:${session?.user.id}:${session?.session.id}:${state.activeWorkspaceId}:${state.role}:${model}`;
  const owner = useRef({ scope, epoch: 0 });
  if (owner.current.scope !== scope)
    owner.current = { scope, epoch: owner.current.epoch + 1 };
  const alive = useRef(false),
    inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    paging.current = { cursor: null, bound: null, done: false, number: 1 };
    inFlight.current = false;
    setBusy(false);
    setError("");
    setStatus("");
  }, [scope]);
  const download = async () => {
    if (!session || inFlight.current || paging.current.done) return;
    const epoch = owner.current.epoch,
      valid = () => alive.current && owner.current.epoch === epoch;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const requestKey = crypto.randomUUID();
      const r = await convex.query(api.operations.exportIdentity.page, {
        workspaceId: state.activeWorkspaceId as Id<"workspaces">,
        expectedAuthId: session.user.id,
        expectedSessionId: session.session.id,
        requestKey,
        model,
        cursor: paging.current.cursor,
        creationUpperBound: paging.current.bound,
      });
      if (!valid()) return;
      if (
        r.authId !== session.user.id ||
        r.sessionId !== session.session.id ||
        r.workspaceId !== state.activeWorkspaceId ||
        r.requestKey !== requestKey ||
        r.role !== state.role ||
        r.data.model !== model ||
        r.proofValidUntil <= Date.now() ||
        (paging.current.bound !== null &&
          r.creationUpperBound !== paging.current.bound)
      )
        throw Error("scope changed");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(r.data, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `dispatch-identity-${model}-${paging.current.number}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      paging.current = {
        cursor: r.cursor,
        bound: r.creationUpperBound,
        done: r.isDone,
        number: paging.current.number + 1,
      };
      setStatus(
        r.isDone
          ? "Alle Seiten wurden zum Download übergeben."
          : "Seite wurde heruntergeladen. Weitere Datensätze sind verfügbar.",
      );
    } catch {
      if (valid())
        setError(
          "Export konnte nicht sicher erstellt werden. Bitte erneut versuchen.",
        );
    } finally {
      if (valid()) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <Section
      title="Eigene Anmeldedaten exportieren"
      description="Paginierter Export deiner gespeicherten Identitäts- und Berechtigungsmetadaten. Passwörter, Tokens und andere Geheimnisse sind ausgeschlossen."
    >
      <label htmlFor="identity-model">Datensätze</label>
      <select
        id="identity-model"
        value={model}
        onChange={(e) => setModel(e.target.value as keyof typeof models)}
      >
        {Object.entries(models).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        disabled={busy || !session || paging.current.done}
        onClick={() => void download()}
      >
        {busy ? "Export läuft …" : "Nächste Seite herunterladen"}
      </Button>
      {paging.current.done && (
        <Button
          variant="outline"
          onClick={() => {
            paging.current = {
              cursor: null,
              bound: null,
              done: false,
              number: 1,
            };
            setStatus("");
          }}
        >
          Neu beginnen
        </Button>
      )}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </Section>
  );
}
