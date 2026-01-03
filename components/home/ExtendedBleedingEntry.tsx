"use client";

import React, { useState } from "react";
import {
  FillLevel,
  ExtendedBleedingEntry,
  FreeBleedingEntry,
  calculateExtendedEntryScore,
} from "@/lib/pbac";
import {
  ProductSettings,
  getEnabledProducts,
  FILL_LEVEL_LABELS,
  FREE_BLEEDING_INTENSITY_LABELS,
  PRODUCT_CATEGORY_LABELS,
} from "@/lib/productSettings";
import { Button } from "@/components/ui/button";

interface ExtendedBleedingEntryFormProps {
  settings: ProductSettings;
  onAddEntry: (entry: ExtendedBleedingEntry | FreeBleedingEntry) => void;
}

export const ExtendedBleedingEntryForm: React.FC<ExtendedBleedingEntryFormProps> = ({
  settings,
  onAddEntry,
}) => {
  const enabledProducts = getEnabledProducts(settings);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    enabledProducts[0]?.id || ""
  );
  const [fillLevel, setFillLevel] = useState<FillLevel>(50);
  const [freeBleedingIntensity, setFreeBleedingIntensity] = useState<
    keyof typeof FREE_BLEEDING_INTENSITY_LABELS
  >("moderate");

  const selectedProduct = enabledProducts.find((p) => p.id === selectedProductId);
  const isFreeBleedingSelected = selectedProduct?.category === "free_bleeding";

  const handleSubmit = () => {
    if (!selectedProduct) return;

    const timestamp = new Date().toISOString();
    const id = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (isFreeBleedingSelected) {
      const intensityData = FREE_BLEEDING_INTENSITY_LABELS[freeBleedingIntensity];
      const entry: FreeBleedingEntry = {
        id,
        timestamp,
        intensity: freeBleedingIntensity,
        visibleAmount: "stains",
        estimatedVolumeMl: intensityData.volumeMl,
        pbacEquivalentScore: Math.round(intensityData.volumeMl / 2),
      };
      onAddEntry(entry);
    } else {
      const { estimatedVolumeMl, pbacEquivalentScore } = calculateExtendedEntryScore(
        selectedProduct,
        fillLevel
      );
      const entry: ExtendedBleedingEntry = {
        id,
        timestamp,
        productId: selectedProduct.id,
        fillLevelPercent: fillLevel,
        estimatedVolumeMl,
        pbacEquivalentScore,
      };
      onAddEntry(entry);
    }

    // Reset
    setFillLevel(50);
  };

  // Vorschau der Werte
  const preview = selectedProduct
    ? isFreeBleedingSelected
      ? {
          volumeMl: FREE_BLEEDING_INTENSITY_LABELS[freeBleedingIntensity].volumeMl,
          pbacEquiv: Math.round(
            FREE_BLEEDING_INTENSITY_LABELS[freeBleedingIntensity].volumeMl / 2
          ),
        }
      : calculateExtendedEntryScore(selectedProduct, fillLevel)
    : null;

  return (
    <div className="space-y-4 p-4 border border-rose-100 rounded-xl bg-white">
      {/* Produkt-Auswahl */}
      <div>
        <label className="block text-sm font-medium text-rose-900 mb-2">Produkt</label>
        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className="w-full border border-rose-200 rounded-xl px-3 py-2 text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
        >
          {enabledProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
              {product.capacity_ml > 0 ? ` (${product.capacity_ml}ml)` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Füllgrad oder Free Bleeding Intensität */}
      {isFreeBleedingSelected ? (
        <div>
          <label className="block text-sm font-medium text-rose-900 mb-2">Intensität</label>
          <div className="grid grid-cols-2 gap-2">
            {(
              Object.entries(FREE_BLEEDING_INTENSITY_LABELS) as [
                keyof typeof FREE_BLEEDING_INTENSITY_LABELS,
                (typeof FREE_BLEEDING_INTENSITY_LABELS)[keyof typeof FREE_BLEEDING_INTENSITY_LABELS]
              ][]
            ).map(([key, data]) => (
              <button
                key={key}
                onClick={() => setFreeBleedingIntensity(key)}
                className={`p-3 border rounded-xl text-left transition ${
                  freeBleedingIntensity === key
                    ? "border-rose-400 bg-rose-50"
                    : "border-rose-100 hover:bg-rose-50/50"
                }`}
              >
                <div className="text-sm font-medium text-rose-900">{data.label}</div>
                <div className="text-xs text-rose-500">~{data.volumeMl} ml</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-rose-900 mb-2">Füllgrad</label>
          <div className="flex gap-2">
            {([25, 50, 75, 100, 125] as FillLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setFillLevel(level)}
                className={`flex-1 py-2 px-1 border rounded-xl text-center transition ${
                  fillLevel === level
                    ? "border-rose-400 bg-rose-50"
                    : "border-rose-100 hover:bg-rose-50/50"
                }`}
              >
                <div className="text-sm font-medium text-rose-900">{level}%</div>
                <div className="text-xs text-rose-500">
                  {level === 125 ? "Über" : level === 100 ? "Voll" : level >= 75 ? "Viel" : level >= 50 ? "Halb" : "Wenig"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vorschau */}
      {preview && settings.showVolumeEstimate && (
        <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-xl">
          Geschätzt: ~{"estimatedVolumeMl" in preview ? preview.estimatedVolumeMl : preview.volumeMl} ml
          {settings.showPbacEquivalent && (
            <span className="ml-2 text-rose-500">
              (PBAC-Äquiv.: {"pbacEquivalentScore" in preview ? preview.pbacEquivalentScore : preview.pbacEquiv})
            </span>
          )}
        </div>
      )}

      {/* Submit */}
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!selectedProduct}
        className="w-full bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50"
      >
        Eintrag hinzufügen
      </Button>
    </div>
  );
};
