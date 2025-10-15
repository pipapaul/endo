import { assign, createMachine } from "xstate";

import type { DayEntry, FlowMode, Nrs } from "../types";

export type FlowStepId =
  | "nrs"
  | "pbac"
  | "zones"
  | "symptoms"
  | "medication"
  | "sleep"
  | "bowel"
  | "bladder"
  | "triggers"
  | "helped"
  | "notes"
  | "summary";

export interface FlowStep {
  id: FlowStepId;
  optional?: boolean;
}

export interface FlowContext {
  mode: FlowMode;
  steps: FlowStep[];
  currentIndex: number;
  answers: Partial<DayEntry>;
  suggestedUltraQuick: boolean;
  streakLikeYesterday: number;
  lastSubmitted?: DayEntry;
}

export type FlowEvent =
  | { type: "START"; mode: FlowMode; lastSubmitted?: DayEntry; streakLikeYesterday?: number }
  | { type: "ANSWER"; field: keyof DayEntry; value: DayEntry[keyof DayEntry] }
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "SET_MODE"; mode: FlowMode }
  | { type: "APPLY_TEMPLATE"; template: "yesterday" | "pain_bleed" | "symptom_free"; entry?: DayEntry }
  | { type: "RESET" };

const baseSteps: Record<FlowMode, FlowStepId[]> = {
  quick: ["nrs", "pbac", "zones", "symptoms", "medication", "sleep", "summary"],
  detail: [
    "nrs",
    "pbac",
    "zones",
    "symptoms",
    "medication",
    "sleep",
    "bowel",
    "bladder",
    "triggers",
    "helped",
    "notes",
    "summary",
  ],
  weekly: ["helped", "triggers", "notes", "summary"],
  monthly: ["pbac", "summary"],
};

const buildSteps = (mode: FlowMode, answers: Partial<DayEntry>): FlowStep[] => {
  const ids = baseSteps[mode];
  return ids
    .filter((id) => {
      if (id === "bowel" || id === "bladder") {
        const painLow = typeof answers.nrs === "number" && (answers.nrs as Nrs) < 3;
        const hasPeriod = answers.pbac && answers.pbac.dayScore > 0;
        return !(painLow && !hasPeriod);
      }
      if (id === "sleep") {
        return mode === "detail" || mode === "quick";
      }
      if (id === "pbac" && mode === "quick" && answers.pbac?.dayScore === 0) {
        return true;
      }
      return true;
    })
    .map((id) => ({ id }))
    .concat([]);
};

export const entryFlowMachine = createMachine(
  {
    id: "entryFlow",
    initial: "idle",
    context: {
      mode: "quick" as FlowMode,
      steps: buildSteps("quick", {}),
      currentIndex: 0,
      answers: {},
      suggestedUltraQuick: false,
      streakLikeYesterday: 0,
      lastSubmitted: undefined,
    } satisfies FlowContext,
    states: {
      idle: {
        on: {
          START: {
            target: "asking",
            actions: assign(({ context, event }) => {
              const last = event.lastSubmitted;
              const streak = event.streakLikeYesterday ?? context.streakLikeYesterday;
              const todayIso = new Date().toISOString().slice(0, 10);
              const baseAnswers = last && event.mode === "quick" ? pickQuickFields(last) : {};
              return {
                mode: event.mode,
                steps: buildSteps(event.mode, {}),
                currentIndex: 0,
                answers: { date: todayIso, mode: event.mode, ...baseAnswers },
                suggestedUltraQuick: streak >= 3,
                streakLikeYesterday: streak,
                lastSubmitted: last,
              };
            }),
          },
        },
      },
      asking: {
        on: {
          ANSWER: {
            actions: assign(({ context, event }) => {
              const answers = { ...context.answers, [event.field]: event.value } as Partial<DayEntry>;
              const steps = buildSteps(context.mode, answers);
              return {
                answers,
                steps,
              };
            }),
          },
          NEXT: [
            {
              target: "completed",
              cond: ({ context }) => context.currentIndex >= context.steps.length - 1,
            },
            {
              actions: assign(({ context }) => ({
                currentIndex: Math.min(context.currentIndex + 1, context.steps.length - 1),
              })),
              target: "asking",
            },
          ],
          PREV: {
            actions: assign(({ context }) => ({
              currentIndex: Math.max(context.currentIndex - 1, 0),
            })),
          },
          SET_MODE: {
            actions: assign(({ event, context }) => ({
              mode: event.mode,
              steps: buildSteps(event.mode, context.answers),
              currentIndex: 0,
            })),
          },
          APPLY_TEMPLATE: {
            actions: assign(({ context, event }) => {
              if (event.template === "symptom_free") {
                return {
                  answers: {
                    ...context.answers,
                    nrs: 0,
                    pbac: { products: [], dayScore: 0 },
                    symptoms: [],
                    zones: [],
                  },
                };
              }
              if (event.template === "pain_bleed") {
                return {
                  answers: {
                    ...context.answers,
                    symptoms: [],
                    medication: [],
                    sleep: undefined,
                  },
                  steps: buildSteps(context.mode, context.answers),
                };
              }
              const entry = event.entry ?? context.lastSubmitted;
              if (entry) {
                return {
                  answers: pickQuickFields(entry),
                };
              }
              return {};
            }),
          },
          RESET: {
            target: "idle",
          },
        },
      },
      completed: {
        type: "final",
      },
    },
  },
  {
    guards: {},
  }
);

function pickQuickFields(entry: DayEntry): Partial<DayEntry> {
  return {
    date: entry.date,
    nrs: entry.nrs,
    pbac: entry.pbac,
    zones: entry.zones,
    symptoms: entry.symptoms,
    medication: entry.medication,
    sleep: entry.sleep,
  };
}
