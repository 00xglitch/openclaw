import { renderMarkdown } from "../lib/markdown-lite.js";

type Props = {
  text: string;
  agentInitial?: string;
};

export function StreamingBubble({ text, agentInitial }: Props) {
  if (!text && text !== "") {return null;}
  const initial = (agentInitial ?? "A").charAt(0).toUpperCase();

  return (
    <div className="flex justify-start mb-3 gap-2">
      <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-1">
        <span className="text-[10px] font-bold text-orange-400">{initial}</span>
      </div>
      <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-zinc-800/80 text-zinc-200 text-sm leading-relaxed break-words">
        {text ? renderMarkdown(text) : "\u00A0"}
        <span
          className="inline-block w-0.5 h-4 ml-0.5 bg-orange-400 rounded-sm"
          style={{ animation: "cursor-blink 1s step-end infinite" }}
        />
      </div>
    </div>
  );
}
