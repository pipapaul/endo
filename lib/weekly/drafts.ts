import { getItem, removeItem, setItem } from "../persistence";
import { DEFAULT_WPAI, normalizeWpai, type WeeklyWpai } from "./wpai";

export type WeeklyDraft = {
  isoWeekKey: string;
  confirmedSummary: boolean;
  answers: {
    helped: string[];
    worsened: string[];
    nextWeekTry: string[];
    freeText?: string;
    wpai: WeeklyWpai;
  };
  progress: 0 | 1 | 2 | 3;
  updatedAt: number;
};

type PendingSave = {
  draft: WeeklyDraft;
  timeout: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  cancelled: boolean;
  resolvers: Array<(value: void) => void>;
  rejecters: Array<(reason: unknown) => void>;
};

const STORAGE_KEY_PREFIX = "endo.weekly.draft.v1:";
const SAVE_DEBOUNCE_MS = 300;

const inMemoryDrafts = new Map<string, WeeklyDraft>();
const pendingSaves = new Map<string, PendingSave>();

function storageKey(isoWeekKey: string) {
  return `${STORAGE_KEY_PREFIX}${isoWeekKey}`;
}

function cloneDraft(draft: WeeklyDraft): WeeklyDraft {
  return {
    ...draft,
    answers: {
      helped: [...draft.answers.helped],
      worsened: [...draft.answers.worsened],
      nextWeekTry: [...draft.answers.nextWeekTry],
      freeText: draft.answers.freeText,
      wpai: { ...draft.answers.wpai },
    },
  };
}

function normalizeDraft(draft: WeeklyDraft): WeeklyDraft {
  const answers =
    draft.answers ?? { helped: [], worsened: [], nextWeekTry: [], freeText: undefined, wpai: DEFAULT_WPAI };
  return {
    ...draft,
    answers: {
      helped: Array.isArray(answers.helped) ? [...answers.helped] : [],
      worsened: Array.isArray(answers.worsened) ? [...answers.worsened] : [],
      nextWeekTry: Array.isArray(answers.nextWeekTry) ? [...answers.nextWeekTry] : [],
      freeText: answers.freeText,
      wpai: normalizeWpai(answers.wpai),
    },
  };
}

function scheduleFlush(isoWeekKey: string, pending: PendingSave) {
  if (pending.timeout) {
    clearTimeout(pending.timeout);
  }
  pending.timeout = setTimeout(() => flushPendingSave(isoWeekKey, pending), SAVE_DEBOUNCE_MS);
}

function flushPendingSave(isoWeekKey: string, pending: PendingSave) {
  if (pending.inFlight) {
    scheduleFlush(isoWeekKey, pending);
    return;
  }

  if (pending.cancelled) {
    pending.timeout = null;
    const resolvers = pending.resolvers;
    pending.resolvers = [];
    pending.rejecters = [];
    resolvers.forEach((resolve) => resolve());
    pendingSaves.delete(isoWeekKey);
    return;
  }

  pending.timeout = null;
  pending.inFlight = true;

  const draftToPersist = cloneDraft(pending.draft);
  const resolvers = pending.resolvers;
  const rejecters = pending.rejecters;
  pending.resolvers = [];
  pending.rejecters = [];

  setItem(storageKey(isoWeekKey), draftToPersist)
    .then(() => {
      resolvers.forEach((resolve) => resolve());
    })
    .catch((error) => {
      rejecters.forEach((reject) => reject(error));
    })
    .finally(() => {
      pending.inFlight = false;
      if (pending.cancelled) {
        removeItem(storageKey(isoWeekKey)).catch(() => {
          // ignore cleanup errors
        });
      }
      if (!pending.timeout && pending.resolvers.length === 0 && pending.rejecters.length === 0) {
        pendingSaves.delete(isoWeekKey);
      }
    });
}

export async function loadWeeklyDraft(isoWeekKey: string): Promise<WeeklyDraft | null> {
  const pending = pendingSaves.get(isoWeekKey);
  if (pending) {
    return cloneDraft(pending.draft);
  }

  const inMemory = inMemoryDrafts.get(isoWeekKey);
  if (inMemory) {
    return cloneDraft(inMemory);
  }

  const result = await getItem<WeeklyDraft>(storageKey(isoWeekKey));
  if (!result.value) {
    return null;
  }

  const normalized = normalizeDraft(result.value);
  inMemoryDrafts.set(isoWeekKey, normalized);
  return cloneDraft(normalized);
}

export function saveWeeklyDraft(draft: WeeklyDraft): Promise<void> {
  const isoWeekKey = draft.isoWeekKey;
  const draftClone = normalizeDraft(draft);
  inMemoryDrafts.set(isoWeekKey, draftClone);

  let pending = pendingSaves.get(isoWeekKey);
  if (!pending) {
    pending = {
      draft: draftClone,
      timeout: null,
      inFlight: false,
      cancelled: false,
      resolvers: [],
      rejecters: [],
    };
    pendingSaves.set(isoWeekKey, pending);
  } else {
    pending.draft = draftClone;
    pending.cancelled = false;
  }

  const currentPending = pending;

  return new Promise((resolve, reject) => {
    currentPending.resolvers.push(resolve);
    currentPending.rejecters.push(reject);
    scheduleFlush(isoWeekKey, currentPending);
  });
}

export async function deleteWeeklyDraft(isoWeekKey: string): Promise<void> {
  const pending = pendingSaves.get(isoWeekKey);
  if (pending) {
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }
    pending.cancelled = true;
    const resolvers = pending.resolvers;
    pending.resolvers = [];
    pending.rejecters = [];
    resolvers.forEach((resolve) => resolve());
    pendingSaves.delete(isoWeekKey);
  }

  inMemoryDrafts.delete(isoWeekKey);
  await removeItem(storageKey(isoWeekKey));
}
