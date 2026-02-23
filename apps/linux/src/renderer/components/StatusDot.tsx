type Status = "online" | "offline" | "warning" | "idle";

type Props = {
  status: Status;
  className?: string;
};

const dotColors: Record<Status, string> = {
  online: "bg-emerald-400",
  offline: "bg-red-400",
  warning: "bg-amber-400",
  idle: "bg-zinc-500",
};

export function StatusDot({ status, className = "" }: Props) {
  return (
    <div
      className={`w-2 h-2 rounded-full ${dotColors[status]} ${className}`}
      title={status}
    />
  );
}
