const BIND_HOSTS = new Set(["0.0.0.0", "::", "[::]"]);

function firstHeader(headers: Headers, name: string): string {
  return headers.get(name)?.split(",")[0]?.trim() ?? "";
}

function hostnameOf(host: string): string {
  const value = host.trim().toLowerCase();
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    return end === -1 ? value : value.slice(0, end + 1);
  }
  return value.split(":")[0] ?? value;
}

function isBindHost(host: string): boolean {
  return BIND_HOSTS.has(hostnameOf(host));
}

/**
 * Public origin for redirects. Next standalone listens on HOSTNAME=0.0.0.0,
 * so req.url becomes http(s)://0.0.0.0:PORT even when nginx forwarded the
 * real host.
 */
export function publicOrigin(req: { url: string; headers: Headers }): string {
  const configured = (process.env.AUTHTAP_PUBLIC_URL ?? "").trim().replace(/\/$/, "");
  if (configured) return configured;

  const host = firstHeader(req.headers, "x-forwarded-host") || firstHeader(req.headers, "host");
  const proto =
    firstHeader(req.headers, "x-forwarded-proto") ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host && !isBindHost(host)) {
    return `${proto}://${host}`;
  }

  try {
    const fromReq = new URL(req.url);
    if (!isBindHost(fromReq.hostname)) return fromReq.origin;
  } catch {
    // ignore invalid req.url
  }

  return process.env.NODE_ENV === "production"
    ? "https://authtap.deltakinetics.io"
    : "http://localhost:3004";
}

export function publicUrl(path: string, req: { url: string; headers: Headers }): URL {
  return new URL(path, publicOrigin(req));
}
