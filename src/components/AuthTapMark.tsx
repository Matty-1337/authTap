type AuthTapMarkProps = {
  className?: string;
  knockout?: string;
};

export function AuthTapMark({ className, knockout = "#161826" }: AuthTapMarkProps) {
  return (
    <svg
      viewBox="0 0 72 76"
      className={className}
      role="img"
      aria-label="AuthTAP"
    >
      <circle cx="32" cy="22" r="13" fill="#F2F2F5" />
      <path d="M12 58 a20 20 0 0 1 40 0 Z" fill="#F2F2F5" />
      <circle cx="50" cy="46" r="8.5" fill="none" stroke={knockout} strokeWidth="13" />
      <rect x="43" y="48.5" width="14" height="25" rx="5.5" fill={knockout} />
      <rect x="50" y="55.5" width="14" height="12.5" rx="5.5" fill={knockout} />
      <circle cx="50" cy="46" r="8.5" fill="none" stroke="#9B6DFF" strokeWidth="6" />
      <rect x="46.5" y="52" width="7" height="18" rx="2" fill="#9B6DFF" />
      <rect x="53.5" y="59" width="7" height="5.5" rx="2" fill="#9B6DFF" />
    </svg>
  );
}
