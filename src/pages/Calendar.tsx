import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  PageHeader,
  PublishBadge,
  AccountIcon,
  Status,
  EmptyState,
  formatDate,
} from "@/components/shared";
import { ScheduleDialog } from "@/components/ScheduleDialog";
import { useStore } from "@/lib/store";
import {
  canApprove,
  draftValid,
  snapshotDraft,
  canResumeSnapshot,
  approveSnapshot,
  resumeSnapshot,
  now,
  type Schedule,
} from "@/lib/model";
function dateKey(value: string, zone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
function addDate(d: Date, offset: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + offset);
  return x;
}
export function CalendarPage() {
  const { state, mutate } = useStore();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") ?? "week";
  const [anchor, setAnchor] = useState(new Date());
  const [account, setAccount] = useState("all");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState<Schedule | null>(null);
  const [moving, setMoving] = useState<Schedule | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const zone = state.preferences.timezone;
  const monday = addDate(anchor, -((anchor.getDay() + 6) % 7));
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const gridStart = addDate(first, -((first.getDay() + 6) % 7));
  const days = Array.from({ length: view === "month" ? 42 : 7 }, (_, i) =>
    addDate(view === "month" ? gridStart : monday, i),
  );
  const schedules = state.schedules.filter(
    (s) =>
      s.workspaceId === state.activeWorkspaceId &&
      (account === "all" || s.accountId === account) &&
      (status === "all" || s.status === status),
  );
  const currentDetail = detail
    ? state.schedules.find((s) => s.id === detail.id)
    : undefined;
  const draft = currentDetail
    ? state.drafts.find((d) => d.id === currentDetail.draftId)
    : undefined;
  const accounts = state.accounts.filter(
    (a) => a.workspaceId === state.activeWorkspaceId,
  );
  const snapshot = currentDetail
    ? snapshotDraft(state, currentDetail)
    : undefined;
  const agenda = schedules.sort((a, b) => a.at.localeCompare(b.at));
  const editable = canApprove(state.role);
  const openMove = (s: Schedule) => {
    setDetail(null);
    setMoving(s);
  };
  const weekCaption = `${new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" }).format(days[0])} – ${new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" }).format(days[6])}`;
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Redaktionsplanung"
        title="Platz für gute Geschichten"
        description={`Dein Kalender · ${zone}. Jeder Termin bleibt an eine konkrete Inhaltsversion gebunden.`}
        actions={
          <Button asChild>
            <Link to="/plans">
              <Plus size={15} />
              Planvorschläge
            </Link>
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Vorheriger Zeitraum"
            onClick={() =>
              setAnchor((d) =>
                view === "month"
                  ? new Date(d.getFullYear(), d.getMonth() - 1, 1, 12)
                  : addDate(d, -7),
              )
            }
          >
            <ChevronLeft size={15} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Nächster Zeitraum"
            onClick={() =>
              setAnchor((d) =>
                view === "month"
                  ? new Date(d.getFullYear(), d.getMonth() + 1, 1, 12)
                  : addDate(d, 7),
              )
            }
          >
            <ChevronRight size={15} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAnchor(new Date())}
          >
            Heute
          </Button>
          <strong className="ml-1 text-sm">
            {view === "month"
              ? new Intl.DateTimeFormat("de-DE", {
                  month: "long",
                  year: "numeric",
                }).format(anchor)
              : view === "agenda"
                ? "Alle Termine"
                : weekCaption}
          </strong>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="native-select w-auto"
            aria-label="Kalender-Account"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="all">Alle Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.channel} · {a.handle}
              </option>
            ))}
          </select>
          <select
            className="native-select w-auto"
            aria-label="Kalenderstatus"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Alle Status</option>
            <option value="scheduled">Geplant</option>
            <option value="published">Veröffentlicht</option>
            <option value="partial">Teilweise veröffentlicht</option>
            <option value="uncertain">Abgleich erforderlich</option>
            <option value="failed">Fehlgeschlagen</option>
            <option value="cancelled">Storniert</option>
          </select>
          <div className="flex rounded-md border bg-card p-1">
            {[
              ["week", "Woche"],
              ["month", "Monat"],
              ["agenda", "Agenda"],
            ].map(([id, label]) => (
              <Button
                size="sm"
                variant={view === id ? "secondary" : "ghost"}
                key={id}
                onClick={() => setParams({ view: id })}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>
      {view === "agenda" ? (
        <div className="surface">
          {agenda.length ? (
            agenda.map((s) => {
              const d = state.drafts.find((d) => d.id === s.draftId);
              const a = accounts.find((a) => a.id === s.accountId);
              return (
                <button
                  key={s.id}
                  onClick={() => setDetail(s)}
                  className="flex w-full flex-wrap items-center gap-4 border-b p-5 text-left last:border-0 hover:bg-muted/40"
                >
                  <div className="w-36 text-xs muted">
                    {formatDate(s.at, zone)}
                  </div>
                  <AccountIcon channel={a?.channel ?? "X"} />
                  <div className="min-w-0 flex-1">
                    <strong className="block text-sm">{d?.title}</strong>
                    <span className="mt-1 block text-[11px] muted">
                      {a?.handle} · v{s.version} ·{" "}
                      {s.text.length > 1
                        ? `${s.text.length} Beiträge`
                        : "Einzelbeitrag"}
                    </span>
                  </div>
                  <PublishBadge status={s.status} />
                  <ChevronRight size={14} />
                </button>
              );
            })
          ) : (
            <EmptyState
              icon={<CalendarDays size={28} />}
              title="Noch keine passenden Termine"
              description="Plane einen freigegebenen Entwurf oder ändere deine Filter."
              action={
                <Button asChild variant="outline">
                  <Link to="/drafts">Entwürfe ansehen</Link>
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <div className="surface overflow-x-auto">
          <div
            className={view === "month" ? "min-w-[760px]" : "min-w-[1050px]"}
          >
            <div className="grid grid-cols-7 border-b">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label, i) => (
                <div key={label} className="p-3 text-center text-[11px] muted">
                  {label}
                  {view === "week" && (
                    <span
                      className={`mx-auto mt-2 grid size-8 place-items-center rounded-full text-lg font-semibold ${dateKey(days[i].toISOString(), zone) === dateKey(new Date().toISOString(), zone) ? "bg-primary text-primary-foreground" : "text-foreground"}`}
                    >
                      {days[i].getDate()}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = dateKey(day.toISOString(), zone);
                const slots = schedules.filter(
                  (s) => dateKey(s.at, zone) === key,
                );
                const isToday = key === dateKey(new Date().toISOString(), zone);
                return (
                  <div
                    key={key}
                    className={`min-h-36 border-r border-b p-2 last:border-r-0 ${view === "week" ? "min-h-[480px]" : ""} ${day.getMonth() !== anchor.getMonth() && view === "month" ? "bg-secondary/40" : ""} ${isToday ? "bg-primary/[.035]" : ""}`}
                    onDragOver={(e) => {
                      if (editable) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const s = schedules.find((s) => s.id === dragged);
                      if (s?.status === "scheduled") {
                        openMove(s);
                      }
                      setDragged(null);
                    }}
                  >
                    {view === "month" && (
                      <div
                        className={`mb-2 text-right text-xs ${isToday ? "text-primary font-semibold" : "muted"}`}
                      >
                        {day.getDate()}
                      </div>
                    )}
                    {slots.map((s) => {
                      const a = accounts.find((a) => a.id === s.accountId);
                      const d = state.drafts.find((d) => d.id === s.draftId);
                      return (
                        <button
                          key={s.id}
                          draggable={editable && s.status === "scheduled"}
                          onDragStart={() => setDragged(s.id)}
                          onClick={() => setDetail(s)}
                          className="mb-2 block w-full rounded-md border bg-card p-3 text-left hover:border-primary/50"
                        >
                          <div className="mb-2 flex items-center gap-1.5">
                            <AccountIcon
                              channel={a?.channel ?? "X"}
                              size={16}
                            />
                            <span className="text-[10px] muted">
                              {formatDate(s.at, zone, {
                                day: undefined,
                                month: undefined,
                              })}
                            </span>
                          </div>
                          <h3 className="mb-2 text-[11px] leading-snug">
                            {d?.title}
                          </h3>
                          <div className="mb-2">
                            <PublishBadge status={s.status} />
                          </div>
                          <p className="mb-0 text-[9px] muted">
                            v{s.version}
                            {s.text.length > 1
                              ? ` · Thread ${s.publishedCount}/${s.text.length}`
                              : ""}
                          </p>
                        </button>
                      );
                    })}
                    {!slots.length && view === "week" && (
                      <div className="mt-16 text-center text-[10px] muted">
                        Raum für eine Geschichte
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <p className="mt-3 text-[11px] muted">
        Zum Verschieben einen Termin öffnen und „Termin verschieben“ wählen.
        Ziehen öffnet dieselbe explizite Zeitwahl. Veröffentlichte Inhalte
        bleiben unverändert.
      </p>
      <div className="mt-7 flex flex-wrap gap-2">
        <span className="eyebrow mr-2 pt-1">Noch ohne Termin</span>
        {state.drafts
          .filter(
            (d) =>
              d.workspaceId === state.activeWorkspaceId &&
              !state.schedules.some(
                (s) => s.draftId === d.id && s.status === "scheduled",
              ),
          )
          .slice(0, 5)
          .map((d) => (
            <Link
              key={d.id}
              to={`/drafts/${d.id}`}
              className="rounded-md border bg-card px-3 py-2 text-xs hover:border-primary"
            >
              {d.title}
              <ArrowRight size={12} className="ml-2 inline" />
            </Link>
          ))}
      </div>
      <Dialog
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft?.title ?? "Termindetails"}</DialogTitle>
            <DialogDescription>
              Geplanter Snapshot · v{currentDetail?.version} ·{" "}
              {currentDetail ? formatDate(currentDetail.at, zone) : ""} · {zone}
            </DialogDescription>
          </DialogHeader>
          {currentDetail && (
            <>
              <div className="flex items-center justify-between gap-2">
                <PublishBadge status={currentDetail.status} />
                <span className="text-xs muted">
                  {
                    accounts.find((a) => a.id === currentDetail.accountId)
                      ?.handle
                  }
                </span>
              </div>
              {currentDetail.error && (
                <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-xs leading-relaxed text-orange-900 dark:bg-secondary dark:text-foreground">
                  <AlertTriangle size={15} className="mr-2 inline" />
                  {currentDetail.error}
                </div>
              )}
              <div className="max-h-72 space-y-3 overflow-y-auto">
                {currentDetail.text.map((t, i) => (
                  <div key={i} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] muted">Beitrag {i + 1}</span>
                      <Status
                        tone={
                          i < currentDetail.publishedCount ? "green" : "neutral"
                        }
                      >
                        {i < currentDetail.publishedCount
                          ? "Bestätigt veröffentlicht"
                          : currentDetail.status === "uncertain"
                            ? "Ausgang ungeklärt"
                            : "Ausstehend"}
                      </Status>
                    </div>
                    <p className="mb-0 whitespace-pre-wrap text-xs leading-relaxed">
                      {t}
                    </p>
                    {i < currentDetail.publishedCount && (
                      <span className="mt-2 block text-[10px] muted">
                        Externe Demo-ID: demo-{currentDetail.id}-{i + 1}. Kein
                        echter öffentlicher Post.
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <DialogFooter className="flex-wrap gap-2">
                {currentDetail.status === "scheduled" && (
                  <Button
                    variant="outline"
                    disabled={!editable}
                    onClick={() => openMove(currentDetail)}
                  >
                    <Clock size={14} />
                    Termin verschieben
                  </Button>
                )}
                {currentDetail.status === "uncertain" && (
                  <Button
                    disabled={!editable}
                    onClick={() =>
                      mutate(
                        (s) => ({
                          ...s,
                          schedules: s.schedules.map((x) =>
                            x.id === currentDetail.id
                              ? {
                                  ...x,
                                  status:
                                    x.text.length > 1 ? "partial" : "published",
                                  publishedCount: 1,
                                  error: undefined,
                                }
                              : x,
                          ),
                        }),
                        "Mock-Abgleich: erster Beitrag bestätigt. Keine externe Anfrage erfolgt.",
                      )
                    }
                  >
                    <CheckCircle2 size={14} />
                    Demo-Abgleich durchführen
                  </Button>
                )}
                {(currentDetail.status === "partial" ||
                  currentDetail.status === "failed") && (
                  <>
                    <Button
                      disabled={!canResumeSnapshot(state, currentDetail)}
                      onClick={() =>
                        mutate(
                          (s) => resumeSnapshot(s, currentDetail.id),
                          "Nur offene Beiträge des unveränderten Snapshots im Demo-Zustand fortgesetzt.",
                        )
                      }
                    >
                      <ArrowRight size={14} />
                      Offene Beiträge simulieren
                    </Button>
                    {!canResumeSnapshot(state, currentDetail) && snapshot && (
                      <>
                        <Button
                          variant="outline"
                          disabled={
                            !editable ||
                            !draftValid(snapshot, state.accounts, state.media)
                          }
                          onClick={() =>
                            mutate(
                              (s) => approveSnapshot(s, currentDetail.id),
                              "Genau diese Snapshot-Version erneut freigegeben. Arbeitsversion bleibt unverändert.",
                            )
                          }
                        >
                          Snapshot v{currentDetail.version} erneut freigeben
                        </Button>
                        {(["editorial", "brand"] as const)
                          .filter(
                            (stage) =>
                              snapshot.reviewPolicy?.[stage] &&
                              !snapshot.reviews?.some(
                                (r) =>
                                  r.stage === stage &&
                                  r.version === currentDetail.version &&
                                  r.accountId === currentDetail.accountId,
                              ),
                          )
                          .map((stage) => (
                            <Button
                              key={stage}
                              variant="outline"
                              size="sm"
                              disabled={!editable}
                              onClick={() =>
                                mutate(
                                  (s) => ({
                                    ...s,
                                    drafts: s.drafts.map((d) =>
                                      d.id === currentDetail.draftId
                                        ? {
                                            ...d,
                                            reviews: [
                                              ...(d.reviews ?? []),
                                              {
                                                version: currentDetail.version,
                                                accountId:
                                                  currentDetail.accountId,
                                                stage,
                                                by: s.preferences.name,
                                                at: now(),
                                              },
                                            ],
                                          }
                                        : d,
                                    ),
                                  }),
                                  "Snapshot-Review bestätigt. Keine Freigabe erteilt.",
                                )
                              }
                            >
                              {stage === "editorial"
                                ? "Redaktionellen"
                                : "Marken-"}
                              Snapshot-Review bestätigen
                            </Button>
                          ))}
                      </>
                    )}
                  </>
                )}
                {!["published", "cancelled", "uncertain"].includes(
                  currentDetail.status,
                ) && (
                  <Button
                    variant="ghost"
                    disabled={!editable}
                    onClick={() => {
                      mutate(
                        (s) => ({
                          ...s,
                          schedules: s.schedules.map((x) =>
                            x.id === currentDetail.id
                              ? { ...x, status: "cancelled" }
                              : x,
                          ),
                        }),
                        "Weitere Ausführung storniert. Bereits veröffentlichte Beiträge bleiben erhalten.",
                      );
                      setDetail(null);
                    }}
                  >
                    Termin stornieren
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link to={`/drafts/${currentDetail.draftId}`}>
                    Arbeitsversion öffnen
                  </Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {moving && state.drafts.find((d) => d.id === moving.draftId) && (
        <ScheduleDialog
          key={moving.id}
          draft={state.drafts.find((d) => d.id === moving.draftId)!}
          schedule={moving}
          open
          onOpenChange={(o) => {
            if (!o) setMoving(null);
          }}
        />
      )}
    </div>
  );
}
