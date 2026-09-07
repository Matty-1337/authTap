import { afterEach, describe, expect, it } from "vitest";
import { publicOrigin, publicUrl } from "@/lib/public-origin";

const env = process.env as Record<string, string | undefined>;

const previous = {
  publicUrl: process.env.AUTHTAP_PUBLIC_URL,
  nodeEnv: process.env.NODE_ENV,
};

afterEach(() => {
  process.env.AUTHTAP_PUBLIC_URL = previous.publicUrl;
  env.NODE_ENV = previous.nodeEnv;
});

function request(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

describe("publicOrigin", () => {
  it("prefers AUTHTAP_PUBLIC_URL over the Docker bind address", () => {
    process.env.AUTHTAP_PUBLIC_URL = "https://authtap.deltakinetics.io/";
    const origin = publicOrigin(
      request("https://0.0.0.0:3000/api/sso/incoming", {
        host: "0.0.0.0:3000",
        "x-forwarded-proto": "https",
      }),
    );
    expect(origin).toBe("https://authtap.deltakinetics.io");
  });

  it("uses forwarded host when the bind address leaked into req.url", () => {
    delete process.env.AUTHTAP_PUBLIC_URL;
    const origin = publicOrigin(
      request("https://0.0.0.0:3000/login", {
        host: "0.0.0.0:3000",
        "x-forwarded-host": "authtap.deltakinetics.io",
        "x-forwarded-proto": "https",
      }),
    );
    expect(origin).toBe("https://authtap.deltakinetics.io");
  });

  it("keeps localhost for local tests and dev", () => {
    delete process.env.AUTHTAP_PUBLIC_URL;
    env.NODE_ENV = "test";
    expect(publicOrigin(request("http://localhost:3004/api/auth/email"))).toBe(
      "http://localhost:3004",
    );
    expect(publicUrl("/login", request("http://localhost:3004/api/auth/email")).toString()).toBe(
      "http://localhost:3004/login",
    );
  });

  it("falls back to the production domain when only 0.0.0.0 is available", () => {
    delete process.env.AUTHTAP_PUBLIC_URL;
    env.NODE_ENV = "production";
    expect(publicOrigin(request("https://0.0.0.0:3000/account", { host: "0.0.0.0:3000" }))).toBe(
      "https://authtap.deltakinetics.io",
    );
  });
});
