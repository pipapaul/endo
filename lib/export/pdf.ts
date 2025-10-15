import { PDFDocument, StandardFonts } from "pdf-lib";

import type { DayEntry, ExportPdfType, MonthEntry } from "@/lib/types";

interface ExportOptions {
  type: ExportPdfType;
  dayEntries: DayEntry[];
  monthEntries: MonthEntry[];
  monthsBack?: number;
}

export async function generatePdf({ type, dayEntries, monthEntries, monthsBack = 6 }: ExportOptions): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4 portrait
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();
  const margin = 48;
  let cursorY = height - margin;

  const drawText = (text: string, size = 12, offsetX = 0) => {
    page.drawText(text, {
      x: margin + offsetX,
      y: cursorY,
      size,
      font,
    });
    cursorY -= size + 6;
  };

  drawText(`EndoTrack Export – ${type}`, 18);
  drawText(new Date().toLocaleDateString("de-DE"), 10);
  cursorY -= 6;

  if (type === "arzt-1pager") {
    const last30 = dayEntries
      .filter((entry) => daysBetween(entry.date, new Date()) <= 30)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const pbacSum = last30.reduce((sum, entry) => sum + (entry.pbac?.dayScore ?? 0), 0);
    const avgPain = last30.length
      ? (last30.reduce((sum, entry) => sum + (entry.nrs ?? 0), 0) / last30.length).toFixed(1)
      : "–";
    drawText(`Zeitraum: letzte 30 Tage (${last30.length} Einträge)`, 12);
    drawText(`Durchschnittlicher Schmerz (NRS): ${avgPain}`, 12);
    drawText(`PBAC Summe: ${pbacSum}`, 12);
    drawText("Top-Symptome:", 12);
    const symptomMap = new Map<string, number>();
    last30.forEach((entry) => {
      (entry.symptoms ?? []).forEach((symptom) => {
        symptomMap.set(symptom.label, (symptomMap.get(symptom.label) ?? 0) + symptom.intensity);
      });
    });
    const topSymptoms = Array.from(symptomMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    topSymptoms.forEach(([label, total]) => drawText(`• ${label}: ${total} Punkte`, 11, 12));
    cursorY -= 12;
    drawText("Medikationen:", 12);
    const meds = new Set<string>();
    last30.forEach((entry) => entry.medication?.forEach((med) => meds.add(med.name)));
    drawText(meds.size ? Array.from(meds).join(", ") : "Keine Angaben", 11, 12);
    cursorY -= 12;
    drawText("Notizen (Kurz):", 12);
    last30
      .filter((entry) => entry.notes)
      .slice(-5)
      .forEach((entry) => drawText(`${entry.date}: ${entry.notes}`, 10, 12));
  }

  if (type === "pbac") {
    drawText("PBAC Monatsübersicht", 14);
    monthEntries.slice(0, monthsBack).forEach((month) => {
      drawText(`${month.month}: ${month.pbacTotal ?? 0}`, 12, 12);
    });
    cursorY -= 12;
    drawText("Tageswerte:", 12);
    dayEntries
      .filter((entry) => entry.pbac?.dayScore)
      .forEach((entry) => drawText(`${entry.date}: ${entry.pbac?.dayScore}`, 10, 12));
  }

  if (type === "timeline6m") {
    const recent = dayEntries
      .filter((entry) => daysBetween(entry.date, new Date()) <= monthsBack * 30)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    drawText(`Timeline (ca. ${monthsBack} Monate)`, 14);
    recent.forEach((entry) => {
      const summary = [
        `NRS ${entry.nrs ?? "–"}`,
        `PBAC ${entry.pbac?.dayScore ?? 0}`,
        entry.medication?.length ? `${entry.medication.length} Meds` : undefined,
      ]
        .filter(Boolean)
        .join(" · ");
      drawText(`${entry.date}: ${summary}`, 11, 12);
    });
  }

  const bytes = await pdf.save();
  const cleanBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(cleanBuffer).set(bytes);
  return new Blob([cleanBuffer], { type: "application/pdf" });
}

function daysBetween(dateString: string, now: Date) {
  const entryDate = new Date(dateString);
  const diff = now.getTime() - entryDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
