import { useEffect, useState, useRef } from "react";
import { useAction, useMutation, usePaginatedQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { canEdit, type MediaAsset } from "@/lib/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Section, EmptyState } from "@/components/shared";
import { MediaUploader } from "./media-uploader";
import { MediaPreview, mediaError } from "./media-preview";
export const mediaConfigurationGuidance =
  "In Convex müssen R2_MEDIA_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CLOUDFLARE_ACCOUNT_ID und R2_MEDIA_EU_CONFIRMED=true für einen bestätigten privaten EU-Bucket gesetzt sein. Danach Browser-CORS für diese App aktivieren.";
export function MediaLibrary() {
  const { state } = useStore();
  const workspaceId = state.activeWorkspaceId as Id<"workspaces">;
  const status = useAction(api.media.r2.status),
    finish = useAction(api.media.r2.finish),
    remove = useMutation(api.media.uploads.remove),
    setDefaultAlt = useMutation(api.media.assets.setAlt);
  const [configured, setConfigured] = useState<boolean | null>(null),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<MediaAsset | null>(null),
    [alt, setAlt] = useState(""),
    [busy, setBusy] = useState("");
  const editable = canEdit(state.role);
  const inventory = usePaginatedQuery(
    api.media.assets.list,
    { workspaceId },
    { initialNumItems: 50 },
  );
  const assets: MediaAsset[] = inventory.results
    .filter((a) => a.state !== "deleted")
    .map((a) => ({
      id: a._id,
      workspaceId: a.workspaceId,
      name: a.name,
      type: a.type,
      url: "",
      alt: a.defaultAlt ?? "",
      size: a.size,
      status: a.state,
      uploadSessionId: a.uploadSessionId,
      mime: a.mime,
      origin: "R2",
    }));
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void status({ workspaceId })
      .then((s) => {
        if (active) setConfigured(s.configured);
      })
      .catch((e) => {
        if (active) setError(mediaError(e));
      });
    return () => {
      active = false;
    };
  }, [workspaceId, status]);
  async function command(
    id: string,
    fn: () => Promise<unknown>,
    message: string,
  ) {
    setBusy(id);
    setError("");
    try {
      await fn();
      if (!mounted.current) return false;
      toast.success(message);
      return true;
    } catch (e) {
      if (mounted.current) setError(mediaError(e));
      return false;
    } finally {
      if (mounted.current) setBusy("");
    }
  }
  return (
    <div className="page">
      <PageHeader
        eyebrow="Inhalte"
        title="Medienbibliothek"
        description="Private Dateien, geprüfte Inhalte und Alternativtexte für deinen Workspace."
      />
      {configured === false && (
        <Section
          title="EU-R2 einrichten"
          description="Uploads und private Vorschauen benötigen eine bestätigte EU-Speicherbindung."
        >
          <p className="text-sm">{mediaConfigurationGuidance}</p>
          <p className="muted text-xs">
            Ein Location-Hint wie weur genügt nicht. Die Integration verwendet
            ausschließlich den EU-Jurisdiktionsendpunkt; es gibt keine
            automatische Ausweichregion.
          </p>
          <Button
            variant="outline"
            onClick={() =>
              void status({ workspaceId })
                .then((s) => setConfigured(s.configured))
                .catch((e) => setError(mediaError(e)))
            }
          >
            Konfiguration erneut prüfen
          </Button>
        </Section>
      )}
      <Section
        title="Datei hochladen"
        description="Ein neues Medium verändert keine bestehenden Inhaltsversionen oder Termine."
      >
        <MediaUploader
          key={workspaceId}
          workspaceId={workspaceId}
          disabled={!editable || configured !== true}
        />
      </Section>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Section
        title="Mediathek"
        description="Alt-Text in der Mediathek ist ein Standardwert für neue Referenzen. Bestehende Versionen behalten ihren ursprünglichen Alt-Text."
      >
        <Input
          aria-label="Medien suchen"
          placeholder="Medien suchen …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="grid gap-4 mt-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets
            .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
            .map((a) => (
              <article key={a.id} className="surface p-3">
                <MediaPreview
                  asset={a}
                  className="w-full h-40 object-cover rounded"
                />
                <p className="text-sm font-medium mt-3">{a.name}</p>
                <p className="muted text-xs">
                  {(a.size / 1024 / 1024).toFixed(2)} MiB · {a.status}
                </p>
                <p className="text-xs">{a.alt || "Alttext fehlt"}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!editable || a.status !== "ready" || !!busy}
                    onClick={() => {
                      setSelected(a);
                      setAlt(a.alt);
                    }}
                  >
                    Alttext bearbeiten
                  </Button>
                  {(a.status === "validating" || a.status === "uploading") &&
                    a.uploadSessionId && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!editable || !!busy}
                        onClick={() =>
                          void command(
                            a.id,
                            () =>
                              finish({
                                workspaceId,
                                sessionId:
                                  a.uploadSessionId as Id<"mediaUploadSessions">,
                              }),
                            "Finalisierung geprüft.",
                          )
                        }
                      >
                        Finalisierung prüfen
                      </Button>
                    )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!editable || a.status === "deleting" || !!busy}
                    onClick={() =>
                      void command(
                        a.id,
                        () =>
                          remove({
                            workspaceId,
                            assetId: a.id as Id<"mediaAssets">,
                          }),
                        "Löschung vorgemerkt; temporäre Berechtigungen laufen zuerst ab.",
                      )
                    }
                  >
                    {a.status === "deleting" ? "Löschung läuft …" : "Löschen"}
                  </Button>
                </div>
              </article>
            ))}
        </div>
        {inventory.status === "CanLoadMore" && (
          <Button variant="outline" onClick={() => inventory.loadMore(50)}>
            Weitere Medien laden
          </Button>
        )}
        {!assets.length && (
          <EmptyState
            title="Noch keine Medien"
            description="Lade eine Datei mit Alternativtext hoch. Sie wird erst nach der Inhaltsprüfung verfügbar."
          />
        )}
      </Section>
      {selected && (
        <Section title="Alternativtext bearbeiten">
          <Textarea
            aria-label="Alternativtext"
            value={alt}
            maxLength={1000}
            onChange={(e) => setAlt(e.target.value)}
            disabled={!!busy}
          />
          <div className="flex gap-2 mt-3">
            <Button
              disabled={!editable || !!busy || !alt.trim()}
              onClick={() =>
                void command(
                  selected.id,
                  () =>
                    setDefaultAlt({
                      workspaceId,
                      assetId: selected.id as Id<"mediaAssets">,
                      alt,
                    }),
                  "Mediathek-Alttext gespeichert.",
                ).then((ok) => {
                  if (ok) setSelected(null);
                })
              }
            >
              Alttext speichern
            </Button>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Abbrechen
            </Button>
          </div>
        </Section>
      )}
      <Section
        title="Studio & Videobearbeitung"
        description="Generierung, Transkription und Clip-Rendering sind noch nicht aktiviert. Bestehende Dateien werden hier unverändert gespeichert."
      >
        <p className="muted text-sm">
          Für eine bearbeitete Datei ein neues Medium hochladen und ausdrücklich
          eine neue Inhaltsversion speichern.
        </p>
      </Section>
    </div>
  );
}
