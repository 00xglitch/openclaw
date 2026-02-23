type Props = {
  onNext: () => void;
};

export function WelcomeStep({ onNext }: Props) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-20 h-20 mb-6">
        <svg viewBox="0 0 512 512" className="w-full h-full">
          <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a0a0f" />
              <stop offset="100%" stopColor="#1a1a2e" />
            </linearGradient>
            <linearGradient id="claw" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="96" fill="url(#bg)" />
          <circle cx="256" cy="256" r="160" fill="none" stroke="#f97316" strokeWidth="3" opacity="0.3" />
          <g
            transform="translate(256,256)"
            fill="none"
            stroke="url(#claw)"
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
          <g
            transform="translate(256,246)"
            fill="none"
            stroke="#f97316"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.6"
          >
            <path d="M30,-20 Q50,0 30,20" />
            <path d="M45,-35 Q75,0 45,35" />
          </g>
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-zinc-100 mb-2">OpenClaw</h1>
      <p className="text-sm text-zinc-400 mb-8">Your local AI gateway for Linux</p>

      <button
        onClick={onNext}
        className="w-full py-2.5 rounded-xl bg-orange-600 text-white font-medium hover:bg-orange-500 transition-colors"
      >
        Get Started
      </button>
    </div>
  );
}
