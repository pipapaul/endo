"use client";

interface BristolCardsProps {
  value?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  onChange: (value: 1 | 2 | 3 | 4 | 5 | 6 | 7) => void;
}

const bristolInfo: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { label: string; hint: string }> = {
  1: { label: "Typ 1", hint: "Einzelne harte Kügelchen" },
  2: { label: "Typ 2", hint: "Wurstig, klumpig" },
  3: { label: "Typ 3", hint: "Wurstig, rissig" },
  4: { label: "Typ 4", hint: "Glatte Wurst" },
  5: { label: "Typ 5", hint: "Weiche Klümpchen" },
  6: { label: "Typ 6", hint: "Breiig" },
  7: { label: "Typ 7", hint: "Wässrig" },
};

const bristolKeys = [1, 2, 3, 4, 5, 6, 7] as const satisfies ReadonlyArray<keyof typeof bristolInfo>;

export function BristolCards({ value, onChange }: BristolCardsProps) {
  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-lg font-semibold">Bristol-Skala</h2>
        <p className="text-sm text-slate-600">Optional: Wähle den Stuhltyp.</p>
      </header>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Bristol Stool Chart">
        {bristolKeys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            role="radio"
            aria-checked={value === key}
            className={`rounded-xl border p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
              value === key ? "border-rose-500 bg-rose-100" : "border-slate-200 bg-white"
            }`}
          >
            <span className="block text-sm font-semibold text-slate-700">{bristolInfo[key].label}</span>
            <span className="text-xs text-slate-500">{bristolInfo[key].hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
