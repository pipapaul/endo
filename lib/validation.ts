import { z } from "zod";

import type { DayEntry, MonthEntry, WeekEntry } from "./types";

export interface ValidationIssue {
  path: string;
  message: string;
}

const nrsSchema = z.number().int().min(0).max(10);
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const isoMonth = /^\d{4}-\d{2}$/;
const isoWeek = /^\d{4}-W\d{2}$/;

const pbacProductSchema = z.object({
  kind: z.enum(["pad", "tampon", "cup"]),
  fill: z.enum(["low", "mid", "high"]),
  quantity: z.number().int().min(1).optional(),
});

const dayEntrySchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(isoDate),
  mode: z.enum(["quick", "detail"]),
  nrs: nrsSchema.optional(),
  pbac: z
    .object({
      products: z.array(pbacProductSchema),
      clots: z.enum(["none", "small", "large"]).optional(),
      flooding: z.boolean().optional(),
      dayScore: z.number().int().min(0),
    })
    .optional(),
  zones: z.array(z.string()).optional(),
  symptoms: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        intensity: nrsSchema,
      })
    )
    .max(6)
    .optional(),
  medication: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1),
        dose: z.string().max(120).optional(),
        ts: z.number().int().min(0),
      })
    )
    .optional(),
  sleep: nrsSchema.optional(),
  bowel: z
    .object({
      bristol: z.number().int().min(1).max(7).optional(),
      dyschezia: z.boolean().optional(),
    })
    .optional(),
  bladder: z
    .object({
      dysuria: z.boolean().optional(),
    })
    .optional(),
  triggerTags: z.array(z.string()).optional(),
  helped: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});

const weekEntrySchema = z.object({
  id: z.string(),
  isoWeek: z.string().regex(isoWeek),
  helped: z.array(z.string()).optional(),
  triggerTags: z.array(z.string()).optional(),
  interventions: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        helpfulness: nrsSchema,
      })
    )
    .optional(),
  notes: z.string().max(500).optional(),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});

const monthEntrySchema = z.object({
  id: z.string(),
  month: z.string().regex(isoMonth),
  pbacTotal: z.number().int().min(0).optional(),
  ehp5: z.array(z.number().int().min(0).max(4)).length(5).optional(),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});

const formatPath = (segments: (string | number)[]) =>
  segments
    .map((segment) => (typeof segment === "number" ? `[${segment}]` : segment))
    .join(".")
    .replace(/\.\[/g, "[");

export function validateDayEntry(entry: DayEntry): ValidationIssue[] {
  const result = dayEntrySchema.safeParse(entry);
  if (result.success) {
    const issues: ValidationIssue[] = [];
    if (entry.pbac && entry.pbac.dayScore > 100) {
      issues.push({
        path: "pbac.dayScore",
        message: "PBAC-Wert prüfen: über 100 gilt als starke Blutung.",
      });
    }
    if (entry.nrs !== undefined && entry.nrs >= 9) {
      const hasRescueMed = (entry.medication ?? []).some((med) => /rescue|schmerz/i.test(med.name));
      if (!hasRescueMed) {
        issues.push({
          path: "medication",
          message: "Sehr starke Schmerzen? Hol dir Hilfe, wenn du unsicher bist.",
        });
      }
    }
    return issues;
  }

  return result.error.issues.map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message,
  }));
}

export function validateWeekEntry(entry: WeekEntry): ValidationIssue[] {
  const result = weekEntrySchema.safeParse(entry);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message,
  }));
}

export function validateMonthEntry(entry: MonthEntry): ValidationIssue[] {
  const result = monthEntrySchema.safeParse(entry);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message,
  }));
}
