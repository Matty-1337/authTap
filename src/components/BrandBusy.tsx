import { BrandLoader } from "@/components/BrandLoader";

type BrandBusyProps = {
  label?: string;
};

export function BrandBusy({ label = "Signing in" }: BrandBusyProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#161826]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <BrandLoader knockout="#161826" />
    </div>
  );
}
