import { afterEach, describe, expect, it } from "vitest";
import { parseError } from "@/lib/dk-auth";
import { isTurnstileEnabled, turnstileTokenFromForm } from "@/lib/turnstile";

const previous = {
  siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  enforce: process.env.NEXT_PUBLIC_TURNSTILE_ENFORCE,
};

afterEach(() => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = previous.siteKey;
  process.env.NEXT_PUBLIC_TURNSTILE_ENFORCE = previous.enforce;
});

describe("turnstileTokenFromForm", () => {
  it("prefers turnstileToken then the native widget field", () => {
    const form = new FormData();
    form.set("cf-turnstile-response", "native");
    expect(turnstileTokenFromForm(form)).toBe("native");
    form.set("turnstileToken", "named");
    expect(turnstileTokenFromForm(form)).toBe("named");
  });
});

describe("isTurnstileEnabled", () => {
  it("is off without a site key", () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_ENFORCE = "1";
    expect(isTurnstileEnabled()).toBe(false);
  });

  it("follows NEXT_PUBLIC_TURNSTILE_ENFORCE when a site key is set", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "0x-test";
    process.env.NEXT_PUBLIC_TURNSTILE_ENFORCE = "0";
    expect(isTurnstileEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_TURNSTILE_ENFORCE = "1";
    expect(isTurnstileEnabled()).toBe(true);
  });
});

describe("parseError", () => {
  it("maps turnstile_required to a robot-check message", () => {
    expect(parseError({ reason: "turnstile_required", message: "Verification required." }, "fallback")).toBe(
      "Confirm you are not a robot, then try again.",
    );
  });
});
