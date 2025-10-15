"use client";

import { useMemo } from "react";

import type { PbacDayInfo, PbacFillLevel, PbacProductKind } from "@/lib/types";

interface PbacMiniProps {
  value?: PbacDayInfo;
  onChange: (value: PbacDayInfo) => void;
}

const productScores: Record<PbacProductKind, Record<PbacFillLevel, number>> = {
  pad: { low: 1, mid: 5, high: 10 },
  tampon: { low: 1, mid: 5, high: 10 },
  cup: { low: 5, mid: 10, high: 20 },
};

const productLabels: Record<PbacProductKind, string> = {
  pad: "Binde",
  tampon: "Tampon",
  cup: "Tasse",
};

const fillLabels: Record<PbacFillLevel, string> = {
  low: "leer",
  mid: "halb",
  high: "voll",
};

export function PbacMini({ value, onChange }: PbacMiniProps) {
  const items = useMemo(() => value?.products ?? [], [value?.products]);

  const dayScore = useMemo(() => {
    return items.reduce((sum, item) => sum + productScores[item.kind][item.fill], 0);
  }, [items]);

  const updateProducts = (kind: PbacProductKind, fill: PbacFillLevel) => {
    const nextProducts = [...items, { kind, fill }];
    const pbac: PbacDayInfo = {
      products: nextProducts,
      clots: value?.clots,
      flooding: value?.flooding,
      dayScore: nextProducts.reduce((sum, item) => sum + productScores[item.kind][item.fill], 0),
    };
    onChange(pbac);
  };

  const removeProduct = (index: number) => {
    const nextProducts = items.filter((_, idx) => idx !== index);
    const pbac: PbacDayInfo = {
      products: nextProducts,
      clots: value?.clots,
      flooding: value?.flooding,
      dayScore: nextProducts.reduce((sum, item) => sum + productScores[item.kind][item.fill], 0),
    };
    onChange(pbac);
  };

  const toggleClots = (size: "small" | "large") => {
    const current = value?.clots ?? "none";
    const next: PbacDayInfo = {
      products: items,
      flooding: value?.flooding,
      clots: current === size ? "none" : size,
      dayScore,
    };
    onChange(next);
  };

  const toggleFlooding = () => {
    const next: PbacDayInfo = {
      products: items,
      clots: value?.clots,
      flooding: !value?.flooding,
      dayScore,
    };
    onChange(next);
  };

  return (
    <section aria-label="PBAC Tageserfassung" className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Periode & Blutung</h2>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            dayScore > 100 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"
          }`}
        >
          PBAC: {dayScore}
        </span>
      </header>
      <p className="text-sm text-slate-600">Tippe, wie voll deine Produkte waren. Das hilft in Arztgesprächen.</p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Menstruationsprodukte">
        {(Object.keys(productScores) as PbacProductKind[]).map((kind) => (
          <div key={kind} className="rounded-xl bg-white p-2 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">{productLabels[kind]}</h3>
            <div className="mt-2 space-y-2">
              {(Object.keys(productScores[kind]) as PbacFillLevel[]).map((fill) => (
                <button
                  key={fill}
                  type="button"
                  onClick={() => updateProducts(kind, fill)}
                  className="flex w-full flex-col items-center rounded-lg border border-rose-100 bg-rose-50 px-2 py-1 text-center text-sm font-medium text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <span aria-hidden="true" className="text-2xl">
                    {fill === "low" ? "○" : fill === "mid" ? "◐" : "●"}
                  </span>
                  <span>{fillLabels[fill]}</span>
                  <span className="text-xs text-rose-500">+{productScores[kind][fill]}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {items.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Heute erfasst</h3>
          <ul className="mt-2 flex flex-wrap gap-2" aria-live="polite">
            {items.map((item, index) => (
              <li key={`${item.kind}-${index}`}>
                <button
                  type="button"
                  onClick={() => removeProduct(index)}
                  className="flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-sm text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  aria-label={`${productLabels[item.kind]} ${fillLabels[item.fill]} entfernen`}
                >
                  {productLabels[item.kind]} · {fillLabels[item.fill]} · +{productScores[item.kind][item.fill]}
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Zusätze</legend>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-rose-200 text-rose-500 focus:ring-rose-500"
              checked={value?.clots === "small"}
              onChange={() => toggleClots("small")}
            />
            <span>Klumpen (klein)</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-rose-200 text-rose-500 focus:ring-rose-500"
              checked={value?.clots === "large"}
              onChange={() => toggleClots("large")}
            />
            <span>Klumpen (groß)</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-rose-200 text-rose-500 focus:ring-rose-500"
              checked={Boolean(value?.flooding)}
              onChange={toggleFlooding}
            />
            <span>Flooding</span>
          </label>
        </div>
      </fieldset>
      {dayScore > 100 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700" role="alert">
          Starkes Blutungszeichen. Wenn du unsicher bist, sprich mit deinem Behandlungsteam.
        </p>
      ) : null}
    </section>
  );
}
