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
export default crons;
