"use client";

interface Ehp5MonthlyProps {
  value: number[];
  onChange: (values: number[]) => void;
}

const likertLabels = ["nie", "selten", "manchmal", "oft", "immer"];
const questions = [
  "Schmerzen haben meinen Alltag eingeschränkt.",
  "Ich konnte nicht so aktiv sein wie gewünscht.",
  "Ich war emotional belastet.",
  "Meine Beziehungen litten.",
  "Ich fühlte mich hilflos.",
];

export function Ehp5Monthly({ value, onChange }: Ehp5MonthlyProps) {
  const updateAnswer = (index: number, score: number) => {
    const next = [...value];
    next[index] = score;
    onChange(next);
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">EHP-5 Kurzfragebogen</h2>
        <p className="text-sm text-slate-600">Bewerte die letzten 4 Wochen. 0 = nie, 4 = immer.</p>
      </header>
      <div className="space-y-3">
        {questions.map((question, index) => (
          <fieldset key={question} className="rounded-xl bg-white p-3 shadow-sm">
            <legend className="text-sm font-semibold text-slate-700">{question}</legend>
            <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label={question}>
              {likertLabels.map((label, score) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => updateAnswer(index, score)}
                  role="radio"
                  aria-checked={value[index] === score}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                    value[index] === score ? "border-rose-500 bg-rose-100 text-rose-700" : "border-slate-200 bg-white"
                  }`}
                >
                  <span className="block text-sm font-semibold">{score}</span>
                  <span className="text-[11px] text-slate-600">{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
