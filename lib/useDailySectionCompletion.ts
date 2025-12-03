"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import type { PersistentStateMeta } from "./usePersistentState";
import type { SectionCompletionState } from "@/components/home/Section";

export function useDailySectionCompletion({
  dailyScopeKey,
  sectionCompletionState,
  sectionCompletionStorage,
}: {
  dailyScopeKey: string | null;
  sectionCompletionState: SectionCompletionState;
  sectionCompletionStorage: PersistentStateMeta;
}) {
  const [sectionCompletionReady, setSectionCompletionReady] = useState(() =>
    Boolean(sectionCompletionStorage.ready || sectionCompletionStorage.restored)
  );
  const [dailyScopeCompletionSnapshot, setDailyScopeCompletionSnapshot] = useState<
    SectionCompletionState[string]
  >({});

  useEffect(() => {
    if (sectionCompletionStorage.ready) {
      setSectionCompletionReady(true);
    }
  }, [sectionCompletionStorage.ready]);

  const resolvedDailyScopeKey = useMemo(
    () => (sectionCompletionReady ? dailyScopeKey : null),
    [dailyScopeKey, sectionCompletionReady]
  );

  useLayoutEffect(() => {
    if (!resolvedDailyScopeKey) {
      setDailyScopeCompletionSnapshot({});
      return;
    }
    setDailyScopeCompletionSnapshot(sectionCompletionState[resolvedDailyScopeKey] ?? {});
  }, [resolvedDailyScopeKey, sectionCompletionState]);

  return {
    dailySectionCompletion: resolvedDailyScopeKey ? dailyScopeCompletionSnapshot : {},
    resolvedDailyScopeKey,
    sectionCompletionReady,
  };
}

