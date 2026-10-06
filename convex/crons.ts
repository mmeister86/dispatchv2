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
export default crons;
