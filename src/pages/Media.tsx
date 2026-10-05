import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  PageHeader,
  Section,
  Status,
  DemoNote,
  EmptyState,
} from "@/components/shared";
import { useStore, useWorkspaceLocalState } from "@/lib/store";
import {
  canEdit,
  uid,
  editDraft,
  currentVersion,
  type MediaAsset,
} from "@/lib/model";
type UploadJob = {
  file: File;
  url: string;
  progress: number;
  status: "reading" | "uploading" | "failed" | "cancelled";
};
const FILE_LIMIT = 2 * 1024 * 1024;
const TOTAL_LIMIT = 3 * 1024 * 1024;
export function MediaPage() {
  const { state, mutate } = useStore();
  const editable = canEdit(state.role);
  const assets = state.media.filter(
    (m) => m.workspaceId === state.activeWorkspaceId,
  );
  const used = state.media.reduce((sum, m) => sum + m.size, 0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [videoPrep, setVideoPrep] = useWorkspaceLocalState(
    "video-preparation",
    { mediaId: "", subtitle: "", start: 0, end: 8 },
  );
  const videos = assets.filter((a) => a.type === "video");
  const prepVideo = videos.find((a) => a.id === videoPrep.mediaId) ?? videos[0];
  const fileRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);
  const [job, setJob] = useState<UploadJob | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [alt, setAlt] = useState("");
  const [dragging, setDragging] = useState(false);
  const [brief, setBrief] = useWorkspaceLocalState("studio-brief", {
    text: "Eine ruhige Illustration über kleine Produktverbesserungen. Warm, klar und reduziert.",
    platform: "X",
    variant: "Editorial",
    alt: "Abstrakte Linie als Sinnbild für die kontinuierliche Produktentwicklung.",
  });
  const [studio, setStudio] = useState<
    "idle" | "rendering" | "ready" | "failed"
  >("idle");
  const [failDemo, setFailDemo] = useState(false);
  const [studioSaved, setStudioSaved] = useState("");
  useEffect(
    () => () => {
      readerRef.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!job || job.status !== "uploading" || !editable) return;
    const timer = window.setTimeout(() => {
      if (job.progress >= 75) {
        const asset: MediaAsset = {
          id: uid("media"),
          workspaceId: state.activeWorkspaceId,
          name: job.file.name,
          type: job.file.type.startsWith("video/") ? "video" : "image",
          url: job.url,
          alt: "",
          size: job.file.size,
          status: "ready",
          origin: "Lokaler Upload",
        };
        if (
          mutate((s) => {
            if (!canEdit(s.role))
              throw new Error("Viewer können keine Medien hochladen.");
            if (
              s.media.reduce((n, m) => n + m.size, 0) + asset.size >
              TOTAL_LIMIT
            )
              throw new Error("Lokales Medienbudget erreicht.");
            return { ...s, media: [asset, ...s.media] };
          }, "Medium lokal gespeichert")
        )
          setJob(null);
        else setJob((j) => (j ? { ...j, status: "failed" } : null));
      } else setJob((j) => (j ? { ...j, progress: j.progress + 25 } : null));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [job, editable, state.activeWorkspaceId, mutate]);
  useEffect(() => {
    if (studio !== "rendering" || !editable) return;
    const timer = window.setTimeout(
      () => setStudio(failDemo ? "failed" : "ready"),
      1600,
    );
    return () => window.clearTimeout(timer);
  }, [studio, editable, failDemo]);
  function pick(file?: File) {
    if (!editable || !file) return;
    setError("");
    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "video/mp4",
        "video/webm",
      ].includes(file.type)
    ) {
      setError("Bitte JPG, PNG, WebP, GIF, MP4 oder WebM auswählen.");
      return;
    }
    if (file.size > FILE_LIMIT) {
      setError("Diese lokale Demo erlaubt maximal 2 MB pro Datei.");
      return;
    }
    if (used + file.size > TOTAL_LIMIT) {
      setError(
        "Das lokale Medienbudget von 3 MB ist ausgeschöpft. Entferne ungenutzte Uploads.",
      );
      return;
    }
    readerRef.current?.abort();
    const reader = new FileReader();
    readerRef.current = reader;
    setJob({ file, url: "", status: "reading", progress: 0 });
    reader.onload = () =>
      setJob({
        file,
        url: String(reader.result),
        status: "uploading",
        progress: 25,
      });
    reader.onerror = () => {
      setError("Datei konnte nicht gelesen werden. Bitte erneut versuchen.");
      setJob({ file, url: "", status: "failed", progress: 0 });
    };
    reader.readAsDataURL(file);
  }
  const refs = (id: string) => ({
    drafts: state.drafts.filter((d) =>
      d.versions.some((v) => v.mediaIds.includes(id)),
    ).length,
    schedules: state.schedules.filter((s) => s.mediaIds.includes(id)).length,
  });
  function saveAlt() {
    if (!selected || !editable || !alt.trim()) return;
    const asset = selected;
    mutate((s) => {
      if (!canEdit(s.role))
        throw new Error("Deine Rolle darf Inhalte nur ansehen.");
      const linked =
        s.drafts.some((d) =>
          d.versions.some((v) => v.mediaIds.includes(asset.id)),
        ) || s.schedules.some((x) => x.mediaIds.includes(asset.id));
      if (!linked)
        return {
          ...s,
          media: s.media.map((m) =>
            m.id === asset.id ? { ...m, alt: alt.trim() } : m,
          ),
        };
      const cloned = {
        ...asset,
        id: uid("media"),
        alt: alt.trim(),
        name: asset.name.replace(/(\.[^.]+)?$/, " · Alttext-Version$1"),
        origin: `${asset.origin} · Alttext-Version`,
      };
      if (s.media.reduce((n, m) => n + m.size, 0) + cloned.size > TOTAL_LIMIT)
        throw new Error(
          "Die Alttext-Version überschreitet das lokale Medienbudget. Ungenutzte Uploads zuerst entfernen.",
        );
      let next = { ...s, media: [cloned, ...s.media] };
      for (const d of s.drafts.filter((d) =>
        currentVersion(d).mediaIds.includes(asset.id),
      ))
        next = editDraft(
          next,
          d.id,
          {},
          undefined,
          currentVersion(d).mediaIds.map((id) =>
            id === asset.id ? cloned.id : id,
          ),
          "Medien-Alttext geändert",
        );
      return next;
    }, "Alttext gespeichert; betroffene Entwürfe benötigen eine neue Freigabe.");
    setSelected(null);
  }
  function remove(asset: MediaAsset) {
    if (!editable) return;
    mutate((s) => {
      if (!canEdit(s.role))
        throw new Error("Deine Rolle darf Inhalte nur ansehen.");
      if (
        s.drafts.some((d) =>
          d.versions.some((v) => v.mediaIds.includes(asset.id)),
        ) ||
        s.schedules.some((x) => x.mediaIds.includes(asset.id))
      )
        throw new Error(
          "Dieses Medium ist in einer Entwurfs- oder Terminversion referenziert.",
        );
      return { ...s, media: s.media.filter((m) => m.id !== asset.id) };
    }, "Ungenutztes Medium entfernt");
  }
  const template =
    assets.find((a) => a.origin.includes("Demo")) ??
    assets.find((a) => a.type === "image");
  function saveStudio() {
    if (!editable || !template || !brief.alt.trim() || studioSaved) return;
    const id = uid("media");
    if (
      mutate((s) => {
        if (!canEdit(s.role))
          throw new Error("Deine Rolle darf Inhalte nur ansehen.");
        if (
          s.media.reduce((n, m) => n + m.size, 0) + template.size >
          TOTAL_LIMIT
        )
          throw new Error("Das lokale Medienbudget ist ausgeschöpft.");
        return {
          ...s,
          media: [
            {
              ...template,
              id,
              workspaceId: s.activeWorkspaceId,
              name: `studio-${brief.variant.toLowerCase()}-${brief.platform}.svg`,
              alt: brief.alt,
              size: template.size,
              origin: `Studio-Demo · ${brief.platform} · ${brief.variant} · Brief: ${brief.text}`,
            },
            ...s.media,
          ],
        };
      }, "Demo-Variante in der Mediathek gespeichert")
    )
      setStudioSaved(id);
  }
  const visible = assets.filter(
    (a) =>
      (filter === "all" || a.type === filter) &&
      `${a.name} ${a.alt}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Inhalte mit Charakter"
        title="Mediathek"
        description="Deine Bilder, deine Geschichten. An einem Ort."
        actions={
          <Button
            disabled={!editable || job?.status === "uploading"}
            onClick={() => fileRef.current?.click()}
          >
            <Plus size={15} />
            Medien hochladen
          </Button>
        }
      />
      <input
        type="file"
        ref={fileRef}
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
        className="hidden"
        aria-label="Lokale Mediendatei auswählen"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Tabs defaultValue="library">
        <TabsList className="mb-6 flex h-auto max-w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="library">
            Alle Medien <span className="muted ml-2">{assets.length}</span>
          </TabsTrigger>
          <TabsTrigger value="studio">
            <Sparkles size={13} />
            Studio
          </TabsTrigger>
          <TabsTrigger value="video">Video vorbereiten</TabsTrigger>
        </TabsList>
        <TabsContent value="library">
          <div className="flex flex-wrap gap-3 mb-5">
            <Input
              aria-label="Medien durchsuchen"
              placeholder="Dateiname oder Alttext suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <select
              aria-label="Medientyp filtern"
              className="native-select max-w-40"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Alle Typen</option>
              <option value="image">Bilder</option>
              <option value="video">Videos</option>
            </select>
            <span className="muted text-xs self-center ml-auto">
              {(used / 1024 / 1024).toFixed(2)} / 3 MB lokal belegt
            </span>
          </div>
          <div
            className={`border border-dashed rounded-lg p-5 mb-5 flex flex-wrap items-center justify-between gap-4 ${dragging ? "bg-secondary border-primary" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (editable) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files.length > 1) {
                setError("Bitte jeweils eine Datei hochladen.");
                return;
              }
              pick(e.dataTransfer.files[0]);
            }}
          >
            <div className="flex gap-3 items-center">
              <Upload size={19} className="muted" />
              <div>
                <p className="text-sm font-semibold mb-1">
                  Hier ablegen. Oder einfach auswählen.
                </p>
                <p className="muted text-xs mb-0">
                  Bilder und Videos · max. 2 MB pro Datei · lokal gespeichert
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              disabled={!editable || job?.status === "uploading"}
              onClick={() => fileRef.current?.click()}
            >
              Datei auswählen
            </Button>
          </div>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          {job && (
            <div className="surface p-4 mb-5">
              <div className="flex justify-between gap-3">
                <span className="text-sm font-semibold">{job.file.name}</span>
                <Status tone={job.status === "failed" ? "red" : "orange"}>
                  {
                    {
                      reading: "Datei lesen",
                      uploading: "Lokal speichern",
                      failed: "Fehlgeschlagen",
                      cancelled: "Abgebrochen",
                    }[job.status]
                  }
                </Status>
              </div>
              <Progress
                value={job.progress}
                className="my-3"
                aria-label="Upload-Fortschritt"
              />
              <div className="flex gap-2">
                {["failed", "cancelled"].includes(job.status) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!editable}
                    onClick={() => pick(job.file)}
                  >
                    Erneut versuchen
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!editable}
                    onClick={() => {
                      readerRef.current?.abort();
                      setJob((j) =>
                        j ? { ...j, status: "cancelled", url: "" } : null,
                      );
                    }}
                  >
                    <X size={12} />
                    Abbrechen
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((asset) => {
              const reference = refs(asset.id);
              return (
                <article key={asset.id} className="surface overflow-hidden">
                  <div className="aspect-[8/5] bg-secondary relative">
                    {asset.type === "image" ? (
                      <img
                        src={asset.url}
                        alt={asset.alt || "Medium ohne Alttext"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={asset.url}
                        controls
                        preload="metadata"
                        className="w-full h-full object-contain"
                        aria-label={asset.alt || asset.name}
                      />
                    )}
                    <span className="absolute top-3 left-3">
                      <Status>
                        {asset.type === "video" ? "Video" : "Bild"}
                      </Status>
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm truncate mb-1">{asset.name}</h3>
                    <p className="text-[11px] muted mb-3 truncate">
                      {asset.origin} · {(asset.size / 1024).toFixed(1)} KB
                    </p>
                    <p
                      className={`text-xs leading-relaxed min-h-9 mb-3 ${asset.alt ? "muted" : "text-primary"}`}
                    >
                      {asset.alt ||
                        "Alttext fehlt. Vor Verwendung bitte ergänzen."}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!editable}
                        onClick={() => {
                          setSelected(asset);
                          setAlt(asset.alt);
                        }}
                      >
                        Alttext bearbeiten
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={
                          !editable ||
                          reference.drafts + reference.schedules > 0
                        }
                        onClick={() => remove(asset)}
                      >
                        Entfernen
                      </Button>
                    </div>
                    {reference.drafts + reference.schedules > 0 && (
                      <p className="text-[11px] muted mt-3 mb-0">
                        Referenziert in {reference.drafts} Entwürfen und{" "}
                        {reference.schedules} Terminen. Version bleibt erhalten.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!visible.length && (
            <EmptyState
              icon={<ImagePlus />}
              title="Platz für deine nächste Geschichte"
              description="Lade ein Bild hoch oder passe den Suchfilter an."
            />
          )}
        </TabsContent>
        <TabsContent value="studio">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Section
              title="Von der Idee zum Motiv"
              description="Demo-Studio mit bestehenden Illustrationen. Es werden keine KI-Bilder erzeugt."
            >
              <fieldset
                disabled={!editable || studio === "rendering"}
                className="space-y-5"
              >
                <label className="block">
                  <span className="field-label">Dein Brief</span>
                  <Textarea
                    aria-label="Dein Brief"
                    rows={5}
                    value={brief.text}
                    onChange={(e) => {
                      setBrief((b) => ({ ...b, text: e.target.value }));
                      setStudioSaved("");
                      setStudio("idle");
                    }}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    <span className="field-label">Plattform</span>
                    <select
                      aria-label="Plattform"
                      className="native-select"
                      value={brief.platform}
                      onChange={(e) =>
                        setBrief((b) => ({ ...b, platform: e.target.value }))
                      }
                    >
                      <option>X</option>
                      <option>LinkedIn</option>
                      <option>Bluesky</option>
                      <option>Mastodon</option>
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Variante</span>
                    <select
                      aria-label="Variante"
                      className="native-select"
                      value={brief.variant}
                      onChange={(e) =>
                        setBrief((b) => ({ ...b, variant: e.target.value }))
                      }
                    >
                      <option>Editorial</option>
                      <option>Minimal</option>
                      <option>Cover</option>
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="field-label">Alttext</span>
                  <Textarea
                    aria-label="Alttext"
                    value={brief.alt}
                    onChange={(e) =>
                      setBrief((b) => ({ ...b, alt: e.target.value }))
                    }
                  />
                </label>
              </fieldset>
              <div className="border-t pt-4 mt-5 flex justify-between items-center">
                <span className="text-xs muted">
                  Geschätzte Demo-Kosten: 0,12 €
                </span>
                <Button
                  disabled={
                    !editable ||
                    !brief.text.trim() ||
                    studio === "rendering" ||
                    !template
                  }
                  onClick={() => {
                    setStudioSaved("");
                    setStudio("rendering");
                  }}
                >
                  <Sparkles size={14} />
                  {studio === "rendering"
                    ? "Wird vorbereitet…"
                    : "Demo-Variante erstellen"}
                </Button>
              </div>
              <label className="text-xs muted flex gap-2 mt-4">
                <input
                  type="checkbox"
                  checked={failDemo}
                  disabled={!editable}
                  onChange={(e) => setFailDemo(e.target.checked)}
                />
                Fehler bei Demo-Erstellung simulieren
              </label>
            </Section>
            <Section
              title="Deine Vorschau"
              actions={
                <Status>
                  {brief.platform} · {brief.variant}
                </Status>
              }
            >
              {studio === "ready" && template ? (
                <>
                  <img
                    src={template.url}
                    alt={brief.alt || "Studio-Demo"}
                    className="w-full rounded-md aspect-[8/5] object-cover"
                  />
                  <p className="muted text-xs mt-4">
                    Herkunft: bestehende lokale Demo-Illustration. Brief und
                    Variante werden als Metadaten gespeichert.
                  </p>
                  <Button
                    disabled={!editable || !brief.alt.trim() || !!studioSaved}
                    onClick={saveStudio}
                  >
                    {studioSaved
                      ? "In Mediathek gespeichert"
                      : "In Mediathek speichern"}
                  </Button>
                </>
              ) : studio === "failed" ? (
                <EmptyState
                  title="Demo-Erstellung unterbrochen"
                  description="Dein Brief ist gespeichert. Deaktiviere die Fehlersimulation und versuche es erneut."
                  action={
                    <Button
                      variant="outline"
                      disabled={!editable}
                      onClick={() => {
                        setFailDemo(false);
                        setStudio("rendering");
                      }}
                    >
                      Erneut versuchen
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<Sparkles size={28} />}
                  title={
                    studio === "rendering"
                      ? "Dein Motiv wird vorbereitet"
                      : "Gib deinem Gedanken ein Bild"
                  }
                  description={
                    studio === "rendering"
                      ? "Lokale Demo-Verarbeitung. Du kannst jederzeit abbrechen."
                      : "Ein klarer Brief ist der Anfang. Beschreibe Motiv, Stimmung und Perspektive."
                  }
                  action={
                    studio === "rendering" ? (
                      <Button
                        variant="outline"
                        disabled={!editable}
                        onClick={() => setStudio("idle")}
                      >
                        Abbrechen
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </Section>
          </div>
        </TabsContent>
        <TabsContent value="video">
          <div className="grid gap-6 lg:grid-cols-2">
            <Section
              title="Untertitel & Clip-Ausschnitt"
              description="Lokale Vorbereitung für bereits hochgeladene Videos. Keine Transkription oder automatische Clip-Erstellung."
            >
              {prepVideo ? (
                <>
                  <fieldset disabled={!editable} className="space-y-4">
                    <label className="block">
                      <span className="field-label">Ausgangsvideo</span>
                      <select
                        className="native-select"
                        aria-label="Ausgangsvideo"
                        value={prepVideo.id}
                        onChange={(e) => {
                          setVideoPrep({
                            mediaId: e.target.value,
                            subtitle: "",
                            start: 0,
                            end: 8,
                          });
                          setDuration(0);
                        }}
                      >
                        {videos.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="field-label">Untertiteltext</span>
                      <Textarea
                        aria-label="Untertiteltext"
                        rows={4}
                        value={videoPrep.subtitle}
                        onChange={(e) =>
                          setVideoPrep((p) => ({
                            ...p,
                            subtitle: e.target.value,
                          }))
                        }
                        placeholder="Trage den tatsächlich gesprochenen Text ein…"
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        <span className="field-label">
                          Clip-Start (Sekunden)
                        </span>
                        <Input
                          type="number"
                          min="0"
                          max={duration || undefined}
                          step="0.1"
                          value={videoPrep.start}
                          onChange={(e) =>
                            setVideoPrep((p) => ({
                              ...p,
                              start: Math.max(0, Number(e.target.value)),
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span className="field-label">
                          Clip-Ende (Sekunden)
                        </span>
                        <Input
                          type="number"
                          min="0"
                          max={duration || undefined}
                          step="0.1"
                          value={videoPrep.end}
                          onChange={(e) =>
                            setVideoPrep((p) => ({
                              ...p,
                              end: Math.max(0, Number(e.target.value)),
                            }))
                          }
                        />
                      </label>
                    </div>
                  </fieldset>
                  <p className="muted text-xs mt-4">
                    {duration
                      ? `${duration.toFixed(1)} Sekunden Gesamtlänge`
                      : "Metadaten werden beim Laden des lokalen Videos geprüft."}{" "}
                    · Es wird kein neuer Clip gerendert.
                  </p>
                  {(videoPrep.end <= videoPrep.start ||
                    (duration > 0 && videoPrep.end > duration)) && (
                    <p className="text-xs text-destructive" role="alert">
                      Start und Ende müssen innerhalb des Videos liegen; Ende
                      muss nach Start liegen.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={!editable || !!videoPrep.subtitle}
                      onClick={() =>
                        setVideoPrep((p) => ({
                          ...p,
                          subtitle:
                            "[Demo-Beispiel, nicht transkribiert] Kleine Entscheidungen machen ein Produkt besser.",
                        }))
                      }
                    >
                      Demo-Untertitel einsetzen
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        !editable ||
                        !videoPrep.subtitle.trim() ||
                        videoPrep.end <= videoPrep.start
                      }
                      onClick={() => {
                        const stamp = (n: number) => {
                          const ms = Math.round(n * 1000);
                          return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
                        };
                        const url = URL.createObjectURL(
                          new Blob(
                            [
                              `1\n${stamp(videoPrep.start)} --> ${stamp(videoPrep.end)}\n${videoPrep.subtitle}\n`,
                            ],
                            { type: "text/plain" },
                          ),
                        );
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "dispatch-untertitel.srt";
                        a.click();
                        window.setTimeout(() => URL.revokeObjectURL(url), 500);
                      }}
                    >
                      Untertitel als SRT speichern
                    </Button>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={<Upload />}
                  title="Dein Video ist der Ausgangspunkt"
                  description="Lade zuerst eine MP4- oder WebM-Datei bis 2 MB in der Mediathek hoch."
                  action={
                    <Button
                      variant="outline"
                      disabled={!editable}
                      onClick={() => fileRef.current?.click()}
                    >
                      Video auswählen
                    </Button>
                  }
                />
              )}
            </Section>
            <Section
              title="Clip-Vorschau"
              description="Spielt den gewählten Ausschnitt der Originaldatei lokal ab."
            >
              {prepVideo ? (
                <>
                  <video
                    ref={videoRef}
                    key={prepVideo.id}
                    src={prepVideo.url}
                    controls
                    preload="metadata"
                    className="w-full rounded-md bg-secondary aspect-video"
                    aria-label={`Clip-Vorschau: ${prepVideo.name}`}
                    onLoadedMetadata={(e) => {
                      const d = e.currentTarget.duration;
                      if (Number.isFinite(d)) setDuration(d);
                    }}
                    onTimeUpdate={(e) => {
                      if (e.currentTarget.currentTime >= videoPrep.end)
                        e.currentTarget.pause();
                    }}
                  />
                  <p className="text-sm text-center border rounded-md p-3 mt-3">
                    {videoPrep.subtitle ||
                      "Noch kein Untertiteltext hinterlegt."}
                  </p>
                  <Button
                    variant="outline"
                    disabled={
                      videoPrep.end <= videoPrep.start ||
                      !duration ||
                      videoPrep.start >= duration ||
                      videoPrep.end > duration
                    }
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = videoPrep.start;
                        void videoRef.current
                          .play()
                          .catch(() =>
                            setError(
                              "Die lokale Videodatei konnte nicht abgespielt werden.",
                            ),
                          );
                      }
                    }}
                  >
                    Ausschnitt ab Start ansehen
                  </Button>
                  <div className="mt-4">
                    <DemoNote>
                      Untertitel sind separat bearbeiteter Text. Vorschau und
                      SRT-Datei ersetzen keine Prüfung von Timing,
                      Rechtschreibung und Bildrechten.
                    </DemoNote>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="Noch keine Vorschau"
                  description="Wähle ein lokales Video, um den Ausschnitt zu prüfen."
                />
              )}
            </Section>
          </div>
        </TabsContent>
      </Tabs>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ein Bild verständlich machen</DialogTitle>
            <DialogDescription>
              Beschreibe den relevanten Bildinhalt. Referenzierte Medien
              erhalten eine neue Version; bestehende Termine behalten ihr
              Original.
            </DialogDescription>
          </DialogHeader>
          <label>
            <span className="field-label">Alternativtext</span>
            <Textarea
              aria-label="Alternativtext"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              disabled={!editable}
            />
          </label>
          <Button disabled={!editable || !alt.trim()} onClick={saveAlt}>
            Alttext speichern
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
