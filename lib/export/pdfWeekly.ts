import { formatIsoWeek } from "@/lib/isoWeek";
import type { WeeklyReport } from "@/lib/weekly/reports";
import { WPAI_FIELD_DEFINITIONS } from "@/lib/weekly/wpai";

const PAGE_WIDTH = 595.28; // A4 width in points (210mm)
const PAGE_HEIGHT = 841.89; // A4 height in points (297mm)
const PAGE_MARGIN = 40;
const TITLE_SIZE = 20;
const SUBTITLE_SIZE = 12;
const BODY_SIZE = 11;
const TABLE_FONT = "F2";
const BODY_FONT = "F1";

const PDF_HEADER = "%PDF-1.4\n%âãÏÓ\n";

type TextRun = {
  text: string;
  font: "F1" | "F2";
  size: number;
  x: number;
  y: number;
};

function sanitizeForPdf(raw: string, preserveWhitespace = false): string {
  const replacements: Record<string, string> = {
    ä: "ae",
    ö: "oe",
    ü: "ue",
    Ä: "Ae",
    Ö: "Oe",
    Ü: "Ue",
    ß: "ss",
  };
  const normalized = raw
    .replace(/[äöüÄÖÜß]/g, (match) => replacements[match] ?? match)
    .replace(/[\r]+/g, "")
    .replace(/[\t]+/g, " ");
  return preserveWhitespace ? normalized : normalized.trim();
}

function escapePdfText(raw: string, preserveWhitespace = false): string {
  return sanitizeForPdf(raw, preserveWhitespace)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function formatIsoDateLabel(dateISO: string): string {
  const [year, month, day] = dateISO.split("-").map((value) => Number(value));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return dateISO;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.toLocaleDateString("de-DE", { weekday: "short" });
  const formatted = date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  return `${weekday.replace(".", "")} ${formatted}`;
}

function formatNumber(value: number | null, fractionDigits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return value.toFixed(fractionDigits);
}

function deriveHighlights(report: WeeklyReport): string[] {
  const { stats } = report;
  const highlights: string[] = [];

  if (stats.notes.medicationChange) {
    highlights.push("Medikationsaenderung in dieser Woche dokumentiert.");
  }
  if (stats.notes.sleepBelowUsual) {
    highlights.push("Schlafqualitaet lag unter dem gewohnten Niveau.");
  }
  if (typeof stats.avgPain === "number" && stats.avgPain >= 6) {
    highlights.push(`Durchschnittlicher Schmerz lag bei ${stats.avgPain.toFixed(1)} (Skala 0-10).`);
  }
  if (stats.badDaysCount >= 3) {
    highlights.push(`Es wurden ${stats.badDaysCount} Tage mit starken Schmerzen erfasst.`);
  }

  if (!highlights.length) {
    highlights.push("Keine markierten Highlights vermerkt.");
  }

  return highlights;
}

function buildTextRuns(report: WeeklyReport): TextRun[] {
  const runs: TextRun[] = [];
  const stats = report.stats;
  const answers = report.answers;

  let cursorY = PAGE_HEIGHT - PAGE_MARGIN;

  const pushText = (
    text: string,
    size: number,
    font: "F1" | "F2" = BODY_FONT,
    lineHeight = size * 1.35,
    preserveWhitespace = false
  ) => {
    runs.push({ text: escapePdfText(text, preserveWhitespace), font, size, x: PAGE_MARGIN, y: cursorY });
    cursorY -= lineHeight;
  };

  const pushLines = (
    lines: string[],
    size: number,
    font: "F1" | "F2" = BODY_FONT,
    lineHeight = size * 1.35
  ) => {
    lines.forEach((line) => pushText(line, size, font, lineHeight));
  };

  const addSpacer = (amount = 8) => {
    cursorY -= amount;
  };

  pushText("Woechentlicher Bericht", TITLE_SIZE, BODY_FONT, TITLE_SIZE * 1.2);

  const subtitleParts: string[] = [];
  const isoKey = report.isoWeekKey || stats.isoWeekKey;
  if (isoKey) {
    subtitleParts.push(`Kalenderwoche ${isoKey}`);
  }
  if (stats.startISO && stats.endISO) {
    const startLabel = formatIsoDateLabel(stats.startISO);
    const endLabel = formatIsoDateLabel(stats.endISO);
    subtitleParts.push(`${startLabel} bis ${endLabel}`);
  }
  pushText(subtitleParts.join(" · "), SUBTITLE_SIZE, BODY_FONT, SUBTITLE_SIZE * 1.5);

  addSpacer(4);
  pushText("Kennzahlen", BODY_SIZE + 1);

  const metrics = [
    `* Durchschnittlicher Schmerz: ${formatNumber(stats.avgPain)}`,
    `* Hoechster Schmerz: ${formatNumber(stats.maxPain)}`,
    `* Tage mit starken Schmerzen (>=6): ${stats.badDaysCount}`,
    `* Tage mit Blutung: ${stats.bleedingDaysCount}`,
  ];
  pushLines(metrics, BODY_SIZE);

  addSpacer();
  pushText("Highlights", BODY_SIZE + 1);
  const highlights = deriveHighlights(report);
  pushLines(highlights.map((item) => `* ${item}`), BODY_SIZE);

  addSpacer();
  pushText("Schmerzverlauf", BODY_SIZE + 1);
  const tableHeader = `${"Datum".padEnd(18)} | Schmerz (0-10)`;
  pushText(tableHeader, BODY_SIZE, TABLE_FONT, BODY_SIZE * 1.2, true);
  pushText("------------------+--------------", BODY_SIZE, TABLE_FONT, BODY_SIZE * 1.2, true);
  stats.sparkline.forEach((point) => {
    const dateLabel = formatIsoDateLabel(point.dateISO).padEnd(18);
    const painLabel =
      typeof point.pain === "number" && Number.isFinite(point.pain) ? point.pain.toFixed(1) : "-";
    pushText(`${dateLabel} | ${painLabel.padStart(6)}`, BODY_SIZE, TABLE_FONT, BODY_SIZE * 1.2, true);
  });

  addSpacer();
  pushText("Leitfragen", BODY_SIZE + 1);

  const sections: Array<{ title: string; items: string[] }> = [
    { title: "Was hat geholfen?", items: Array.isArray(answers.helped) ? answers.helped : [] },
    { title: "Was hat verschlechtert?", items: Array.isArray(answers.worsened) ? answers.worsened : [] },
    {
      title: "Was moechte ich naechste Woche ausprobieren?",
      items: Array.isArray(answers.nextWeekTry) ? answers.nextWeekTry : [],
    },
  ];

  sections.forEach((section) => {
    pushText(section.title, BODY_SIZE, BODY_FONT, BODY_SIZE * 1.4);
    if (section.items.length === 0) {
      pushText("- Keine Angaben gespeichert.", BODY_SIZE);
    } else {
      section.items.forEach((item) => {
        pushText(`- ${item}`, BODY_SIZE);
      });
    }
    addSpacer(2);
  });

  addSpacer();
  pushText("WPAI – 7-Tage-Rueckblick", BODY_SIZE + 1);
  WPAI_FIELD_DEFINITIONS.forEach((field) => {
    const rawValue = answers.wpai?.[field.key];
    const formatted = typeof rawValue === "number" ? `${formatNumber(rawValue, 0)} %` : "-";
    pushText(`${field.label}: ${formatted}`, BODY_SIZE);
    pushText(`  ${field.description}`, BODY_SIZE - 1, BODY_FONT, (BODY_SIZE - 1) * 1.35);
  });

  if (answers.freeText) {
    pushText("Weitere Gedanken", BODY_SIZE);
    const notes = sanitizeForPdf(answers.freeText, true).split("\n");
    notes.forEach((line) => {
      pushText(line, BODY_SIZE);
    });
  }

  addSpacer();
  pushText(`Erstellt mit EndoTrack · ${new Date().toLocaleDateString("de-DE")}`, BODY_SIZE - 1, BODY_FONT, BODY_SIZE * 1.2);

  return runs;
}

function buildContentStream(runs: TextRun[]): string {
  return runs
    .map((run) => `BT /${run.font} ${run.size.toFixed(2)} Tf ${run.x.toFixed(2)} ${run.y.toFixed(2)} Td (${run.text}) Tj ET`)
    .join("\n");
}

function buildPdfDocument(content: string): Blob {
  const encoder = new TextEncoder();
  const contentStream = `${content}\n`;
  const contentBytes = encoder.encode(contentStream);

  const objects: Array<{ id: number; body: string }> = [
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    { id: 2, body: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    {
      id: 3,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    },
    {
      id: 4,
      body: `<< /Length ${contentBytes.length} >>\nstream\n${contentStream}endstream`,
    },
    { id: 5, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
    { id: 6, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>" },
  ];

  const headerBytes = encoder.encode(PDF_HEADER);
  let offset = headerBytes.length;
  const offsetsById: Record<number, number> = {};
  const objectStrings = objects.map((object) => `${object.id} 0 obj\n${object.body}\nendobj\n`);
  const objectBytes = objectStrings.map((entry) => encoder.encode(entry));

  objectBytes.forEach((bytes, index) => {
    const objectId = objects[index].id;
    offsetsById[objectId] = offset;
    offset += bytes.length;
  });

  const totalObjects = objects.length;
  const xrefStart = offset;
  let xref = `xref\n0 ${totalObjects + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let id = 1; id <= totalObjects; id += 1) {
    const objectOffset = offsetsById[id];
    const padded = objectOffset.toString().padStart(10, "0");
    xref += `${padded} 00000 n \n`;
  }
  const xrefBytes = encoder.encode(xref);
  offset += xrefBytes.length;

  const trailer = `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([PDF_HEADER, ...objectStrings, xref, trailer], { type: "application/pdf" });
}

export async function exportWeeklyReportPDF(report: WeeklyReport): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("PDF-Export steht nur im Browser zur Verfuegung.");
  }

  const runs = buildTextRuns(report);
  const content = buildContentStream(runs);
  const pdfBlob = buildPdfDocument(content);

  const blobUrl = URL.createObjectURL(pdfBlob);
  const downloadLink = document.createElement("a");
  const fallbackKey = formatIsoWeek(new Date().getFullYear(), 1);
  const fileName = `endo-weekly-${(report.isoWeekKey || fallbackKey).replace(/[^a-zA-Z0-9-_]/g, "-")}.pdf`;
  downloadLink.href = blobUrl;
  downloadLink.download = fileName;
  downloadLink.style.display = "none";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 1000);

  return pdfBlob;
}
