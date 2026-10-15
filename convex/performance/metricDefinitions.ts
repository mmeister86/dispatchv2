import type { Doc } from "../_generated/dataModel";
// Post counts can be summed only for the same authorized window/dialect/definition.
// Media/video aggregates and unique people are not inferred from post counts.
export function aggregate(
  rows: Doc<"performanceSnapshots">[],
  total: number | null,
) {
  const first = rows.find(
    (r) =>
      r.state === "observed" &&
      r.definitionVersion &&
      r.dialect &&
      !(r.late ?? (r.observedAt !== null && r.observedAt > r.dueAt + 60000)),
  );
  if (!first)
    return {
      covered: 0,
      total,
      fields: [] as {
        name: string;
        value: number;
        covered: number;
        definition: string;
      }[],
    };
  const compatible = rows.filter(
    (r) =>
      r.state === "observed" &&
      !(r.late ?? (r.observedAt !== null && r.observedAt > r.dueAt + 60000)) &&
      r.windowHours === first.windowHours &&
      r.definitionVersion === first.definitionVersion &&
      r.dialect === first.dialect,
  );
  const fields = first.fields
    .map((f) => {
      const known = compatible
        .map((r) =>
          r.fields.find(
            (x) =>
              x.name === f.name &&
              x.rawField === f.rawField &&
              x.definition === f.definition &&
              x.status === "measured" &&
              x.value !== null,
          ),
        )
        .filter((x) => x !== undefined);
      const value = known.reduce((sum, x) => sum + x.value!, 0);
      return {
        name: f.name,
        value,
        covered: known.length,
        definition: f.definition,
      };
    })
    .filter((f) => f.covered > 0 && Number.isSafeInteger(f.value));
  return { covered: compatible.length, total, fields };
}
