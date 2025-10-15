"use client";

interface ConsentDialogProps {
  kind: "FSFI";
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function ConsentDialog({ kind, open, onAccept, onDecline }: ConsentDialogProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="consent-title" className="text-xl font-semibold text-slate-900">
          Sensible Fragen (optional)
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          Diese Angaben sind privat und bleiben auf deinem Gerät. Du kannst jederzeit stoppen oder löschen.
        </p>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p>
            Wenn du fortfährst, aktivieren wir den Fragebogen {kind}. Du kannst das später in den Einstellungen wieder
            ausschalten.
          </p>
          <p className="font-semibold text-slate-700">Deine Daten bleiben lokal. Optional kannst du einen PIN vergeben.</p>
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDecline}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Später
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            Einverstanden
          </button>
        </div>
      </div>
    </div>
  );
}
