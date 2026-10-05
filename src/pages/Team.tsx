import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  MessageSquare,
  Plus,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DemoNote, PageHeader, Section, Status } from "@/components/shared";
import { useStore, useWorkspaceLocalState } from "@/lib/store";
import {
  approveDraft,
  approved,
  currentVersion,
  now,
  uid,
  type Role,
} from "@/lib/model";
import { Field } from "./Settings";
import { toast } from "sonner";

type Member = { id: string; name: string; email: string; role: Role };
type Invite = {
  id: string;
  email: string;
  role: Role;
  expires: string;
  status: "offen" | "angenommen" | "widerrufen";
};
type ReviewLink = {
  id: string;
  draftId: string;
  version: number;
  expires: string;
  revoked: boolean;
};
const roles: Role[] = ["Owner", "Admin", "Editor", "Viewer"];
export function TeamPage() {
  const { state, setState, mutate } = useStore();
  const admin = state.role === "Owner" || state.role === "Admin";
  const owner = state.role === "Owner";
  const editable = state.role !== "Viewer";
  const [members, setMembers] = useWorkspaceLocalState<Member[]>(
    "team-members",
    [
      {
        id: "self",
        name: "Matthias",
        email: "matthias@example.com",
        role: "Owner",
      },
      { id: "lea", name: "Lea", email: "lea@example.com", role: "Editor" },
    ],
  );
  const [invites, setInvites] = useWorkspaceLocalState<Invite[]>(
    "team-invites",
    [],
  );
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("Editor");
  const [expiry, setExpiry] = useState(7);
  const [transfer, setTransfer] = useState<string | null>(null);
  const [stages, setStages] = useWorkspaceLocalState("review-stages", {
    editorial: false,
    brand: false,
    final: true,
  });
  const [links, setLinks] = useWorkspaceLocalState<ReviewLink[]>(
    "review-links",
    [],
  );
  const [support, setSupport] = useWorkspaceLocalState("support-access", {
    enabled: false,
    consent: false,
    expires: "",
  });
  const [selectedId, setSelectedId] = useState("");
  const [comment, setComment] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [externalComment, setExternalComment] = useState("");
  const drafts = state.drafts.filter(
    (d) => d.workspaceId === state.activeWorkspaceId,
  );
  const selected =
    drafts.find((d) => d.id === selectedId) ??
    drafts.find((d) => !approved(d)) ??
    drafts[0];
  const previewLink = links.find((l) => l.id === previewId);
  const previewDraft = drafts.find((d) => d.id === previewLink?.draftId);
  const previewVersion = previewDraft?.versions.find(
    (v) => v.number === previewLink?.version,
  );
  const previewActive =
    !!previewLink &&
    !previewLink.revoked &&
    Date.parse(previewLink.expires) > Date.now() &&
    !!previewVersion;
  const requiredPolicy = selected?.reviewPolicy ??
    state.reviewPolicies?.[state.activeWorkspaceId] ?? {
      editorial: false,
      brand: false,
    };
  const hasReview = (stage: "editorial" | "brand") =>
    !!selected?.reviews?.some(
      (r) =>
        r.stage === stage &&
        r.version === currentVersion(selected).number &&
        r.accountId === selected.accountId,
    );
  const stagesReady =
    (!requiredPolicy.editorial || hasReview("editorial")) &&
    (!requiredPolicy.brand || hasReview("brand"));
  const markReview = (stage: "editorial" | "brand") => {
    if (!editable || !selected) return;
    setState((s) => ({
      ...s,
      drafts: s.drafts.map((d) =>
        d.id === selected.id
          ? {
              ...d,
              reviews: [
                ...(d.reviews ?? []).filter(
                  (r) =>
                    !(
                      r.stage === stage &&
                      r.version === currentVersion(d).number &&
                      r.accountId === d.accountId
                    ),
                ),
                {
                  stage,
                  version: currentVersion(d).number,
                  accountId: d.accountId,
                  by: s.preferences.name,
                  at: now(),
                },
              ],
            }
          : d,
      ),
    }));
  };
  const ownerCount = members.filter((m) => m.role === "Owner").length;
  const changeRole = (id: string, role: Role) => {
    const m = members.find((m) => m.id === id);
    if (!admin || !m || ((m.role === "Owner" || role === "Owner") && !owner))
      return;
    if (m.role === "Owner" && ownerCount === 1 && role !== "Owner") {
      toast.error("Der letzte Owner muss zuerst die Verantwortung übertragen.");
      return;
    }
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, role } : m)));
    if (id === "self") setState((s) => ({ ...s, role }));
  };
  return (
    <>
      <PageHeader
        eyebrow="Gemeinsam besser"
        title="Team & Freigaben"
        description="Klare Zuständigkeiten. Gutes Feedback. Eine Stimme, die zusammenpasst."
        actions={<Status tone="green">{members.length} Mitglieder</Status>}
      />
      <div className="stack">
        <Section
          title="Menschen in deinem Workspace"
          actions={<ShieldCheck size={20} />}
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mitglied</th>
                  <th>Rolle</th>
                  <th>Verwaltung</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="bg-secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                          {member.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-semibold mb-1">
                            {member.name}
                            {member.id === "self" && " · Du"}
                          </p>
                          <p className="muted text-xs mb-0">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        aria-label={`Rolle von ${member.name}`}
                        className="native-select min-w-28"
                        value={member.role}
                        disabled={!admin || (member.role === "Owner" && !owner)}
                        onChange={(e) =>
                          changeRole(member.id, e.target.value as Role)
                        }
                      >
                        {roles.map((r) => (
                          <option key={r} disabled={r === "Owner" && !owner}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {owner && member.id !== "self" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTransfer(member.id)}
                          >
                            Owner-Übergabe
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={
                            !admin ||
                            member.id === "self" ||
                            (member.role === "Owner" &&
                              (!owner || ownerCount <= 1))
                          }
                          onClick={() => {
                            if (
                              !admin ||
                              (member.role === "Owner" &&
                                (!owner || ownerCount <= 1))
                            )
                              return;
                            setMembers((ms) =>
                              ms.filter((m) => m.id !== member.id),
                            );
                          }}
                        >
                          Entfernen
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted text-xs mt-4 mb-0">
            Nur Owner können Owner-Rechte vergeben. Der letzte Owner ist vor
            Entfernung und Herabstufung geschützt.
          </p>
        </Section>
        <Section
          title="Jemanden einladen"
          description="Lokale Einladungen — keine E-Mail wird versendet."
        >
          <form
            className="grid gap-3 sm:grid-cols-[1fr_140px_120px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!admin || (inviteRole === "Owner" && !owner)) return;
              if (
                members.some(
                  (m) => m.email.toLowerCase() === email.toLowerCase(),
                ) ||
                invites.some(
                  (i) =>
                    i.email.toLowerCase() === email.toLowerCase() &&
                    i.status === "offen" &&
                    new Date(i.expires).getTime() > Date.now(),
                )
              ) {
                toast.error(
                  "Diese Person ist bereits Mitglied oder hat eine offene Einladung.",
                );
                return;
              }
              setInvites((is) => [
                ...is,
                {
                  id: uid("invite"),
                  email,
                  role: inviteRole,
                  expires: new Date(
                    Date.now() + expiry * 86400000,
                  ).toISOString(),
                  status: "offen",
                },
              ]);
              setEmail("");
            }}
          >
            <Input
              aria-label="E-Mail für Einladung"
              type="email"
              required
              placeholder="name@beispiel.de"
              value={email}
              disabled={!admin}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select
              className="native-select"
              aria-label="Rolle der Einladung"
              disabled={!admin}
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
            >
              {roles.map((r) => (
                <option key={r} disabled={r === "Owner" && !owner}>
                  {r}
                </option>
              ))}
            </select>
            <select
              aria-label="Einladung gültig"
              className="native-select"
              disabled={!admin}
              value={expiry}
              onChange={(e) => setExpiry(Number(e.target.value))}
            >
              <option value={1}>1 Tag</option>
              <option value={7}>7 Tage</option>
              <option value={30}>30 Tage</option>
            </select>
            <Button disabled={!admin}>
              <UserPlus size={15} />
              Einladen
            </Button>
          </form>
          {invites.length > 0 && (
            <div className="divide-y mt-5">
              {invites.map((invite) => {
                const expired = Date.parse(invite.expires) < Date.now();
                const available = invite.status === "offen" && !expired;
                return (
                  <div
                    key={invite.id}
                    className="flex flex-wrap justify-between items-center gap-3 py-3"
                  >
                    <div>
                      <p className="font-medium mb-1">{invite.email}</p>
                      <p className="muted text-xs mb-0">
                        {invite.role} · bis{" "}
                        {new Date(invite.expires).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Status tone={available ? "orange" : "neutral"}>
                        {expired && invite.status === "offen"
                          ? "Abgelaufen"
                          : invite.status}
                      </Status>
                      {available && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              !admin || (invite.role === "Owner" && !owner)
                            }
                            onClick={() => {
                              if (!admin || (invite.role === "Owner" && !owner))
                                return;
                              setMembers((ms) => [
                                ...ms,
                                {
                                  id: uid("member"),
                                  name: invite.email.split("@")[0],
                                  email: invite.email,
                                  role: invite.role,
                                },
                              ]);
                              setInvites((is) =>
                                is.map((i) =>
                                  i.id === invite.id
                                    ? { ...i, status: "angenommen" }
                                    : i,
                                ),
                              );
                            }}
                          >
                            Annahme simulieren
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!admin}
                            onClick={() =>
                              setInvites((is) =>
                                is.map((i) =>
                                  i.id === invite.id
                                    ? { ...i, status: "widerrufen" }
                                    : i,
                                ),
                              )
                            }
                          >
                            Widerrufen
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!admin}
                            onClick={() =>
                              setInvites((is) =>
                                is.map((i) =>
                                  i.id === invite.id
                                    ? {
                                        ...i,
                                        expires: new Date(
                                          Date.now() - 1000,
                                        ).toISOString(),
                                      }
                                    : i,
                                ),
                              )
                            }
                          >
                            Ablauf testen
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <Section
            title="Freigabe-Warteschlange"
            description={`${drafts.filter((d) => !approved(d)).length} Entwürfe warten auf die Freigabe ihrer aktuellen Version.`}
          >
            <div className="divide-y">
              {drafts.map((draft) => (
                <button
                  key={draft.id}
                  className={`w-full text-left flex items-center justify-between gap-4 px-2 py-4 rounded-md ${selected?.id === draft.id ? "bg-secondary" : "hover:bg-secondary/50"}`}
                  onClick={() => {
                    setSelectedId(draft.id);
                    setComment("");
                  }}
                >
                  <span>
                    <span className="block font-semibold">{draft.title}</span>
                    <span className="muted text-xs mt-1 block">
                      v{currentVersion(draft).number} ·{" "}
                      {draft.assignee ?? "Nicht zugewiesen"} ·{" "}
                      {draft.comments.filter((c) => !c.resolved).length} offene
                      Kommentare
                    </span>
                  </span>
                  <Status tone={approved(draft) ? "green" : "orange"}>
                    {approved(draft) ? "Freigegeben" : "Review"}
                  </Status>
                </button>
              ))}
              {!drafts.length && (
                <p className="muted text-sm">
                  Noch keine Entwürfe. Erstelle den ersten im Editor.
                </p>
              )}
            </div>
          </Section>
          <Section
            title="Freigabe-Regeln"
            description="Lokale Prozessvorgabe. Die finale Freigabe bleibt versions- und accountgebunden."
          >
            {Object.entries(stages).map(([key, enabled]) => (
              <label key={key} className="flex gap-3 py-3 items-center">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={!admin || key === "final"}
                  onChange={(e) => {
                    if (!admin) return;
                    const next = { ...stages, [key]: e.target.checked };
                    setStages(next);
                    setState((s) => ({
                      ...s,
                      reviewPolicies: {
                        ...s.reviewPolicies,
                        [s.activeWorkspaceId]: {
                          editorial: next.editorial,
                          brand: next.brand,
                        },
                      },
                      drafts: s.drafts.map((d) =>
                        d.workspaceId === s.activeWorkspaceId
                          ? {
                              ...d,
                              reviewPolicy: {
                                editorial: next.editorial,
                                brand: next.brand,
                              },
                              approval: undefined,
                              approvals: d.approvals?.map((a) => ({
                                ...a,
                                revokedAt: now(),
                              })),
                            }
                          : d,
                      ),
                      schedules: s.schedules.map((slot) =>
                        slot.workspaceId === s.activeWorkspaceId &&
                        slot.status === "scheduled"
                          ? {
                              ...slot,
                              status: "cancelled",
                              error:
                                "Review-Regeln geändert. Erneut prüfen, freigeben und planen.",
                            }
                          : slot,
                      ),
                    }));
                  }}
                />
                <span>
                  {key === "editorial"
                    ? "Redaktionelle Prüfung"
                    : key === "brand"
                      ? "Marke & Tonalität"
                      : "Finale Owner-/Admin-Freigabe"}
                </span>
              </label>
            ))}
            <p className="muted text-xs mb-0 mt-3">
              Kommentare lösen ist keine Freigabe. Änderungen am Inhalt
              benötigen erneut eine Freigabe.
            </p>
          </Section>
        </div>
        {selected && (
          <Section
            title={selected.title}
            description={`Feedback für Version ${currentVersion(selected).number}`}
            actions={
              <Link
                to={`/drafts/${selected.id}`}
                className="inline-flex gap-1 items-center text-xs font-semibold"
              >
                Im Editor öffnen
                <ArrowUpRight size={14} />
              </Link>
            }
          >
            <div className="form-grid">
              <div>
                <div className="bg-background p-4 rounded-md whitespace-pre-wrap leading-relaxed text-sm mb-5">
                  {currentVersion(selected).text.join("\n\n—\n\n")}
                </div>
                <Field label="Verantwortlich">
                  <select
                    className="native-select"
                    value={selected.assignee ?? ""}
                    disabled={!editable}
                    onChange={(e) => {
                      if (!editable) return;
                      setState((s) => ({
                        ...s,
                        drafts: s.drafts.map((d) =>
                          d.id === selected.id
                            ? { ...d, assignee: e.target.value || undefined }
                            : d,
                        ),
                      }));
                    }}
                  >
                    <option value="">Nicht zugewiesen</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex flex-wrap gap-2 mt-4">
                  {requiredPolicy.editorial && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!editable || hasReview("editorial")}
                      onClick={() => markReview("editorial")}
                    >
                      {hasReview("editorial")
                        ? "Redaktion geprüft"
                        : "Redaktionelle Prüfung bestätigen"}
                    </Button>
                  )}
                  {requiredPolicy.brand && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!editable || hasReview("brand")}
                      onClick={() => markReview("brand")}
                    >
                      {hasReview("brand")
                        ? "Marke geprüft"
                        : "Markenprüfung bestätigen"}
                    </Button>
                  )}
                </div>
                {!stagesReady && (
                  <p className="text-xs muted mt-3">
                    Erst die verpflichtenden Prüfungen für diese Version und
                    diesen Account bestätigen.
                  </p>
                )}
                <Button
                  className="mt-4"
                  disabled={!admin || approved(selected) || !stagesReady}
                  onClick={() => {
                    setSelectedId(selected.id);
                    mutate(
                      (s) => approveDraft(s, selected.id),
                      "Aktuelle Version freigegeben.",
                    );
                  }}
                >
                  <Check size={15} />
                  {approved(selected)
                    ? `Version ${currentVersion(selected).number} freigegeben`
                    : "Diese Version freigeben"}
                </Button>
              </div>
              <div>
                <h3 className="flex items-center gap-2">
                  <MessageSquare size={16} />
                  Kommentare
                </h3>
                <div className="space-y-4 mb-5">
                  {selected.comments.map((c) => (
                    <div
                      key={c.id}
                      className={`border-b pb-3 ${c.resolved ? "muted" : ""}`}
                    >
                      <div className="flex flex-wrap gap-2 justify-between text-xs mb-2">
                        <strong>
                          {c.author} · v{c.version}
                        </strong>
                        <span>
                          {c.resolved ? "Gelöst · keine Freigabe" : "Offen"}
                        </span>
                      </div>
                      <p className="text-sm mb-2 whitespace-pre-wrap">
                        {c.text}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!editable}
                        onClick={() => {
                          if (!editable) return;
                          setState((s) => ({
                            ...s,
                            drafts: s.drafts.map((d) =>
                              d.id === selected.id
                                ? {
                                    ...d,
                                    comments: d.comments.map((x) =>
                                      x.id === c.id
                                        ? { ...x, resolved: !x.resolved }
                                        : x,
                                    ),
                                  }
                                : d,
                            ),
                          }));
                        }}
                      >
                        {c.resolved ? "Wieder öffnen" : "Als gelöst markieren"}
                      </Button>
                    </div>
                  ))}
                  {!selected.comments.length && (
                    <p className="muted text-xs">
                      Noch kein Feedback. Eine konkrete Beobachtung hilft mehr
                      als ein „Gefällt mir“.
                    </p>
                  )}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!editable || !comment.trim()) return;
                    const text = comment.trim();
                    setState((s) => ({
                      ...s,
                      drafts: s.drafts.map((d) =>
                        d.id === selected.id
                          ? {
                              ...d,
                              comments: [
                                ...d.comments,
                                {
                                  id: uid("comment"),
                                  version: currentVersion(d).number,
                                  author: s.preferences.name,
                                  text,
                                  resolved: false,
                                },
                              ],
                            }
                          : d,
                      ),
                    }));
                    setComment("");
                  }}
                >
                  <Textarea
                    aria-label="Kommentar zur aktuellen Version"
                    placeholder="Dein Feedback zur aktuellen Version…"
                    value={comment}
                    disabled={!editable}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="mt-3"
                    disabled={!editable || !comment.trim()}
                  >
                    Kommentar hinzufügen
                  </Button>
                </form>
              </div>
            </div>
          </Section>
        )}
        <Section
          title="Externes Kundenreview"
          description="Ein Review-Link ist auf genau einen Entwurf und eine Version begrenzt. Demo-Token funktionieren ausschließlich in dieser lokalen Ansicht."
        >
          <Button
            disabled={!admin || !selected}
            variant="outline"
            onClick={() => {
              if (!admin || !selected) return;
              setLinks((ls) => [
                ...ls,
                {
                  id: uid("review"),
                  draftId: selected.id,
                  version: currentVersion(selected).number,
                  expires: new Date(Date.now() + 48 * 3600000).toISOString(),
                  revoked: false,
                },
              ]);
            }}
          >
            <Plus size={15} />
            Demo-Review für ausgewählten Entwurf
          </Button>
          <div className="divide-y mt-4">
            {links.map((link) => (
              <div
                className="py-3 flex flex-wrap items-center justify-between gap-3"
                key={link.id}
              >
                <div>
                  <p className="font-medium mb-1">
                    {drafts.find((d) => d.id === link.draftId)?.title ??
                      "Entwurf entfernt"}{" "}
                    · v{link.version}
                  </p>
                  <p className="muted text-xs mb-1">
                    Nur Kommentare · keine Freigabe · endet{" "}
                    {new Date(link.expires).toLocaleString("de-DE")}
                  </p>
                  <code className="text-xs break-all">{link.id}</code>
                </div>
                <div className="flex gap-2 items-center">
                  <Status>
                    {link.revoked
                      ? "Widerrufen"
                      : Date.parse(link.expires) < Date.now()
                        ? "Abgelaufen"
                        : "Demo-Token aktiv"}
                  </Status>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPreviewId(link.id);
                      setExternalComment("");
                    }}
                  >
                    Lokale Vorschau
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!admin || link.revoked}
                    onClick={() =>
                      setLinks((ls) =>
                        ls.map((l) =>
                          l.id === link.id ? { ...l, revoked: true } : l,
                        ),
                      )
                    }
                  >
                    Widerrufen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>
        <Section
          title="Zeitlich begrenzter Support-Zugriff"
          description="Nur Metadaten und Fehlerprotokolle dieses Workspace, keine privaten Quellen oder Veröffentlichungsrechte."
        >
          <label className="flex gap-2 items-start text-sm mb-4">
            <input
              className="mt-1"
              type="checkbox"
              checked={support.consent}
              disabled={!admin || support.enabled}
              onChange={(e) =>
                setSupport({ ...support, consent: e.target.checked })
              }
            />
            Ich stimme einem lokalen Demo-Zugriff für höchstens 24 Stunden zu.
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={!admin || (!support.enabled && !support.consent)}
              onClick={() =>
                setSupport({
                  ...support,
                  enabled: !support.enabled,
                  consent: support.enabled ? false : support.consent,
                  expires: support.enabled
                    ? ""
                    : new Date(Date.now() + 86400000).toISOString(),
                })
              }
            >
              {support.enabled ? "Zugriff widerrufen" : "Demo-Zugriff erlauben"}
            </Button>
            <Status>
              {support.enabled && Date.parse(support.expires) > Date.now()
                ? `Lokal erlaubt bis ${new Date(support.expires).toLocaleString("de-DE")}`
                : "Kein Support-Zugriff"}
            </Status>
          </div>
        </Section>
        <Section title="Rollen verstehen">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Aktion</th>
                  {roles.map((r) => (
                    <th key={r}>{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Inhalte ansehen", true, true, true, true],
                  ["Inhalte & Kommentare bearbeiten", true, true, true, false],
                  ["Freigeben & planen", true, true, false, false],
                  [
                    "Verbindungen, Regeln & Einladungen",
                    true,
                    true,
                    false,
                    false,
                  ],
                  ["Owner übertragen & löschen", true, false, false, false],
                ].map((row) => (
                  <tr key={String(row[0])}>
                    <td className="text-sm">{row[0]}</td>
                    {row.slice(1).map((allowed, i) => (
                      <td key={i}>
                        {allowed ? (
                          <Check size={15} aria-label="Erlaubt" />
                        ) : (
                          <span aria-label="Nicht erlaubt">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 items-center">
            <span className="text-sm font-medium">Demo-Rolle testen</span>
            <select
              className="native-select w-auto"
              aria-label="Aktive Demo-Rolle"
              value={state.role}
              onChange={(e) =>
                setState((s) => ({ ...s, role: e.target.value as Role }))
              }
            >
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <span className="muted text-xs">
              Simuliert Berechtigungen ohne die echte Teamrolle zu ändern.
            </span>
          </div>
        </Section>
        <DemoNote>
          Team, Einladungen und externe Review-Tokens werden ausschließlich
          lokal simuliert. Es gibt keinen öffentlich erreichbaren
          Kundenreview-Link.
        </DemoNote>
      </div>
      <Dialog
        open={!!transfer}
        onOpenChange={(open) => {
          if (!open) setTransfer(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verantwortung übertragen</DialogTitle>
            <DialogDescription>
              {members.find((m) => m.id === transfer)?.name} wird Owner. Deine
              eigene Teamrolle wird Admin. Mindestens ein Owner bleibt erhalten.
            </DialogDescription>
          </DialogHeader>
          <Button
            disabled={!owner}
            onClick={() => {
              if (!owner || !transfer) return;
              setMembers((ms) =>
                ms.map((m) =>
                  m.id === transfer
                    ? { ...m, role: "Owner" }
                    : m.id === "self"
                      ? { ...m, role: "Admin" }
                      : m,
                ),
              );
              setState((s) => ({ ...s, role: "Admin" }));
              setTransfer(null);
              toast.success("Owner-Verantwortung lokal übertragen.");
            }}
          >
            Übergabe bestätigen
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!previewId}
        onOpenChange={(open) => {
          if (!open) setPreviewId("");
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Externes Review · lokale Vorschau</DialogTitle>
            <DialogDescription>
              Auf genau einen Entwurf und die Version {previewLink?.version}{" "}
              begrenzt. Kein Zugriff auf andere Inhalte, private Quellen,
              Freigaben oder Veröffentlichungen.
            </DialogDescription>
          </DialogHeader>
          {previewActive && previewDraft && previewVersion ? (
            <>
              <h3>{previewDraft.title}</h3>
              <div className="bg-background rounded-md p-4 text-sm whitespace-pre-wrap leading-relaxed">
                {previewVersion.text.join("\n\n—\n\n")}
              </div>
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (
                    !editable ||
                    !externalComment.trim() ||
                    !previewLink ||
                    previewLink.revoked ||
                    Date.parse(previewLink.expires) <= Date.now()
                  )
                    return;
                  setState((s) => ({
                    ...s,
                    drafts: s.drafts.map((d) =>
                      d.id === previewLink.draftId
                        ? {
                            ...d,
                            comments: [
                              ...d.comments,
                              {
                                id: uid("comment"),
                                version: previewLink.version,
                                author: "Kundenreview · Demo",
                                text: externalComment.trim(),
                                resolved: false,
                              },
                            ],
                          }
                        : d,
                    ),
                  }));
                  setExternalComment("");
                  toast.success(
                    "Feedback an die freigegebene Review-Version angehängt. Keine Freigabe erteilt.",
                  );
                }}
              >
                <Field label="Kundenfeedback zur geteilten Version">
                  <Textarea
                    required
                    disabled={!editable}
                    value={externalComment}
                    onChange={(e) => setExternalComment(e.target.value)}
                  />
                </Field>
                <Button disabled={!editable || !externalComment.trim()}>
                  Feedback lokal speichern
                </Button>
              </form>
            </>
          ) : (
            <p role="status" className="muted text-sm">
              Dieser Demo-Token ist abgelaufen, widerrufen oder sein Inhalt
              wurde entfernt. Kein Zugriff auf den Entwurf.
            </p>
          )}
          <DemoNote>
            Dies ist eine lokale Vorschau des Kundenreviews. Es existiert kein
            öffentlicher Link.
          </DemoNote>
        </DialogContent>
      </Dialog>
    </>
  );
}
