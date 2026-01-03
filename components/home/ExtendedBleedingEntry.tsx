"use client";

import React, { useState } from "react";
import {
  ProductDefinition,
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
  PRODUCT_CATEGORY_ICONS,
} from "@/lib/productSettings";

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
        visibleAmount: "stains", // TODO: UI für visibleAmount
        estimatedVolumeMl: intensityData.volumeMl,
        pbacEquivalentScore: Math.round(intensityData.volumeMl / 2), // Vereinfachte Berechnung
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
    <div className="space-y-4 p-4 border rounded-lg">
      {/* Produkt-Auswahl */}
      <div>
        <label className="block text-sm font-medium mb-2">Produkt</label>
        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        >
          {enabledProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {PRODUCT_CATEGORY_ICONS[product.category]} {product.name}
              {product.capacity_ml > 0 ? ` (${product.capacity_ml}ml)` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Füllgrad oder Free Bleeding Intensität */}
      {isFreeBleedingSelected ? (
        <div>
          <label className="block text-sm font-medium mb-2">Intensität</label>
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
                className={`p-3 border rounded-lg text-left ${
                  freeBleedingIntensity === key
                    ? "border-blue-500 bg-blue-50"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="text-xl">{data.icon}</div>
                <div className="text-sm font-medium">{data.label}</div>
                <div className="text-xs text-gray-500">~{data.volumeMl} ml</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-2">Füllgrad</label>
          <div className="flex gap-2">
            {([25, 50, 75, 100, 125] as FillLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setFillLevel(level)}
                className={`flex-1 py-2 px-1 border rounded-lg text-center ${
                  fillLevel === level
                    ? "border-blue-500 bg-blue-50"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="text-lg">
                  {level === 125 ? "💦" : level === 100 ? "🔴" : level >= 75 ? "🟠" : "🟡"}
                </div>
                <div className="text-xs">{level}%</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vorschau */}
      {preview && settings.showVolumeEstimate && (
        <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
          → Geschätzt: ~{"estimatedVolumeMl" in preview ? preview.estimatedVolumeMl : preview.volumeMl} ml
          {settings.showPbacEquivalent && (
            <span className="ml-2">
              (PBAC-Äquiv.: {"pbacEquivalentScore" in preview ? preview.pbacEquivalentScore : preview.pbacEquiv})
            </span>
          )}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!selectedProduct}
        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        Eintrag hinzufügen
      </button>
    </div>
  );
};
