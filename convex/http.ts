import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { receive } from "./integrations/github/webhook";
const http = httpRouter();
authComponent.registerRoutes(http, createAuth, { cors: true });
http.route({
  path: "/integrations/github/webhook",
  method: "POST",
  handler: receive,
});
export default http;
