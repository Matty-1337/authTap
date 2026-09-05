"use client";

import { useEffect, useState } from "react";
import { BrandBusy } from "@/components/BrandBusy";

export function BrandSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setVisible(false), 1200);
    return () => window.clearTimeout(id);
  }, []);

  if (!visible) return null;

  return (
    <div className="authtap-splash">
      <BrandBusy label="Loading" />
    </div>
  );
}
