type Props = {
  message: string;
  onRetry: () => void;
  onReconfigure: () => void;
};

export function DisconnectedScreen({ message, onRetry, onReconfigure }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
      <div className="w-12 h-12 flex items-center justify-center rounded-full bg-red-950/50 border border-red-800/30">
        <div className="w-3 h-3 rounded-full bg-red-400" />
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-sm font-medium text-zinc-300">Disconnected</h2>
        <p className="text-xs text-zinc-500 max-w-xs">{message}</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReconfigure}
          className="px-4 py-2.5 text-sm rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          Settings
        </button>
        <button
          onClick={onRetry}
          className="px-4 py-2.5 text-sm rounded-xl bg-orange-600 text-white hover:bg-orange-500 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
