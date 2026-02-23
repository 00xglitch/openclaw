import { useState, useCallback } from "react";
import { isOnboardingComplete, setOnboardingComplete } from "../lib/config-store.js";

export type OnboardingStep = 0 | 1 | 2;

export function useOnboarding() {
  const [complete, setComplete] = useState(() => isOnboardingComplete());
  const [step, setStep] = useState<OnboardingStep>(0);

  const nextStep = useCallback(() => {
    setStep((s) => Math.min(s + 1, 2) as OnboardingStep);
  }, []);

  const prevStep = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0) as OnboardingStep);
  }, []);

  const finish = useCallback(() => {
    setOnboardingComplete(true);
    setComplete(true);
  }, []);

  const restart = useCallback(() => {
    setOnboardingComplete(false);
    setComplete(false);
    setStep(0);
  }, []);

  return { complete, step, nextStep, prevStep, finish, restart };
}
