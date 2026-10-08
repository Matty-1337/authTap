import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const HOP = "client=coretap&return_to=https%3A%2F%2Fcore-tap.com%2Fauth%2Fauthtap%2Fcallback&state=state-token-1";

function req(path: string, cookie = ""): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3004"), { headers: cookie ? { cookie } : {} });
}

describe("AuthTAP middleware", () => {
  it("sends a direct visit to any sign-in page to the Delta Kinetics site", () => {
    for (const path of ["/", "/login", "/register", "/continue", "/verify-email?email=a%40b.co"]) {
      const res = middleware(req(path));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://deltakinetics.io/");
    }
  });

  it("lets a product hop through on the query string", () => {
    for (const path of ["/", "/login", "/register"]) {
      expect(middleware(req(`${path}?${HOP}`)).headers.get("location")).toBeNull();
    }
  });

  it("lets every later step of a hop through on at_continue", () => {
    for (const path of ["/", "/login", "/register", "/continue", "/verify-email?email=a%40b.co"]) {
      expect(middleware(req(path, "at_continue=signed")).headers.get("location")).toBeNull();
    }
  });

  it("still finishes a signed-in hop that arrives with the query", () => {
    const res = middleware(req(`/login?${HOP}`, "at_session=signed"));
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/api/sso/complete");
  });

  it("keeps the add-account step on the sign-in page", () => {
    const res = middleware(req(`/login?${HOP}`, "at_session=signed; at_adding=1"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("never serves the old account page and drops a leftover hop there", () => {
    const res = middleware(req(`/account?${HOP}`, "at_session=signed; at_continue=signed"));
    expect(res.headers.get("location")).toBe("https://deltakinetics.io/");
    expect(res.cookies.get("at_continue")?.value).toBe("");
  });
});
