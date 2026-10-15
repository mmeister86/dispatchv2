// Local evaluation projection only: no callable backend or persisted report service.
export type EvaluationProbe = {
  caseId: string;
  probeId: string;
  checks: { measure: string; passed: boolean; detail: string }[];
  physicalInvocations: number;
  attempts: {
    state: string;
    heldMicros: number;
    estimatedMicros: number | null;
  }[];
};
export function evaluationReport(probes: EvaluationProbe[]) {
  const checks = probes.flatMap((p) => p.checks);
  const estimates = probes
    .flatMap((p) => p.attempts)
    .filter((a) => a.estimatedMicros !== null);
  const measures = [...new Set(checks.map((c) => c.measure))].map((measure) => {
    const eligible = checks.filter((c) => c.measure === measure);
    return {
      measure,
      passed: eligible.filter((c) => c.passed).length,
      denominator: eligible.length,
    };
  });
  return {
    version: "research-evaluation/v1",
    executedCases: new Set(probes.map((p) => p.caseId)).size,
    executedProbes: probes.length,
    executedTechnicalChecks: checks.length,
    failedTechnicalChecks: checks.filter((c) => !c.passed).length,
    regressionCheckPassRate: checks.length
      ? checks.filter((c) => c.passed).length / checks.length
      : null,
    measuresScope:
      "Technical regression assertions only; excludes controlled semantic findings and live quality",
    measures,
    physicalInvocations: probes.reduce((n, p) => n + p.physicalInvocations, 0),
    externalRequests: 0,
    costProvenance:
      "synthetic fixture; intercepted HTTP; simulated token/cost receipts and configured estimates",
    configuredEstimateMicros: estimates.length
      ? estimates.reduce((n, a) => n + a.estimatedMicros!, 0)
      : null,
    unknownEstimateAttempts: probes
      .flatMap((p) => p.attempts)
      .filter((a) => a.estimatedMicros === null).length,
    heldMicros: probes
      .flatMap((p) => p.attempts)
      .reduce((n, a) => n + a.heldMicros, 0),
    unresolvedAttempts: probes
      .flatMap((p) => p.attempts)
      .filter((a) => a.state !== "settled").length,
    providerBilledMicros: null,
    probes,
  };
}
