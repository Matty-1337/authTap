type AccountAvatarProps = {
  name: string;
  email: string;
  size?: "sm" | "lg";
};

function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0]) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const local = email.split("@")[0] ?? "?";
  return local.slice(0, 2).toUpperCase() || "?";
}

export function AccountAvatar({ name, email, size = "sm" }: AccountAvatarProps) {
  const label = initials(name, email);
  const box = size === "lg" ? "h-12 w-12 text-[15px]" : "h-10 w-10 text-[13px]";

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-[#9B6DFF] font-semibold text-[#161826] ${box}`}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}
