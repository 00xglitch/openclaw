import type { Toast as ToastData } from "../hooks/useToast.js";

type Props = {
  toasts: ToastData[];
  onDismiss: (id: number) => void;
};

const typeStyles: Record<ToastData["type"], string> = {
  info: "bg-zinc-800 border-zinc-700 text-zinc-200",
  error: "bg-red-950/80 border-red-900/50 text-red-300",
  success: "bg-emerald-950/80 border-emerald-900/50 text-emerald-300",
};

export function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) {return null;}

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-2.5 rounded-xl border text-sm shadow-lg pointer-events-auto cursor-pointer whitespace-nowrap ${typeStyles[toast.type]}`}
          style={{ animation: "toast-in 200ms ease-out" }}
          onClick={() => onDismiss(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
