"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";

import { TourOverlay } from "@/components/help/TourOverlay";
import { markTourCompleted, tourById, type TourDefinition } from "@/lib/help";

type TourContextValue = {
  activeTour: TourDefinition | null;
  stepIndex: number;
  startTour: (tourId: string) => void;
  stopTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used within TourProvider");
  }
  return ctx;
}

/** Optional — returns null outside provider (Help can still list tours). */
export function useTourOptional(): TourContextValue | null {
  return useContext(TourContext);
}

export function TourProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTour, setActiveTour] = useState<TourDefinition | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [pendingTourId, setPendingTourId] = useState<string | null>(null);

  const begin = useCallback((tour: TourDefinition) => {
    setActiveTour(tour);
    setStepIndex(0);
    setPendingTourId(null);
  }, []);

  const stopTour = useCallback(() => {
    setActiveTour(null);
    setStepIndex(0);
    setPendingTourId(null);
  }, []);

  const startTour = useCallback(
    (tourId: string) => {
      const tour = tourById(tourId);
      if (!tour) return;
      const onRoute =
        pathname === tour.routePrefix || pathname.startsWith(`${tour.routePrefix}/`);
      if (!onRoute) {
        setPendingTourId(tour.id);
        router.push(tour.routePrefix);
        return;
      }
      begin(tour);
    },
    [begin, pathname, router],
  );

  useEffect(() => {
    if (!pendingTourId) return;
    const tour = tourById(pendingTourId);
    if (!tour) {
      const clearTimer = window.setTimeout(() => setPendingTourId(null), 0);
      return () => window.clearTimeout(clearTimer);
    }
    const onRoute =
      pathname === tour.routePrefix || pathname.startsWith(`${tour.routePrefix}/`);
    if (!onRoute) return;
    // Allow paint so data-tour targets exist.
    const t = window.setTimeout(() => begin(tour), 80);
    return () => window.clearTimeout(t);
  }, [begin, pathname, pendingTourId]);

  const finish = useCallback(
    (tour: TourDefinition) => {
      markTourCompleted(tour.id);
      stopTour();
    },
    [stopTour],
  );

  const nextStep = useCallback(() => {
    if (!activeTour) return;
    if (stepIndex >= activeTour.steps.length - 1) {
      finish(activeTour);
      return;
    }
    setStepIndex((i) => i + 1);
  }, [activeTour, finish, stepIndex]);

  const prevStep = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const skipTour = useCallback(() => {
    if (activeTour) markTourCompleted(activeTour.id);
    stopTour();
  }, [activeTour, stopTour]);

  const value = useMemo(
    () => ({
      activeTour,
      stepIndex,
      startTour,
      stopTour,
      nextStep,
      prevStep,
      skipTour,
    }),
    [activeTour, stepIndex, startTour, stopTour, nextStep, prevStep, skipTour],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {activeTour ? (
        <TourOverlay
          tour={activeTour}
          stepIndex={stepIndex}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
          onClose={stopTour}
        />
      ) : null}
    </TourContext.Provider>
  );
}
