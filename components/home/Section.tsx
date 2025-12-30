"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type SectionCompletionState = Record<string, Record<string, boolean>>;
export type SectionRegistryState = Record<string, Record<string, true>>;

export type SectionCompletionContextValue = {
  getCompletion: (scope: string | number | null, key: string) => boolean;
  setCompletion: (scope: string | number | null, key: string, completed: boolean) => void;
  registerSection: (scope: string | number | null, key: string) => void;
  unregisterSection: (scope: string | number | null, key: string) => void;
};

export const SectionScopeContext = React.createContext<string | number | null>(null);
export const SectionCompletionContext = React.createContext<SectionCompletionContextValue | null>(null);

export function Section({
  title,
  description,
  aside,
  children,
  completionEnabled = true,
  variant = "card",
  hideHeader = false,
}: {
  title: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  completionEnabled?: boolean;
  variant?: "card" | "plain";
  hideHeader?: boolean;
}) {
  const scope = React.useContext(SectionScopeContext);
  const completionContext = React.useContext(SectionCompletionContext);
  const [isCompleted, setIsCompleted] = React.useState(false);

  const completedFromContext = React.useMemo(() => {
    if (!completionEnabled) return false;
    if (!completionContext) return false;
    if (scope === null || scope === undefined) return false;
    return completionContext.getCompletion(scope, title);
  }, [completionContext, completionEnabled, scope, title]);

  React.useEffect(() => {
    if (!completionEnabled) return;
    if (!completionContext) return;
    if (scope === null || scope === undefined) return;
    completionContext.registerSection(scope, title);
    return () => {
      completionContext.unregisterSection(scope, title);
    };
  }, [completionContext, completionEnabled, scope, title]);

  React.useEffect(() => {
    if (!completionEnabled) {
      setIsCompleted(false);
      return;
    }

    if (!completedFromContext) {
      setIsCompleted(false);
      return;
    }

    setIsCompleted(true);
  }, [completedFromContext, completionEnabled]);

  return (
    <section
      data-section-card
      data-section-completed={isCompleted ? "true" : "false"}
      className={cn(
        "relative",
        variant === "card"
          ? "rounded-2xl border border-rose-200 bg-white shadow-sm transition-colors overflow-hidden"
          : "space-y-4 sm:space-y-5",
        variant === "card" && isCompleted ? "border-amber-200 shadow-md" : null
      )}
    >
      {!hideHeader ? (
        <div
          className={cn(
            "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
            variant === "card"
              ? "border-b border-rose-200 bg-gradient-to-b from-rose-100/80 to-rose-50/50 px-4 py-3 sm:px-6 sm:py-4"
              : ""
          )}
        >
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-rose-900">{title}</h2>
            {description && (
              <p className="text-sm text-rose-700">{description}</p>
            )}
          </div>
          {aside ? <div className="flex-shrink-0 sm:self-start">{aside}</div> : null}
        </div>
      ) : null}
      <div className={cn("space-y-4", variant === "card" ? "p-4 sm:p-6" : "")}>
        {children}
      </div>
    </section>
  );
}
