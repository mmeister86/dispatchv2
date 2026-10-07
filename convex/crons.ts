import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval(
  "media expiry cleanup",
  { minutes: 15 },
  internal.media.cleanup.sweep,
  {},
);
crons.interval(
  "X secret expiry cleanup",
  { minutes: 15 },
  internal.integrations.x.oauth.cleanup,
  {},
);
crons.interval(
  "GitHub source secret expiry cleanup",
  { minutes: 15 },
  internal.integrations.github.repositories.cleanup,
  {},
);
crons.interval(
  "GitHub pending receipt resumption",
  { minutes: 1 },
  internal.integrations.github.deliveries.resume,
  {},
);
crons.interval(
  "GitHub failed delivery detection",
  { minutes: 15 },
  internal.integrations.github.recovery.scan,
  {},
);
crons.interval(
  "Protected assessment cleanup",
  { minutes: 15 },
  internal.intelligence.assessments.sweep,
  { cursor: null },
);
crons.interval(
  "Own metrics retention cleanup",
  { minutes: 15 },
  internal.performance.snapshots.expire,
  {},
);
crons.interval(
  "Protected editorial feedback cleanup",
  { minutes: 15 },
  internal.content.feedback.sweep,
  { cursor: null },
);
crons.interval(
  "Own history text cleanup",
  { minutes: 15 },
  internal.performance.history.expire,
  {},
);
crons.interval(
  "Local calibration reference cleanup",
  { minutes: 15 },
  internal.performance.calibration.sweep,
  { cursor: null },
);
crons.interval(
  "Local calibration model cleanup",
  { minutes: 15 },
  internal.performance.models.sweep,
  { cursor: null },
);
crons.interval(
  "Protected declared style cleanup",
  { minutes: 15 },
  internal.ai.styleProfiles.sweep,
  { cursor: null, table: "proposals" },
);
crons.interval(
  "Protected semantic coordinate cleanup",
  { minutes: 15 },
  internal.content.similarity.sweep,
  { cursor: null, family: "vectors" },
);
crons.interval(
  "Finite proposal proof cleanup",
  { minutes: 15 },
  internal.planning.recurring.sweep,
  { cursor: null },
);
crons.interval(
  "Finite editorial experiment proof cleanup",
  { minutes: 15 },
  internal.performance.experiments.sweep,
  { cursor: null },
);
crons.interval(
  "Native team invitation cleanup",
  { minutes: 15 },
  internal.team.sweep,
  { cursor: null, phase: "invitations" },
);
crons.interval(
  "Exact editorial review proof cleanup",
  { minutes: 15 },
  internal.editorial.reviews.sweep,
  { cursor: null, phase: "decisions" },
);
crons.interval(
  "Recipient editorial notice cleanup",
  { minutes: 15 },
  internal.editorial.notices.sweep,
  { cursor: null },
);
crons.interval(
  "Protected native routing cleanup",
  { minutes: 15 },
  internal.ai.jev.routing.purge,
  { cursor: null, force: false },
);
export default crons;
