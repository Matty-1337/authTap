import "server-only";

import { coretapReturnOrigins, nexustapReturnOrigins, signaltapReturnOrigins } from "@/lib/env";

const CORETAP_FRONTCHANNEL_PATH = "/api/auth/sso/authtap/frontchannel-logout";
const NEXUSTAP_FRONTCHANNEL_PATH = "/api/auth/sso/authtap/frontchannel-logout";
const SIGNALTAP_FRONTCHANNEL_PATH = "/auth/sso/authtap/frontchannel-logout";

export type FrontchannelApp = { origin: string; path: string };

function firstConfiguredOrigin(raw: string | undefined, fallbacks: string[], prefer: string, lastResort: string): string {
  const fromEnv = (raw ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .find(Boolean);
  if (fromEnv) return fromEnv;
  return fallbacks.find((origin) => origin.includes(prefer)) ?? fallbacks[0] ?? lastResort;
}

function coretapAppOrigin(): string {
  return firstConfiguredOrigin(
    process.env.CORETAP_RETURN_ORIGINS,
    coretapReturnOrigins(),
    "6100",
    "http://localhost:6100",
  );
}

function nexustapAppOrigin(): string {
  return firstConfiguredOrigin(
    process.env.NEXUSTAP_RETURN_ORIGINS,
    nexustapReturnOrigins(),
    "3002",
    "http://localhost:3002",
  );
}

function signaltapAppOrigin(): string {
  return firstConfiguredOrigin(
    process.env.SIGNALTAP_RETURN_ORIGINS,
    signaltapReturnOrigins(),
    "3001",
    "http://localhost:3001",
  );
}

/**
 * Product front-channel logout URLs. Add a new origin + path here when an app
 * authenticates through AuthTAP — AuthTAP walks the chain top-level so each
 * origin can expire its own cookies (and Signal TAP's localStorage hop).
 */
export function productFrontchannelApps(): FrontchannelApp[] {
  return [
    { origin: coretapAppOrigin(), path: CORETAP_FRONTCHANNEL_PATH },
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
