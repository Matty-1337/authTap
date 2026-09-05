import "server-only";

import { nexustapReturnOrigins, signaltapReturnOrigins } from "@/lib/env";

const NEXUSTAP_FRONTCHANNEL_PATH = "/api/auth/sso/authtap/frontchannel-logout";
const SIGNALTAP_FRONTCHANNEL_PATH = "/auth/sso/authtap/frontchannel-logout";

export type FrontchannelApp = { origin: string; path: string };

function nexustapAppOrigin(): string {
  const fromEnv = (process.env.NEXUSTAP_RETURN_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .find(Boolean);
  if (fromEnv) return fromEnv;
  const known = nexustapReturnOrigins();
  return known.find((origin) => origin.includes("3002")) ?? known[0] ?? "http://localhost:3002";
}

function signaltapAppOrigin(): string {
  const fromEnv = (process.env.SIGNALTAP_RETURN_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .find(Boolean);
  if (fromEnv) return fromEnv;
  const known = signaltapReturnOrigins();
  return known.find((origin) => origin.includes("3001")) ?? known[0] ?? "http://localhost:3001";
}

/**
 * Product front-channel logout URLs. Add a new origin + path here when an app
 * authenticates through AuthTAP — AuthTAP walks the chain top-level so each
 * origin can expire its own cookies (and Signal TAP's localStorage hop).
 */
export function productFrontchannelApps(): FrontchannelApp[] {
  return [
    { origin: nexustapAppOrigin(), path: NEXUSTAP_FRONTCHANNEL_PATH },
    { origin: signaltapAppOrigin(), path: SIGNALTAP_FRONTCHANNEL_PATH },
  ];
}

export function chainFrontchannelLogouts(apps: FrontchannelApp[], finalUrl: string): string {
  return apps.reduceRight((next, app) => {
    const url = new URL(app.path, app.origin);
    url.searchParams.set("next", next);
    return url.toString();
  }, finalUrl);
}

/** After the last AuthTAP account is removed, expire product cookies then return to AuthTAP login. */
export function afterLastAccountSignOutUrl(authtapOrigin: string): string {
  const apps = productFrontchannelApps();
  const login = new URL("/login", authtapOrigin).toString();
  if (!apps.length) return login;
  return chainFrontchannelLogouts(apps, login);
}
