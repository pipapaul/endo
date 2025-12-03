"use client";

import { CheckCircle2 } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

export const CONFETTI_COLORS = ["#fb7185", "#f97316", "#facc15", "#4ade80", "#38bdf8"] as const;
const CONFETTI_VERTICAL_POSITIONS = ["20%", "50%", "80%"] as const;
const CONFETTI_PIECES = Array.from({ length: 8 }, (_, index) => ({
  top: CONFETTI_VERTICAL_POSITIONS[index % CONFETTI_VERTICAL_POSITIONS.length],
  left: `${10 + index * 10}%`,
  delay: index * 80,
}));

export type SectionCompletionState = Record<string, Record<string, boolean>>;
export type SectionRegistryState = Record<string, Record<string, true>>;

export type SectionCompletionContextValue = {
  getCompletion: (scope: string | number | null, key: string) => boolean;
  setCompletion: (scope: string | number | null, key: string, completed: boolean) => void;
  registerSection: (scope: string | number | null, key: string) => void;
  unregisterSection: (scope: string | number | null, key: string) => void;
};

export const SectionScopeContext = createContext<string | number | null>(null);
export const SectionCompletionContext = createContext<SectionCompletionContextValue | null>(null);

export function Section({
  title,
  description,
  aside,
  children,
  completionEnabled = true,
  variant = "card",
  onComplete,
  hideHeader = false,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
  completionEnabled?: boolean;
  variant?: "card" | "plain";
  onComplete?: () => void;
  hideHeader?: boolean;
}) {
  const scope = useContext(SectionScopeContext);
  const completionContext = useContext(SectionCompletionContext);
  const completedFromContext = useMemo(() => {
    if (!completionEnabled) return false;
    if (!completionContext) return false;
    if (scope === null || scope === undefined) return false;
    return completionContext.getCompletion(scope, title);
  }, [completionContext, completionEnabled, scope, title]);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(completedFromContext);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiPieces = useMemo(
    () =>
      CONFETTI_PIECES.map((piece, index) => ({
        ...piece,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      })),
    []
  );

  useEffect(() => {
    if (!completionEnabled) return;
    if (!completionContext) return;
    if (scope === null || scope === undefined) return;
    completionContext.registerSection(scope, title);
    return () => {
      completionContext.unregisterSection(scope, title);
    };
  }, [completionContext, completionEnabled, scope, title]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const cancelTimeout = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const shouldBeCompleted = Boolean(completionEnabled && completedFromContext);
    setIsCompleted(shouldBeCompleted);

    if (!shouldBeCompleted) {
      cancelTimeout();
      setShowConfetti(false);
    }
  }, [completedFromContext, completionEnabled]);

  const handleComplete = () => {
    if (!completionEnabled || isCompleted || showConfetti) return;
    setIsCompleted(true);
    if (completionContext && scope !== null && scope !== undefined) {
      completionContext.setCompletion(scope, title, true);
    }
    setShowConfetti(true);
    timeoutRef.current = window.setTimeout(() => {
      setShowConfetti(false);
      if (onComplete) {
        onComplete();
      }
      timeoutRef.current = null;
    }, 400);
  };

  return (
    <section
      ref={cardRef}
      data-section-card
      data-section-completed={isCompleted ? "true" : "false"}
      className={cn(
        "relative",
        variant === "card"
          ? "space-y-4 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm transition-colors sm:p-6"
          : "space-y-4 sm:space-y-5",
        variant === "card" && isCompleted ? "border-amber-200 shadow-md" : null
      )}
    >
      {!hideHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-rose-900">{title}</h2>
            {description && <p className="text-sm text-rose-600">{description}</p>}
          </div>
          {aside ? <div className="flex-shrink-0 sm:self-start">{aside}</div> : null}
        </div>
      ) : null}
      <div className="space-y-4">
        {children}
        {completionEnabled ? (
          <div className="flex justify-end pt-2">
            <div className="relative inline-flex">
              {completionEnabled && showConfetti ? (
                <div className="pointer-events-none absolute -inset-x-4 -inset-y-3 overflow-visible">
                  {confettiPieces.map((piece, index) => (
                    <span
                      key={index}
                      className="confetti-piece absolute h-3 w-3 rounded-sm"
                      style={{
                        left: piece.left,
                        top: piece.top,
                        backgroundColor: piece.color,
                        animationDelay: `${piece.delay}ms`,
                      }}
                    />
                  ))}
                </div>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className={cn(isCompleted ? "cursor-default" : "")}
                onClick={handleComplete}
                disabled={isCompleted}
              >
                {isCompleted ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Erledigt
                  </span>
                ) : (
                  "Fertig"
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
