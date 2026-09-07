import "server-only";

function required(name: string, fallback?: string): string {
  const value = (process.env[name] ?? fallback ?? "").trim();
  return value;
}

export function dkBackendUrl(): string {
  const fallback = process.env.NODE_ENV === "production" ? "https://deltakinetics.io" : "http://localhost:9000";
  return required("DK_BACKEND_URL", fallback).replace(/\/$/, "");
}

export function dkLoginProduct(): string {
  return required("DK_LOGIN_PRODUCT", "coretap");
}

export function sessionSecret(): string {
  const value = required("AUTHTAP_SESSION_SECRET");
  if (value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTHTAP_SESSION_SECRET must be at least 32 characters.");
  }
  return "authtap-dev-session-secret-do-not-use-in-prod";
}

/** Shared with TAP apps that redeem AuthTAP handoff codes. */
export function ssoSecret(): string {
  const value = required("AUTHTAP_SSO_SECRET");
  if (value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTHTAP_SSO_SECRET must be at least 32 characters.");
  }
  return "authtap-dev-sso-secret-do-not-use-in-prod";
}

export function nexustapReturnOrigins(): string[] {
  const extras = required("NEXUSTAP_RETURN_ORIGINS")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return [...new Set(["http://localhost:3000", "http://localhost:3002", ...extras])];
}

export function signaltapReturnOrigins(): string[] {
  const extras = required("SIGNALTAP_RETURN_ORIGINS")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return [...new Set(["http://localhost:3001", ...extras])];
}

export function coretapReturnOrigins(): string[] {
  const extras = required("CORETAP_RETURN_ORIGINS")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return [
    ...new Set([
      "http://localhost:6100",
      "http://localhost:3000",
      "http://core-tap.local:3000",
      "https://core-tap.com",
      "https://www.core-tap.com",
      ...extras,
    ]),
  ];
}
