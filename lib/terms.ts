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
  ovulationPain: {
    label: "Vermuteter Eisprungschmerz?",
    tech: "Mittelschmerz",
    help: "Seitlicher Schmerz rund um den Eisprung",
    optional: true,
  },
  bleeding_active: {
    label: "Periode aktiv?",
    tech: "Aktive Menstruationsblutung",
    help: "Heute Blutung vorhanden?",
  },
  pbac: {
    label: "Blutungsstärke",
    tech: "PBAC – Piktorialer Blutungs-Assessment-Chart",
    help: "Zähle Produktwechsel und erfasse die Sättigung (wie voll war das Produkt beim Wechsel?)",
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
  meds: { label: "Akut-/Rescue-Medikamente", help: "Bedarfseinnahmen dokumentieren" },
  rescue: { label: "Rescue-Dosis", help: "Zusätzliche Einnahmen bei Bedarf" },
  sleep_hours: { label: "Schlafdauer (h)", help: "Gesamtschlaf letzte Nacht" },
  sleep_quality: { label: "Schlafqualität (0–10)", help: "Dein Gefühl nach dem Aufwachen" },
  awakenings: { label: "Nächtliches Erwachen", help: "Wie oft aufgewacht?" },
  bristol: { label: "Stuhlform (Bristol 1–7)", help: "Bildskala von hart (1) bis flüssig (7)" },
  bowelPain: { label: "Schmerz beim Stuhlgang (0–10)", help: "Schmerzstärke" },
  urinary_freq: { label: "Toilettengänge/Tag", help: "Wie oft urinieren?" },
  urinary_urgency: { label: "Harndrang (0–10)", help: "Starker Drang?" },
  urinary_pain: { label: "Schmerz beim Wasserlassen (0–10)", help: "Brennen/Stechen?" },
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
  mood: {
    label: "Stimmung",
    tech: "Affect/Mood Rating",
    help: "Wie war deine Stimmung heute insgesamt?",
  },
  urinaryOpt: {
    present: {
      label: "Blasensymptome heute?",
      tech: "Blasensymptome",
      help: "Gab es Beschwerden wie starken Drang oder Schmerzen?",
    },
    urgency: {
      label: "Harndrang (0–10)",
      tech: "Dranginkontinenz/LUTS",
      help: "0 = kein, 10 = sehr stark",
    },
    leaksCount: {
      label: "Ungewollter Urinverlust",
      tech: "Inkontinenz-Episoden",
      help: "Anzahl Leckagen heute",
    },
    nocturia: {
      label: "Nächtliche Toilettengänge",
      tech: "Nykturie",
      help: "Wie oft nachts urinieren?",
    },
    padsCount: {
      label: "Schutzwechsel (Anzahl)",
      tech: "Anzahl Binden/Slipeinlagen",
      help: "Wie oft musstest du heute Schutz (Pad/Tampon) wechseln?",
    },
  },
  headacheOpt: {
    present: {
      label: "Kopfschmerz/Migräne heute?",
      tech: "Migräne",
      help: "Zyklusabhängig möglich",
    },
    nrs: {
      label: "Schmerz (0–10)",
      tech: "NRS",
      help: "0 = kein, 10 = unerträglich",
    },
    aura: {
      label: "Aura (Ja/Nein)",
      tech: "Migraine with aura",
      help: "z. B. Flimmern/Sehausfälle",
    },
  },
  dizzinessOpt: {
    present: {
      label: "Schwindel heute?",
      tech: "Vertigo/Dizziness",
      help: "Schwankschwindel/Benommenheit",
    },
    nrs: {
      label: "Schwindelstärke (0–10)",
      tech: "NRS",
      help: "0 = kein, 10 = sehr stark",
    },
    orthostatic: {
      label: "Beim Aufstehen ausgelöst?",
      tech: "Orthostatische Intoleranz",
      help: "tritt beim Aufstehen auf",
    },
  },
} as const;

type TermsDefinition = typeof TERMS;

export type TermKey = {
  [K in keyof TermsDefinition]: TermsDefinition[K] extends TermDescriptor ? K : never;
}[keyof TermsDefinition];

export type ModuleTerms = {
  urinaryOpt: TermsDefinition["urinaryOpt"];
  headacheOpt: TermsDefinition["headacheOpt"];
  dizzinessOpt: TermsDefinition["dizzinessOpt"];
};

