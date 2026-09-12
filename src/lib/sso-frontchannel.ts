import "server-only";

import {
  coretapReturnOrigins,
  nexustapReturnOrigins,
  shifttapReturnOrigins,
  signaltapReturnOrigins,
} from "@/lib/env";

const CORETAP_FRONTCHANNEL_PATH = "/api/auth/sso/authtap/frontchannel-logout";
const NEXUSTAP_FRONTCHANNEL_PATH = "/api/auth/sso/authtap/frontchannel-logout";
const SIGNALTAP_FRONTCHANNEL_PATH = "/auth/sso/authtap/frontchannel-logout";
const SHIFTTAP_FRONTCHANNEL_PATH = "/api/auth/sso/authtap/frontchannel-logout";

export type FrontchannelApp = { origin: string; path: string };

function originsFromEnv(raw: string | undefined): string[] {
  return [...new Set(
    (raw ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean),
  )];
}

function firstConfiguredOrigin(raw: string | undefined, fallbacks: string[], prefer: string, lastResort: string): string {
  return originsFromEnv(raw)[0]
    ?? fallbacks.find((origin) => origin.includes(prefer))
    ?? fallbacks[0]
    ?? lastResort;
}

function coretapAppOrigin(): string {
  return firstConfiguredOrigin(
    process.env.CORETAP_RETURN_ORIGINS,
    coretapReturnOrigins(),
    "3000",
    "http://localhost:3000",
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

function shifttapAppOrigin(): string {
  return firstConfiguredOrigin(
    process.env.SHIFTTAP_RETURN_ORIGINS,
    shifttapReturnOrigins(),
    "3005",
    "http://localhost:3005",
  );
}

const FRONTCHANNEL_CLIENTS = ["coretap", "nexustap", "signaltap", "shifttap"] as const;
type FrontchannelClient = (typeof FRONTCHANNEL_CLIENTS)[number];

function isFrontchannelClient(value: string): value is FrontchannelClient {
  return (FRONTCHANNEL_CLIENTS as readonly string[]).includes(value);
}

function appsForClient(client: FrontchannelClient): FrontchannelApp[] {
  switch (client) {
    case "coretap": {
      const origins = originsFromEnv(process.env.CORETAP_RETURN_ORIGINS);
      const list = origins.length ? origins : [coretapAppOrigin()];
      return list.map((origin) => ({ origin, path: CORETAP_FRONTCHANNEL_PATH }));
    }
    case "nexustap":
      return [{ origin: nexustapAppOrigin(), path: NEXUSTAP_FRONTCHANNEL_PATH }];
    case "signaltap":
      return [{ origin: signaltapAppOrigin(), path: SIGNALTAP_FRONTCHANNEL_PATH }];
    case "shifttap":
      return [{ origin: shifttapAppOrigin(), path: SHIFTTAP_FRONTCHANNEL_PATH }];
    default: {
      const _never: never = client;
      throw new Error(`Unhandled front-channel client: ${String(_never)}`);
    }
  }
}

/**
 * Product front-channel logout URLs. AuthTAP walks this chain top-level so
 * each origin can expire its own cookies. AUTHTAP_FRONTCHANNEL_CLIENTS can
 * narrow it (local CoreTAP-only: `coretap`) so logout does not hit apps
 * that are not running.
 */
export function productFrontchannelApps(): FrontchannelApp[] {
  const raw = (process.env.AUTHTAP_FRONTCHANNEL_CLIENTS ?? "").trim();
  const wanted = raw
    ? raw
        .split(",")
        .map((name) => name.trim().toLowerCase())
        .filter(isFrontchannelClient)
    : [...FRONTCHANNEL_CLIENTS];
  return wanted.flatMap(appsForClient);
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
