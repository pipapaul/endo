import { useEffect, useMemo, useState } from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Section,
  SectionCompletionContext,
  SectionScopeContext,
  type SectionCompletionState,
} from "@/components/home/Section";
import { useDailySectionCompletion } from "@/lib/useDailySectionCompletion";
import type { PersistentStateMeta } from "@/lib/usePersistentState";

function DailyCompletionHarness() {
  const [scope, setScope] = useState<string | null>("daily:2024-01-01");
  const [storageReady, setStorageReady] = useState(false);
  const [sectionCompletionState, setSectionCompletionState] = useState<SectionCompletionState>(
    {
      "daily:2024-01-01": {},
      "daily:2024-01-02": {},
    }
  );

  useEffect(() => {
    setStorageReady(true);
  }, []);

  const storageMeta = useMemo<PersistentStateMeta>(
    () => ({
      ready: storageReady,
      driver: "memory",
      error: null,
      driverLabel: "Memory",
      isSaving: false,
      lastSavedAt: null,
      restored: storageReady,
    }),
    [storageReady]
  );

  const { dailySectionCompletion, resolvedDailyScopeKey } = useDailySectionCompletion({
    dailyScopeKey: scope,
    sectionCompletionState,
    sectionCompletionStorage: storageMeta,
  });

  const sectionCompletionValue = useMemo(
    () => ({
      getCompletion: (contextScope: string | number | null, key: string) => {
        if (contextScope === null || contextScope === undefined) {
          return false;
        }
        const scopeKey = String(contextScope);
        if (scopeKey === resolvedDailyScopeKey) {
          return Boolean(dailySectionCompletion[key]);
        }
        return Boolean(sectionCompletionState[scopeKey]?.[key]);
      },
      setCompletion: (contextScope: string | number | null, key: string, completed: boolean) => {
        if (contextScope === null || contextScope === undefined) {
          return;
        }
        const scopeKey = String(contextScope);
        setSectionCompletionState((prev) => {
          const prevForScope = prev[scopeKey] ?? {};
          if (completed) {
            return {
              ...prev,
              [scopeKey]: { ...prevForScope, [key]: true },
            };
          }
          const { [key]: _removed, ...restForScope } = prevForScope;
          return {
            ...prev,
            [scopeKey]: restForScope,
          };
        });
      },
      registerSection: () => {},
      unregisterSection: () => {},
    }),
    [dailySectionCompletion, resolvedDailyScopeKey, sectionCompletionState]
  );

  return (
    <div>
      <button type="button" onClick={() => setScope("daily:2024-01-01")}>Wechsel zu Tag 1</button>
      <button type="button" onClick={() => setScope("daily:2024-01-02")}>Wechsel zu Tag 2</button>
      <SectionCompletionContext.Provider value={sectionCompletionValue}>
        <SectionScopeContext.Provider value={resolvedDailyScopeKey}>
          <Section title="Tagesabschnitt">
            <p>Inhalt</p>
          </Section>
        </SectionScopeContext.Provider>
      </SectionCompletionContext.Provider>
    </div>
  );
}

describe("daily section completions", () => {
  it("restores completion state for each daily scope when switching dates", async () => {
    const user = userEvent.setup();
    render(<DailyCompletionHarness />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Fertig" })).toBeEnabled());

    await user.click(screen.getByRole("button", { name: "Fertig" }));
    expect(screen.getByRole("button", { name: /Erledigt/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Wechsel zu Tag 2" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Fertig" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Fertig" }));
    expect(screen.getByRole("button", { name: /Erledigt/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Wechsel zu Tag 1" }));
    expect(screen.getByRole("button", { name: /Erledigt/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Wechsel zu Tag 2" }));
    expect(screen.getByRole("button", { name: /Erledigt/ })).toBeDisabled();
  });
});

