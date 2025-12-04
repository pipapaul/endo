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
      </div>
    </section>
  );
}
