type Props = {
  agentName: string;
  onFinish: () => void;
};

export function ReadyStep({ agentName, onFinish }: Props) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-6">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#34d399"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h2 className="text-xl font-bold text-zinc-100 mb-2">You're all set!</h2>
      <p className="text-sm text-zinc-400 mb-8">
        Connected to <span className="text-zinc-200 font-medium">{agentName}</span>
      </p>

      <button
        onClick={onFinish}
        className="w-full py-2.5 rounded-xl bg-orange-600 text-white font-medium hover:bg-orange-500 transition-colors"
      >
        Start Chatting
      </button>
    </div>
  );
}
