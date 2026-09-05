import { AuthTapMark } from "@/components/AuthTapMark";

type BrandLoaderProps = {
  knockout?: string;
};

export function BrandLoader({ knockout = "#161826" }: BrandLoaderProps) {
  return (
    <div className="relative flex h-[126px] w-[126px] items-center justify-center">
      <div className="authtap-om-spin absolute inset-0 origin-center">
        <svg className="h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(155,109,255,.16)"
            strokeWidth="4"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="#9B6DFF"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="70 219"
          />
        </svg>
      </div>
      <AuthTapMark className="authtap-om-breathe h-[59px] w-[56px]" knockout={knockout} />
    </div>
  );
}
