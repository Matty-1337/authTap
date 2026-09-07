"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { isTurnstileEnabled, turnstileSiteKey } from "@/lib/turnstile";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "auto" | "light" | "dark";
      appearance?: "always" | "execute" | "interaction-only";
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __authtapTurnstileOnLoad?: () => void;
  }
}

type TurnstileWidgetProps = {
  onVerify: (token: string) => void;
  className?: string;
  resetSignal?: number;
};

export function TurnstileWidget({ onVerify, className, resetSignal }: TurnstileWidgetProps) {
  if (!isTurnstileEnabled()) return null;
  return <TurnstileWidgetInner onVerify={onVerify} className={className} resetSignal={resetSignal} />;
}

function TurnstileWidgetInner({ onVerify, className, resetSignal }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);

  useEffect(() => {
    onVerifyRef.current = onVerify;
  }, [onVerify]);

  useEffect(() => {
    if (resetSignal === undefined) return;
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      onVerifyRef.current("");
    }
  }, [resetSignal]);

  useEffect(() => {
    const container = containerRef.current;
    const siteKey = turnstileSiteKey();

    function renderWidget() {
      if (!container || !window.turnstile || widgetIdRef.current) return;
      if (!siteKey) return;
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: siteKey,
        theme: "dark",
        appearance: "always",
        callback: (token: string) => onVerifyRef.current(token),
        "expired-callback": () => onVerifyRef.current(""),
        "error-callback": () => onVerifyRef.current(""),
      });
    }

    if (window.turnstile) renderWidget();
    window.__authtapTurnstileOnLoad = renderWidget;

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <Script src={SCRIPT_SRC} strategy="afterInteractive" onReady={() => window.__authtapTurnstileOnLoad?.()} />
      <div ref={containerRef} className={className} />
    </>
  );
}
