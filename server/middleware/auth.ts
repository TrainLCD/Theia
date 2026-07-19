import { defineMiddleware } from "nitro";
import { HTTPError, requireBasicAuth } from "nitro/h3";

const AUTH_BYPASS = process.env.AUTH_BYPASS === "true";
const AUTH_USERNAME = process.env.AUTH_USERNAME;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;
const REALM = "Theia";

export default defineMiddleware(async (event) => {
  if (AUTH_BYPASS) return;

  if (!AUTH_USERNAME || !AUTH_PASSWORD) {
    throw new HTTPError({
      status: 503,
      statusText: "Service Unavailable",
      message:
        "Authentication is not configured. Set AUTH_USERNAME and AUTH_PASSWORD, or set AUTH_BYPASS=true to disable authentication.",
    });
  }

  await requireBasicAuth(event, {
    username: AUTH_USERNAME,
    password: AUTH_PASSWORD,
    realm: REALM,
  });
});
