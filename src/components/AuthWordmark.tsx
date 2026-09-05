export function AuthWordmark({ className }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-[-0.035em] ${className ?? "text-[28px]"}`}>
      Auth<span className="text-[#9B6DFF]">TAP</span>
    </span>
  );
}
