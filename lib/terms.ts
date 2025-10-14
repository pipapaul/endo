export interface TermDescriptor {
  label: string;
  help: string;
  tech?: string;
  optional?: boolean;
  deviceNeeded?: string;
}

export const TERMS = {
  nrs: {
    label: "Schmerz (0–10)",
    tech: "NRS – Numerische Schmerzskala",
    help: "0 = kein Schmerz, 10 = unerträglich",
  },
  painQuality: { label: "Wie fühlt sich der Schmerz an?", help: "Mehrfachauswahl, z. B. krampfend, stechend" },
  bodyMap: { label: "Körperkarte", help: "Tippe an, wo es weh tut" },
  bleeding_active: {
    label: "Periode aktiv?",
    tech: "Aktive Menstruationsblutung",
    help: "Heute Blutung vorhanden?",
  },
  pbac: {
    label: "Blutungsstärke",
    tech: "PBAC – Piktorialer Blutungs-Assessment-Chart",
    help: "Bilderbasierter Score statt leicht/mittel/stark",
  },
  clots: { label: "Blutklümpchen", tech: "Koagel", help: "Sichtbare Klümpchen im Blut?" },
  flooding: {
    label: "Flooding / Durchbruchblutung",
    tech: "Flooding",
    help: "Sehr starke Blutung: Produkt in <1 Stunde durchweicht (PBAC +5).",
  },
  dysmenorrhea: { label: "Regelschmerzen", tech: "Dysmenorrhoe", help: "Schmerz während der Periode" },
  deepDyspareunia: {
    label: "Schmerzen beim Sex (tief)",
    tech: "Tiefe Dyspareunie",
    help: "Schmerz bei tiefem Eindringen",
  },
  pelvicPainNonMenses: {
    label: "Beckenschmerzen außerhalb der Periode",
    tech: "Chronischer Beckenschmerz",
    help: "Unterbauch-/Beckenschmerz an anderen Tagen",
  },
  dyschezia: {
    label: "Schmerzhafter Stuhlgang",
    tech: "Dyschezie",
    help: "Schmerz oder Druck beim Toilettengang",
  },
  dysuria: {
    label: "Brennen/Schmerz beim Wasserlassen",
    tech: "Dysurie",
    help: "Unangenehmes Gefühl beim Urinieren",
  },
  fatigue: {
    label: "Erschöpfung/Müdigkeit",
    tech: "Fatigue",
    help: "Außergewöhnlich müde?",
  },
  bloating: { label: "Blähbauch", tech: "Bloating", help: "Bauch wirkt aufgebläht/gespannt" },
  meds: { label: "Medikamente & Hilfen", help: "Name, Dosis, Uhrzeit" },
  rescue: { label: "Akut-/Rescue-Dosen", help: "Zusätzliche Einnahmen bei Bedarf" },
  sleep_hours: { label: "Schlafdauer (h)", help: "Gesamtschlaf letzte Nacht" },
  sleep_quality: { label: "Schlafqualität (0–10)", help: "Dein Gefühl nach dem Aufwachen" },
  awakenings: { label: "Nächtliches Erwachen", help: "Wie oft aufgewacht?" },
  bristol: { label: "Stuhlform (Bristol 1–7)", help: "Bildskala von hart (1) bis flüssig (7)" },
  bowelPain: { label: "Schmerz beim Stuhlgang (0–10)", help: "Schmerzstärke" },
  urinary_freq: { label: "Toilettengänge/Tag", help: "Wie oft urinieren?" },
  urinary_urgency: { label: "Harndrang (0–10)", help: "Starker Drang?" },
  urinary_pain: { label: "Schmerz beim Wasserlassen (0–10)", help: "Brennen/Stechen?" },
  fsfi: { label: "Sexuelle Funktion (FSFI)", help: "Kurzfragebogen zur Sexualität" },
  ehp5: {
    label: "Lebensqualität (EHP-5)",
    tech: "EHP-5 – Endometriose Health Profile",
    help: "Kurzfragebogen zu Alltag & Beschwerden",
  },
  wpai_abs: { label: "Fehlzeiten % (WPAI)", help: "Wie viel Arbeit verpasst?" },
  wpai_pre: {
    label: "Anwesenheitsminderung % (WPAI)",
    help: "Wie stark beeinträchtigt bei Anwesenheit?",
  },
  wpai_overall: { label: "Gesamtbeeinträchtigung % (WPAI)", help: "Gesamtauswirkung" },
  phq9: {
    label: "Stimmung (PHQ-9)",
    tech: "PHQ-9 – Depressionsscreening",
    help: "Kurztest für depressive Symptome",
  },
  gad7: {
    label: "Innere Unruhe/Angst (GAD-7)",
    tech: "GAD-7 – Angstskala",
    help: "Kurztest für Angst",
  },
  promis_fatigue: { label: "PROMIS Erschöpfung (T-Score)", help: "Standardisierte Skala", optional: true },
  promis_painInt: {
    label: "PROMIS Schmerz-Einfluss (T-Score)",
    help: "Wie sehr stört Schmerz",
    optional: true,
  },
  opk_done: {
    label: "Ovulationstest (LH) gemacht?",
    help: "OPK = Urintest auf LH",
    optional: true,
    deviceNeeded: "OPK",
  },
  opk_positive: {
    label: "Ovulationstest positiv?",
    help: "Hinweis auf Eisprung",
    optional: true,
    deviceNeeded: "OPK",
  },
  bbt: {
    label: "Basaltemperatur (°C)",
    help: "Morgens vor dem Aufstehen messen",
    optional: true,
    deviceNeeded: "Basalthermometer",
  },
  steps: {
    label: "Schritte",
    help: "Vom Telefon/Wearable",
    optional: true,
    deviceNeeded: "Wearable/Phone",
  },
  activeMinutes: {
    label: "Aktive Minuten",
    help: "Bewegungszeit",
    optional: true,
    deviceNeeded: "Wearable/Phone",
  },
  hrv: {
    label: "HRV (ms)",
    help: "Herzschlag-Schwankung – nicht als Schmerz-Ersatz",
    optional: true,
    deviceNeeded: "Wearable",
  },
  notesTags: { label: "Schlagworte/Trigger", help: "Kurze Begriffe für Muster & Filter" },
  notesFree: { label: "Notizen", help: "Freier Text für Besonderheiten" },
} as const;

export type TermKey = keyof typeof TERMS;

