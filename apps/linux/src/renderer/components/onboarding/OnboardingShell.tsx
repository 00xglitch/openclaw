import type { ReactNode } from "react";

type Props = {
  step: number;
  totalSteps: number;
  children: ReactNode;
};

export function OnboardingShell({ step, totalSteps, children }: Props) {
  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-sm">{children}</div>
      </div>
      <div className="flex items-center justify-center gap-2 pb-8">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              i === step ? "bg-orange-500" : "bg-zinc-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
