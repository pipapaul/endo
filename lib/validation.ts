import { z } from "zod";

import { DailyEntry, MonthlyEntry, WeeklyEntry } from "./types";

const zInt01 = z.number().int().min(0).max(10);
const zNonNeg = z.number().int().min(0);

const formatZodPath = (path: (string | number)[]) => {
  if (!path.length) return "dailyEntry";
  return path
    .map((segment) => (typeof segment === "number" ? `[${segment}]` : segment))
    .reduce((acc, segment) => {
      if (!acc) return segment;
      return segment.startsWith("[") ? `${acc}${segment}` : `${acc}.${segment}`;
    }, "");
};

export const zDailyEntry = z
  .object({
    urinaryOpt: z
      .object({
        present: z.boolean().optional(),
        urgency: zInt01.optional(),
        leaksCount: zNonNeg.optional(),
        nocturia: zNonNeg.optional(),
        padsCount: zNonNeg.optional(),
      })
      .optional(),
    headacheOpt: z
      .object({
        present: z.boolean().optional(),
        nrs: zInt01.optional(),
        aura: z.boolean().optional(),
        meds: z
          .array(
            z.object({
              name: z.string().min(1),
              doseMg: zNonNeg.optional(),
              time: z.string().optional(),
            })
          )
          .optional(),
      })
      .optional()
      .refine((value) => !value || !value.present || value.nrs !== undefined, {
        message: "Bitte Kopfschmerz-Stärke (0–10) angeben",
        path: ["headacheOpt", "nrs"],
      }),
    dizzinessOpt: z
      .object({
        present: z.boolean().optional(),
        nrs: zInt01.optional(),
        orthostatic: z.boolean().optional(),
      })
      .optional()
      .refine((value) => !value || !value.present || value.nrs !== undefined, {
        message: "Bitte Schwindel-Stärke (0–10) angeben",
        path: ["dizzinessOpt", "nrs"],
      }),
  })
  .passthrough();

export interface ValidationIssue {
  path: string;
  message: string;
}

const intRange = (value: number | undefined | null, min: number, max: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

const nonNegative = (value: number | undefined | null) =>
  typeof value === "number" && value >= 0;

export function validateDailyEntry(entry: DailyEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
    issues.push({ path: "date", message: "Datum muss im Format YYYY-MM-DD vorliegen." });
  }

  const hasValidPainNRS = intRange(entry.painNRS, 0, 10);
  const hasValidImpactNRS = intRange(entry.impactNRS, 0, 10);

  if (!hasValidPainNRS && !hasValidImpactNRS) {
    issues.push({
      path: "impactNRS",
      message: "Bitte gib an, wie stark dich der Schmerz heute insgesamt belastet hat (0 bis 10).",
    });
  }

  const allowedPainQuality = new Set([
    "krampfend",
    "stechend",
    "brennend",
    "dumpf",
    "ziehend",
    "anders",
    "Migräne",
    "Migräne mit Aura",
  ]);
  const allowedPainTimeOfDay = new Set(["morgens", "mittags", "abends"]);

  if (Array.isArray(entry.painRegions) && entry.painRegions.length > 0) {
    entry.painRegions.forEach((region, idx) => {
      if (!region || typeof region !== "object") {
        issues.push({ path: `painRegions[${idx}]`, message: "Ungültiger Schmerzbereich." });
        return;
      }

      if (typeof region.regionId !== "string" || !region.regionId) {
        issues.push({ path: `painRegions[${idx}].regionId`, message: "Schmerzregion muss gesetzt sein." });
      }

      if (!intRange(region.nrs, 0, 10)) {
        issues.push({
          path: `painRegions[${idx}].nrs`,
          message: "Schmerzintensität pro Region muss eine ganze Zahl zwischen 0 und 10 sein.",
        });
      }

      if (!Array.isArray(region.qualities)) {
        issues.push({
          path: `painRegions[${idx}].qualities`,
          message: "Schmerzcharakter muss als Liste vorliegen.",
        });
      } else {
        region.qualities.forEach((q, qIndex) => {
          if (!allowedPainQuality.has(q)) {
            issues.push({
              path: `painRegions[${idx}].qualities[${qIndex}]`,
              message: "Ungültige Schmerzqualität ausgewählt.",
            });
          }
        });
      }

      const granularity = region.granularity ?? (region.timeOfDay?.length ? "dritteltag" : "tag");
      if (granularity !== "tag" && granularity !== "dritteltag") {
        issues.push({
          path: `painRegions[${idx}].granularity`,
          message: "Ungültige Granularität für Schmerzangabe.",
        });
      }

      if (granularity === "dritteltag") {
        if (!Array.isArray(region.timeOfDay) || region.timeOfDay.length === 0) {
          issues.push({
            path: `painRegions[${idx}].timeOfDay`,
            message: "Bitte wähle mindestens einen Zeitraum (morgens/mittags/abends).",
          });
        } else {
          region.timeOfDay.forEach((time, timeIndex) => {
            if (!allowedPainTimeOfDay.has(time)) {
              issues.push({
                path: `painRegions[${idx}].timeOfDay[${timeIndex}]`,
                message: "Ungültiger Zeitraum gewählt.",
              });
            }
          });
        }
      } else if (Array.isArray(region.timeOfDay) && region.timeOfDay.length > 0) {
        issues.push({
          path: `painRegions[${idx}].granularity`,
          message: "Zeitraum-Auswahl erfordert die Granularität 'dritteltag'.",
        });
      }
    });
  } else {
    // Rückfall auf alte Felder für sehr alte Einträge oder falls Nutzerin oder Nutzer
    // aus irgendeinem Grund noch nichts in painRegions eingetragen hat

    entry.painQuality.forEach((quality, index) => {
      if (!allowedPainQuality.has(quality)) {
        issues.push({
          path: `painQuality[${index}]`,
          message: "Ungültige Schmerzqualität ausgewählt.",
        });
      }
    });

    if (!Array.isArray(entry.painMapRegionIds)) {
      issues.push({ path: "painMapRegionIds", message: "Schmerzorte müssen als Liste gespeichert werden." });
    }
  }

  if (entry.ovulationPain) {
    const { side, intensity } = entry.ovulationPain;
    const allowedSides = new Set(["links", "rechts", "beidseitig", "unsicher"]);
    if (side !== undefined && !allowedSides.has(side)) {
      issues.push({ path: "ovulationPain.side", message: "Bitte Seite Links/Rechts/Beidseitig/Unsicher wählen." });
    }
    if (side === undefined && intensity !== undefined) {
      issues.push({
        path: "ovulationPain.side",
        message: "Bitte zuerst eine Seite auswählen oder Intensität entfernen.",
      });
    }
    if (intensity !== undefined && !intRange(intensity, 0, 10)) {
      issues.push({
        path: "ovulationPain.intensity",
        message: "Intensität muss als ganze Zahl zwischen 0 und 10 erfasst werden.",
      });
    }
  }

  if (entry.bleeding.isBleeding) {
    if (!nonNegative(entry.bleeding.pbacScore)) {
      issues.push({
        path: "bleeding.pbacScore",
        message: "PBAC-Score muss bei aktiver Blutung als nicht-negative Zahl vorliegen.",
      });
    }
    if (entry.bleeding.clots !== undefined && typeof entry.bleeding.clots !== "boolean") {
      issues.push({ path: "bleeding.clots", message: "Koagel-Angabe muss Ja/Nein sein." });
    }
    if (entry.bleeding.flooding !== undefined && typeof entry.bleeding.flooding !== "boolean") {
      issues.push({ path: "bleeding.flooding", message: "Flooding muss als Ja/Nein erfasst werden." });
    }
  } else {
    if (entry.bleeding.pbacScore !== undefined) {
      issues.push({
        path: "bleeding.pbacScore",
        message: "PBAC-Score darf nur angegeben werden, wenn eine Blutung vorliegt.",
      });
    }
    if (entry.bleeding.clots !== undefined) {
      issues.push({
        path: "bleeding.clots",
        message: "Koagel dürfen nur bei aktiver Blutung dokumentiert werden.",
      });
    }
    if (entry.bleeding.flooding !== undefined) {
      issues.push({
        path: "bleeding.flooding",
        message: "Flooding darf nur bei aktiver Blutung dokumentiert werden.",
      });
    }
  }

  const symptomKeys = [
    "dysmenorrhea",
    "deepDyspareunia",
    "pelvicPainNonMenses",
    "dyschezia",
    "dysuria",
    "fatigue",
    "bloating",
  ] as const;

  symptomKeys.forEach((key) => {
    const symptom = entry.symptoms[key];
    if (!symptom) return;
    if (typeof symptom.present !== "boolean") {
      issues.push({ path: `symptoms.${key}.present`, message: "Symptom muss mit Ja/Nein erfasst werden." });
    }
    if (symptom.present) {
      if (!intRange(symptom.score, 0, 10)) {
        issues.push({
          path: `symptoms.${key}.score`,
          message: "Symptomschwere muss als ganze Zahl zwischen 0 und 10 erfasst werden.",
        });
      }
    } else if (symptom.score !== undefined) {
      issues.push({
        path: `symptoms.${key}.score`,
        message: "Wenn das Symptom nicht vorliegt, darf kein Score angegeben werden.",
      });
    }
  });

  const rescueTimeRegex = /^\d{2}:\d{2}$/;
  (entry.rescueMeds ?? []).forEach((med, index) => {
    if (!med.name) {
      issues.push({ path: `rescueMeds[${index}].name`, message: "Medikament benötigt eine Bezeichnung." });
    }
    if (med.doseMg !== undefined && (!Number.isFinite(med.doseMg) || med.doseMg < 0)) {
      issues.push({
        path: `rescueMeds[${index}].doseMg`,
        message: "Dosen müssen als nicht-negative Zahl in mg angegeben werden.",
      });
    }
    if (med.time && !rescueTimeRegex.test(med.time)) {
      issues.push({
        path: `rescueMeds[${index}].time`,
        message: "Uhrzeit bitte im Format HH:MM angeben.",
      });
    }
  });

  if (entry.sleep) {
    const { hours, quality, awakenings } = entry.sleep;
    if (hours !== undefined && (hours < 0 || hours > 24)) {
      issues.push({ path: "sleep.hours", message: "Schlafdauer muss zwischen 0 und 24 Stunden liegen." });
    }
    if (quality !== undefined && !intRange(quality, 0, 10)) {
      issues.push({ path: "sleep.quality", message: "Schlafqualität muss 0–10 (Ganzzahl) sein." });
    }
    if (awakenings !== undefined && (!Number.isInteger(awakenings) || awakenings < 0)) {
      issues.push({
        path: "sleep.awakenings",
        message: "Nächtliche Aufwachphasen müssen als nicht-negative Ganzzahl erfasst werden.",
      });
    }
  }

  if (entry.gi) {
    if (entry.gi.bristolType !== undefined && ![1, 2, 3, 4, 5, 6, 7].includes(entry.gi.bristolType)) {
      issues.push({ path: "gi.bristolType", message: "Bristol-Score muss zwischen 1 und 7 liegen." });
    }
  }

  if (entry.urinary) {
    const { freqPerDay, urgency } = entry.urinary;
    if (freqPerDay !== undefined && (!Number.isInteger(freqPerDay) || freqPerDay < 0)) {
      issues.push({
        path: "urinary.freqPerDay",
        message: "Miktionen/Tag müssen als nicht-negative Ganzzahl erfasst werden.",
      });
    }
    if (urgency !== undefined && !intRange(urgency, 0, 10)) {
      issues.push({ path: "urinary.urgency", message: "Drang muss 0–10 (Ganzzahl) sein." });
    }
  }

  if (entry.activity) {
    if (entry.activity.steps !== undefined && (!Number.isInteger(entry.activity.steps) || entry.activity.steps < 0)) {
      issues.push({ path: "activity.steps", message: "Schritte müssen als nicht-negative Ganzzahl angegeben werden." });
    }
    if (
      entry.activity.activeMinutes !== undefined &&
      (!Number.isInteger(entry.activity.activeMinutes) || entry.activity.activeMinutes < 0)
    ) {
      issues.push({
        path: "activity.activeMinutes",
        message: "Aktivminuten müssen als nicht-negative Ganzzahl angegeben werden.",
      });
    }
  }

  if (entry.exploratory?.hrvRmssdMs !== undefined && (!Number.isFinite(entry.exploratory.hrvRmssdMs) || entry.exploratory.hrvRmssdMs < 0)) {
    issues.push({
      path: "exploratory.hrvRmssdMs",
      message: "HRV (RMSSD) muss als nicht-negative Zahl vorliegen.",
    });
  }

  if (entry.ovulation) {
    if (entry.ovulation.lhTime && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(entry.ovulation.lhTime)) {
      issues.push({ path: "ovulation.lhTime", message: "LH-Test-Zeit muss ISO-Datetime sein." });
    }
    if (entry.ovulation.bbtCelsius !== undefined) {
      const value = entry.ovulation.bbtCelsius;
      const rounded = Math.round(value * 100) / 100;
      if (!Number.isFinite(value) || value < 34 || value > 38) {
        issues.push({ path: "ovulation.bbtCelsius", message: "BBT muss zwischen 34.00 °C und 38.00 °C liegen." });
      }
      if (Math.abs(value - rounded) > 1e-6) {
        issues.push({ path: "ovulation.bbtCelsius", message: "BBT muss mit zwei Nachkommastellen erfasst werden." });
      }
    }
  }

  const zodResult = zDailyEntry.safeParse(entry);
  if (!zodResult.success) {
    zodResult.error.issues.forEach((issue) => {
      issues.push({ path: formatZodPath(issue.path), message: issue.message });
    });
  }

  return issues;
}

export function validateWeeklyEntry(entry: WeeklyEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!/^\d{4}-W\d{2}$/.test(entry.isoWeek)) {
    issues.push({ path: "isoWeek", message: "Kalenderwoche muss im Format JJJJ-WXX angegeben werden." });
  }

  if (entry.function) {
    const { wpaiAbsenteeismPct, wpaiPresenteeismPct, wpaiOverallPct } = entry.function;
    const inRange = (v: number | undefined) => typeof v === "number" && v >= 0 && v <= 100;
    if (wpaiAbsenteeismPct !== undefined && !inRange(wpaiAbsenteeismPct)) {
      issues.push({ path: "function.wpaiAbsenteeismPct", message: "WPAI Absenzen müssen 0–100 % sein." });
    }
    if (wpaiPresenteeismPct !== undefined && !inRange(wpaiPresenteeismPct)) {
      issues.push({ path: "function.wpaiPresenteeismPct", message: "WPAI Präsenzminderung muss 0–100 % sein." });
    }
    if (wpaiOverallPct !== undefined && !inRange(wpaiOverallPct)) {
      issues.push({ path: "function.wpaiOverallPct", message: "WPAI Gesamtbeeinträchtigung muss 0–100 % sein." });
    }
  }

  return issues;
}

export function validateMonthlyEntry(entry: MonthlyEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!/^\d{4}-\d{2}$/.test(entry.month)) {
    issues.push({ path: "month", message: "Monat muss im Format YYYY-MM angegeben werden." });
  }

  if (entry.qol?.ehp5Items) {
    if (entry.qol.ehp5Items.length !== 5) {
      issues.push({ path: "qol.ehp5Items", message: "EHP-5 benötigt fünf Items (0–4)." });
    }
    entry.qol.ehp5Items.forEach((value, index) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 4)) {
        issues.push({ path: `qol.ehp5Items[${index}]`, message: "EHP-5 Items müssen Werte von 0 bis 4 nutzen." });
      }
    });
  }
  if (entry.qol?.ehp5Total !== undefined && (!Number.isInteger(entry.qol.ehp5Total) || entry.qol.ehp5Total < 0 || entry.qol.ehp5Total > 20)) {
    issues.push({ path: "qol.ehp5Total", message: "EHP-5 Gesamtscore muss zwischen 0 und 20 liegen." });
  }
  if (
    entry.qol?.ehp5Transformed !== undefined &&
    (!Number.isFinite(entry.qol.ehp5Transformed) || entry.qol.ehp5Transformed < 0 || entry.qol.ehp5Transformed > 100)
  ) {
    issues.push({ path: "qol.ehp5Transformed", message: "EHP-5 Transform muss zwischen 0 und 100 liegen." });
  }

  if (entry.mental) {
    const { phq9, gad7, phq9Items, gad7Items, phq9Severity, gad7Severity } = entry.mental;
    if (phq9Items) {
      if (phq9Items.length !== 9) {
        issues.push({ path: "mental.phq9Items", message: "PHQ-9 benötigt neun Items (0–3)." });
      }
      phq9Items.forEach((value, index) => {
        if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 3)) {
          issues.push({ path: `mental.phq9Items[${index}]`, message: "PHQ-9 Items müssen Werte von 0 bis 3 nutzen." });
        }
      });
    }
    if (phq9 !== undefined && (!Number.isInteger(phq9) || phq9 < 0 || phq9 > 27)) {
      issues.push({ path: "mental.phq9", message: "PHQ-9 muss zwischen 0 und 27 liegen." });
    }
    if (phq9Severity && !["mild", "moderat", "hoch"].includes(phq9Severity)) {
      issues.push({ path: "mental.phq9Severity", message: "PHQ-9 Ampel muss mild/moderat/hoch sein." });
    }
    if (gad7Items) {
      if (gad7Items.length !== 7) {
        issues.push({ path: "mental.gad7Items", message: "GAD-7 benötigt sieben Items (0–3)." });
      }
      gad7Items.forEach((value, index) => {
        if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 3)) {
          issues.push({ path: `mental.gad7Items[${index}]`, message: "GAD-7 Items müssen Werte von 0 bis 3 nutzen." });
        }
      });
    }
    if (gad7 !== undefined && (!Number.isInteger(gad7) || gad7 < 0 || gad7 > 21)) {
      issues.push({ path: "mental.gad7", message: "GAD-7 muss zwischen 0 und 21 liegen." });
    }
    if (gad7Severity && !["mild", "moderat", "hoch"].includes(gad7Severity)) {
      issues.push({ path: "mental.gad7Severity", message: "GAD-7 Ampel muss mild/moderat/hoch sein." });
    }
  }

  if (entry.promis) {
    const { fatigueT, painInterferenceT } = entry.promis;
    const validT = (v: number | undefined) => typeof v === "number" && v >= 0 && v <= 100;
    if (fatigueT !== undefined && !validT(fatigueT)) {
      issues.push({ path: "promis.fatigueT", message: "PROMIS Fatigue T-Score muss zwischen 0 und 100 liegen." });
    }
    if (painInterferenceT !== undefined && !validT(painInterferenceT)) {
      issues.push({ path: "promis.painInterferenceT", message: "PROMIS Pain Interference T-Score muss zwischen 0 und 100 liegen." });
    }
  }

  return issues;
}
