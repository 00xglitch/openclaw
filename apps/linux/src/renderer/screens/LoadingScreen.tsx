export function LoadingScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 animate-pulse">
        <svg viewBox="0 0 512 512" className="w-full h-full opacity-60">
          <defs>
            <linearGradient id="lbg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a0a0f" />
              <stop offset="100%" stopColor="#1a1a2e" />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="96" fill="url(#lbg)" />
          <circle cx="256" cy="256" r="160" fill="none" stroke="#f97316" strokeWidth="3" opacity="0.3" />
          <g
            transform="translate(256,256)"
            fill="none"
            stroke="#f97316"
            strokeWidth="14"
            strokeLinecap="round"
            opacity="0.7"
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
      </div>
      <span className="text-zinc-600 text-sm">Loading...</span>
    </div>
  );
}
