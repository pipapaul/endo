export type BodyRegion = { id: string; label: string };

export const BODY_REGION_GROUPS: { id: string; label: string; regions: BodyRegion[] }[] = [
  {
    id: "abdomen",
    label: "Unterleib & Becken",
    regions: [
      { id: "lower_abdomen_left", label: "Unterbauch links" },
      { id: "lower_abdomen", label: "Unterbauch Mitte" },
      { id: "lower_abdomen_right", label: "Unterbauch rechts" },
      { id: "pelvis_left", label: "Becken links" },
      { id: "pelvis_right", label: "Becken rechts" },
      { id: "uterus", label: "Uterus" },
      { id: "rectal", label: "Rektalbereich" },
      { id: "vaginal", label: "Vaginalbereich" },
    ],
  },
  {
    id: "back",
    label: "Rücken",
    regions: [
      { id: "lower_back", label: "LWS / Kreuzbein" },
      { id: "mid_back_left", label: "Mittlerer Rücken links" },
      { id: "mid_back_right", label: "Mittlerer Rücken rechts" },
      { id: "upper_back_left", label: "Oberer Rücken links" },
      { id: "upper_back_right", label: "Oberer Rücken rechts" },
    ],
  },
  {
    id: "upper-body",
    label: "Brust & Oberbauch",
    regions: [
      { id: "upper_abdomen_left", label: "Oberbauch links" },
      { id: "upper_abdomen", label: "Oberbauch Mitte" },
      { id: "upper_abdomen_right", label: "Oberbauch rechts" },
      { id: "chest_left", label: "Brust links" },
      { id: "chest_right", label: "Brust rechts" },
    ],
  },
  {
    id: "head-neck",
    label: "Kopf & Nacken",
    regions: [
      { id: "head", label: "Kopf" },
      { id: "neck", label: "Nacken / Hals" },
    ],
  },
  {
    id: "legs",
    label: "Beine & Hüfte",
    regions: [
      { id: "hip_left", label: "Hüfte links" },
      { id: "hip_right", label: "Hüfte rechts" },
      { id: "thigh_left", label: "Oberschenkel links" },
      { id: "thigh_right", label: "Oberschenkel rechts" },
      { id: "knee_left", label: "Knie links" },
      { id: "knee_right", label: "Knie rechts" },
      { id: "calf_left", label: "Unterschenkel links" },
      { id: "calf_right", label: "Unterschenkel rechts" },
      { id: "foot_left", label: "Fuß links" },
      { id: "foot_right", label: "Fuß rechts" },
    ],
  },
  {
    id: "arms",
    label: "Schultern & Arme",
    regions: [
      { id: "shoulder_left", label: "Schulter links" },
      { id: "shoulder_right", label: "Schulter rechts" },
      { id: "upper_arm_left", label: "Oberarm links" },
      { id: "upper_arm_right", label: "Oberarm rechts" },
      { id: "forearm_left", label: "Unterarm links" },
      { id: "forearm_right", label: "Unterarm rechts" },
      { id: "hand_left", label: "Hand links" },
      { id: "hand_right", label: "Hand rechts" },
    ],
  },
];

const REGION_LABELS: Record<string, string> = Object.fromEntries(
  BODY_REGION_GROUPS.flatMap((g) => g.regions.map((r) => [r.id, r.label]))
);

export function getRegionLabel(regionId: string): string {
  return REGION_LABELS[regionId] ?? regionId;
}
