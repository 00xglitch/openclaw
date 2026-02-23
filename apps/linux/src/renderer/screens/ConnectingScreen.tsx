type Props = {
  gatewayUrl: string;
  onCancel: () => void;
};

export function ConnectingScreen({ gatewayUrl, onCancel }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <div className="w-16 h-16 relative flex items-center justify-center">
        <svg viewBox="0 0 512 512" className="w-full h-full opacity-70">
          <defs>
            <linearGradient id="cbg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a0a0f" />
              <stop offset="100%" stopColor="#1a1a2e" />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="96" fill="url(#cbg)" />
          <g
            transform="translate(256,256)"
            fill="none"
            stroke="#f97316"
            strokeWidth="14"
            strokeLinecap="round"
          >
            <path d="M0,-100 Q-40,-50 0,-10" />
            <path d="M0,-100 Q40,-50 0,-10" />
            <path d="M-87,50 Q-43,10 0,-10" />
            <path d="M-87,50 Q-50,80 -10,40" />
            <path d="M87,50 Q43,10 0,-10" />
            <path d="M87,50 Q50,80 10,40" />
          </g>
          <circle cx="256" cy="246" r="12" fill="#f97316" />
        </svg>
        <div className="absolute inset-0 rounded-full border-2 border-orange-500/30 animate-ping" />
      </div>

      <div className="text-center space-y-2">
        <p className="text-sm text-zinc-300">Connecting to gateway...</p>
        <p className="text-xs text-zinc-600 font-mono">{gatewayUrl}</p>
      </div>

      <button
        onClick={onCancel}
        className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
