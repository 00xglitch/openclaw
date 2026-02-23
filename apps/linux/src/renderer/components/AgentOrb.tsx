export type VoicePhase = "idle" | "listening" | "recording" | "thinking" | "speaking";

type Props = {
  voiceMode: boolean;
  phase: VoicePhase;
  agentEmoji: string | null;
  agentAvatar: string | null;
  agentName: string;
  micLevel?: number;
  onToggle: () => void;
  onStopSpeaking: () => void;
  onStopRecording?: () => void;
  onHandyTrigger?: () => void;
};

export function AgentOrb({
  voiceMode,
  phase,
  agentEmoji,
  agentAvatar,
  agentName,
  micLevel = 0,
  onToggle,
  onStopSpeaking,
  onStopRecording,
  onHandyTrigger,
}: Props) {
  const isActive = voiceMode && phase !== "idle";

  function handleClick() {
    if (phase === "speaking") {
      onStopSpeaking();
      onToggle();
    } else if (phase === "recording") {
      onStopRecording?.();
    } else if (!voiceMode) {
      onToggle();
      onHandyTrigger?.();
    } else {
      onToggle();
    }
  }

  // Center content
  const centerContent = (() => {
    // Recording: show mic with level bar
    if (phase === "recording") {
      return (
        <div className="flex flex-col items-center gap-1">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
          <div className="w-6 h-1 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-400 rounded-full transition-all duration-75"
              style={{ width: `${Math.min(micLevel * 100, 100)}%` }}
            />
          </div>
        </div>
      );
    }

    // Speaking: show EQ bars
    if (phase === "speaking") {
      return (
        <div className="flex items-end gap-[3px] h-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-[3px] bg-white rounded-full"
              style={{
                height: "100%",
                animation: `eq-bar 0.8s ease-in-out ${i * 0.12}s infinite`,
                transformOrigin: "bottom",
              }}
            />
          ))}
        </div>
      );
    }

    // Listening: show mic icon
    if (phase === "listening") {
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="11" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      );
    }

    // Avatar image
    if (agentAvatar) {
      return (
        <img
          src={agentAvatar}
          alt={agentName}
          className="w-8 h-8 rounded-full object-cover"
        />
      );
    }

    // Emoji
    if (agentEmoji) {
      return <span className="text-2xl select-none leading-none">{agentEmoji}</span>;
    }

    // Fallback: first letter
    return (
      <span className="text-lg font-semibold text-orange-400 select-none">
        {agentName.charAt(0).toUpperCase()}
      </span>
    );
  })();

  return (
    <div className="fixed top-14 right-3 z-40" style={{ animation: "orb-scale-in 300ms ease-out" }}>
      {/* Outer container for rings */}
      <div className="relative w-[72px] h-[72px] flex items-center justify-center">
        {/* Recording pulse ring */}
        {phase === "recording" && (
          <div
            className="absolute inset-[-2px] rounded-full border-2 border-red-400"
            style={{ animation: "pulse-speak 1.2s ease-in-out infinite" }}
          />
        )}

        {/* Ripple rings — listening phase */}
        {phase === "listening" &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-full border-2 border-orange-400"
              style={{
                animation: `ripple 2s ease-out ${i * 0.6}s infinite`,
                opacity: 0,
              }}
            />
          ))}

        {/* Orbit arcs — thinking phase */}
        {phase === "thinking" && (
          <>
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: "2px solid transparent",
                borderTopColor: "rgba(255,255,255,0.6)",
                borderRightColor: "rgba(255,255,255,0.3)",
                animation: "orbit-cw 0.85s linear infinite",
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: "2px solid transparent",
                borderBottomColor: "rgba(249,115,22,0.6)",
                borderLeftColor: "rgba(249,115,22,0.3)",
                animation: "orbit-ccw 1.1s linear infinite",
              }}
            />
          </>
        )}

        {/* Breathing glow ring — voice on idle */}
        {voiceMode && phase !== "listening" && phase !== "thinking" && (
          <div
            className="absolute inset-[4px] rounded-full"
            style={{ animation: "orb-breathe 3s ease-in-out infinite" }}
          />
        )}

        {/* Main orb button */}
        <button
          onClick={handleClick}
          className={`
            relative w-14 h-14 rounded-full flex items-center justify-center
            transition-all duration-300 cursor-pointer
            ${phase === "recording"
              ? "bg-gradient-to-br from-red-500 to-red-700 shadow-[0_4px_20px_rgba(239,68,68,0.4)]"
              : isActive
                ? "bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_4px_20px_rgba(249,115,22,0.4)]"
                : voiceMode
                  ? "bg-gradient-to-br from-orange-500 to-orange-700 shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
                  : "bg-zinc-800 hover:bg-zinc-700 shadow-lg"
            }
            ${phase === "listening" ? "scale-110" : "scale-100"}
            ${phase === "speaking" ? "animate-[pulse-speak_1.5s_ease-in-out_infinite]" : ""}
          `}
          style={{
            border: isActive ? "1.5px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.1)",
          }}
          title={
            phase === "recording" ? "Stop recording"
            : phase === "speaking" ? "Stop speaking"
            : voiceMode ? "Disable voice"
            : "Enable voice"
          }
        >
          {centerContent}
        </button>
      </div>
    </div>
  );
}
