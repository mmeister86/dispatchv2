import type { Infer } from "convex/values";
import { baselineView } from "../../../convex/performance/baselines";
import { Section, EmptyState, Status } from "@/components/shared";
const number = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
export function Baselines({
  data,
  clock,
}: {
  data: Infer<typeof baselineView> | undefined;
  clock: number;
}) {
  const cohorts = data?.cohorts.filter((c) => c.until > clock) ?? [];
  return (
    <Section
      title="Eigene Account-Baselines"
      description="Arithmetische Mittel vergleichbarer eigener Veröffentlichungseinheiten. Keine Erfolgsprognose, Qualitätsrangliste oder kausale Empfehlung."
    >
      <p className="text-sm muted">
        Teilmenge: neueste 20 bestätigte Post-Versuche (
        {data?.coverage.nativeAttemptCount ?? 0} im gefilterten Sample,{" "}
        {data?.coverage.postsWithoutSnapshots ?? 0} ohne autorisierte
        Beobachtungen), keine vollständige Account-Historie. Importierte
        Beiträge ohne gemessene Kennzahlen sind kein Referenzsample.
        Accountgröße und Followerwachstum: unbekannt; Postattribution ist nicht
        belegt.
      </p>
      <p className="text-xs muted my-3">
        Regel own-baseline-v1: exakt gleiches Konto, Netzwerk X, Format/Medien,
        Definition, Feldumfang und nominales Fenster; tatsächliches Alter ab
        Provider-Zeit ±60 Sekunden. Toleranz und Warnung bei n&lt;10 sind
        unvalidierte technische Startregeln. Ein fehlender Tag ist eine Lücke;
        Tageswerte sind gemessene Ereignissummen in UTC.
      </p>
      {!cohorts.length ? (
        <EmptyState
          title="Keine vergleichbare Messgrundlage"
          description="Benötigt autorisierte Messwerte mit bekannter Provider-Publikationszeit im gewählten Fenster. Fehlende Werte werden nicht als 0 eingesetzt."
        />
      ) : (
        cohorts.map((c) => {
          const max = Math.max(1, ...c.chart.map((p) => p.value ?? 0));
          return (
            <article key={c.key} className="border-t pt-4 mt-4 space-y-3">
              <div className="flex flex-wrap gap-3 items-center">
                <h3>
                  {c.unit === "thread" ? "Ganze Threads" : "Einzelbeiträge"} ·
                  Medien {c.media} ·{" "}
                  {c.windowHours === 0.25 ? "15 Minuten" : `${c.windowHours} h`}
                </h3>
                <Status tone={c.small ? "orange" : "neutral"}>
                  n={c.n} geeignete Einheiten
                </Status>
              </div>
              <p className="text-xs muted">
                {c.attempted} sichtbare Einheiten, {c.ineligible} ohne geeignete
                Impressionen. Publiziert{" "}
                {c.from === null
                  ? "unbekannt"
                  : new Date(c.from).toLocaleString("de-DE")}{" "}
                bis{" "}
                {c.to === null
                  ? "unbekannt"
                  : new Date(c.to).toLocaleString("de-DE")}{" "}
                · Definition {c.definitionVersion ?? "unbekannt"} ·{" "}
                {c.dialect ?? "unbekannt"}.
              </p>
              {c.small && (
                <p role="status" className="text-sm">
                  Kleine eigene Referenzgruppe: n&lt;10. Diese Anzeigewarnung
                  belegt keine statistische Eignung; Vergleich je Beitrag
                  schließt dessen ganzen Post/Thread aus.
                </p>
              )}
              {c.chart.length > 0 && (
                <figure>
                  <svg
                    viewBox="0 0 640 130"
                    role="img"
                    aria-label="Gemessene tägliche Impressionen; fehlende Tage bleiben Lücken"
                    className="w-full max-h-40"
                  >
                    {c.chart.map((p, i) => {
                      const x =
                          20 + (i / Math.max(1, c.chart.length - 1)) * 600,
                        y = 110 - ((p.value ?? 0) / max) * 90,
                        previous = c.chart[i - 1];
                      return (
                        <g key={p.day}>
                          {p.value !== null && (
                            <>
                              <circle cx={x} cy={y} r="4" fill="currentColor" />
                              <title>
                                {p.day}: {number(p.value)} · n={p.n} · fehlend{" "}
                                {p.missing}
                              </title>
                              {previous?.value != null && (
                                <line
                                  x1={
                                    20 +
                                    ((i - 1) /
                                      Math.max(1, c.chart.length - 1)) *
                                      600
                                  }
                                  y1={110 - (previous.value / max) * 90}
                                  x2={x}
                                  y2={y}
                                  stroke="currentColor"
                                  strokeWidth="2"
                                />
                              )}
                            </>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                  <figcaption className="text-xs muted">
                    {c.chart[0].day} — {c.chart.at(-1)?.day} · Summe geeigneter
                    Impressionen; n und fehlend je Tag:
                  </figcaption>
                  <details className="text-xs">
                    <summary>Tageswerte und Lücken</summary>
                    {c.chart.map((p) => (
                      <p key={p.day}>
                        {p.day}: {number(p.value)} · n={p.n} · fehlend{" "}
                        {p.missing}
                      </p>
                    ))}
                  </details>
                </figure>
              )}
              <div className="overflow-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="text-left muted text-xs">
                    Nur gemessene Werte; Anzahl je Metrik kann abweichen.
                  </caption>
                  <thead>
                    <tr>
                      <th className="text-left">Metrik</th>
                      <th>n</th>
                      <th>Summe</th>
                      <th>Mittel</th>
                      <th>Fehlend / ausgeschlossen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.metrics.map((m) => (
                      <tr key={m.name}>
                        <th
                          className="text-left font-normal py-2"
                          title={`${m.rawField} · ${m.definition}`}
                        >
                          {m.name}
                          <span className="block text-[10px] muted">
                            {m.definition} · {m.rawField}
                          </span>
                        </th>
                        <td>{m.n}</td>
                        <td>{number(m.sum)}</td>
                        <td>{number(m.mean)}</td>
                        <td className="text-xs">
                          {m.missing
                            .map((x) => `${x.reason}: ${x.n}`)
                            .join(" · ") || "keine"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="overflow-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="text-left muted text-xs">
                    Ereignisraten: Summe exakt gemeinsam gemessener Zähler /
                    Impressionen; keine eindeutigen Personen oder
                    Wahrscheinlichkeiten.
                  </caption>
                  <thead>
                    <tr>
                      <th className="text-left">Rate / Zähler</th>
                      <th>n</th>
                      <th>Zähler</th>
                      <th>Nenner</th>
                      <th>Rate</th>
                      <th>Fehlend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.rates.map((r) => (
                      <tr key={r.name}>
                        <th className="text-left py-2 font-normal">
                          {r.name}
                          <span className="block text-[10px]">
                            {r.components.join(" + ")}
                          </span>
                        </th>
                        <td>{r.n}</td>
                        <td>{number(r.numerator)}</td>
                        <td>{number(r.denominator)}</td>
                        <td>
                          {r.value === null
                            ? "—"
                            : `${number(r.value * 100)} %`}
                        </td>
                        <td className="text-xs">
                          {r.missing
                            .map((x) => `${x.reason}: ${x.n}`)
                            .join(" · ") || "keine"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="overflow-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="text-left muted text-xs">
                    Themen und Publikationsstunden innerhalb dieser Kohorte;
                    unbekannte Angaben bleiben separat. Keine Empfehlung einer
                    besten Zeit oder eines erfolgreichen Themas.
                  </caption>
                  <thead>
                    <tr>
                      <th className="text-left">
                        Dimension / veröffentlichte Angabe
                      </th>
                      <th>n</th>
                      <th>Fehlend</th>
                      <th>Mittel Impressionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.segments.map((g, i) => (
                      <tr key={i}>
                        <th className="text-left py-2 font-normal">
                          {g.dimension === "topic"
                            ? "Thema"
                            : "Publikationsstunde"}
                          : {g.label ?? "unbekannt / nicht verfügbar"}
                        </th>
                        <td>
                          {g.n}
                          {g.n < 10 ? " (klein)" : ""}
                        </td>
                        <td>
                          {g.missing} von {g.attempted}
                        </td>
                        <td>
                          {number(g.mean)}
                          {g.reason ? ` · ${g.reason}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {c.units.map((u) => (
                  <div className="surface p-3 text-sm" key={u.id}>
                    <p>
                      {c.unit === "thread" ? "Thread" : "Post"}{" "}
                      {u.externalIds.join(", ")} · {u.covered}/{u.total ?? "?"}{" "}
                      Positionen beobachtet
                    </p>
                    <p>
                      Gemessene Impressionen: {number(u.impressions)} · Eigene
                      Referenz ohne diesen Post/Thread: {number(u.baseline)} (n=
                      {u.peerN}) · Verhältnis:{" "}
                      {u.ratio === null ? "—" : `${number(u.ratio)}×`}.
                    </p>
                    <p className="text-xs muted">
                      {u.peerN < 10 ? "Kleine Referenzgruppe. " : ""}
                      {u.reason ?? "Alter kompatibel"} · tatsächliche
                      Alterswerte{" "}
                      {u.observedAgesMs
                        .map(
                          (x) =>
                            `${x.externalId}: ${x.ageMs === null ? "unbekannt" : `${number(x.ageMs / 3600000)} h`}`,
                        )
                        .join(" · ")}
                    </p>
                    <p className="text-xs">
                      Thema aus veröffentlichter Version:{" "}
                      {u.topic ?? "unbekannt / Quelle nicht verfügbar"} ·{" "}
                      {u.publicationHour ?? "Publikationszeit unbekannt"} (
                      {u.timezone ?? "Zeitzone unbekannt"}) · Version{" "}
                      {u.versionIds.join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          );
        })
      )}
    </Section>
  );
}
