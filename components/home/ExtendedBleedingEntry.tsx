"use client";

import React, { useState } from "react";
import { ChevronLeft } from "lucide-react";
import {
  FillLevel,
  ExtendedBleedingEntry,
  FreeBleedingEntry,
  calculateExtendedEntryScore,
  ProductDefinition,
} from "@/lib/pbac";
import {
  ProductSettings,
  getEnabledProducts,
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
  const [selectedProduct, setSelectedProduct] = useState<ProductDefinition | null>(null);
  const [fillLevel, setFillLevel] = useState<FillLevel>(66);
  const [freeBleedingIntensity, setFreeBleedingIntensity] = useState<
    keyof typeof FREE_BLEEDING_INTENSITY_LABELS
  >("moderate");

  const isFreeBleedingSelected = selectedProduct?.category === "free_bleeding";

  // Group products by category
  const productsByCategory = enabledProducts.reduce((acc, product) => {
    if (!acc[product.category]) acc[product.category] = [];
    acc[product.category].push(product);
    return acc;
  }, {} as Record<string, ProductDefinition[]>);

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

    // Reset to step 1
    setSelectedProduct(null);
    setFillLevel(66);
  };

  const handleBack = () => {
    setSelectedProduct(null);
  };

  // Preview values
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

  // Step 1: Product selection
  if (!selectedProduct) {
    return (
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">
          Produkt wählen
        </p>

        {Object.entries(productsByCategory).map(([category, products]) => (
          <div key={category} className="space-y-2">
            <p className="text-sm font-medium text-rose-700">
              {PRODUCT_CATEGORY_LABELS[category as keyof typeof PRODUCT_CATEGORY_LABELS]}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSelectedProduct(product)}
                  className="flex flex-col items-start gap-1 rounded-xl border border-rose-100 bg-white p-3 text-left transition hover:border-rose-300 hover:bg-rose-50/50"
                >
                  <span className="text-sm font-medium text-rose-900">
                    {product.nameShort || product.name}
                  </span>
                  {product.capacity_ml > 0 && (
                    <span className="text-xs text-rose-500">{product.capacity_ml} ml</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Step 2: Fill level / intensity selection
  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-rose-600 hover:text-rose-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück
        </button>
      </div>

      {/* Selected product info */}
      <div className="rounded-xl bg-rose-50 p-3">
        <p className="text-xs text-rose-500">Gewähltes Produkt</p>
        <p className="font-medium text-rose-900">{selectedProduct.name}</p>
        {selectedProduct.capacity_ml > 0 && (
          <p className="text-sm text-rose-600">Kapazität: {selectedProduct.capacity_ml} ml</p>
        )}
      </div>

      {/* Fill level or Free Bleeding intensity */}
      {isFreeBleedingSelected ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-500 mb-2">
            Intensität wählen
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(
              Object.entries(FREE_BLEEDING_INTENSITY_LABELS) as [
                keyof typeof FREE_BLEEDING_INTENSITY_LABELS,
                (typeof FREE_BLEEDING_INTENSITY_LABELS)[keyof typeof FREE_BLEEDING_INTENSITY_LABELS]
              ][]
            ).map(([key, data]) => (
              <button
                key={key}
                type="button"
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
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-500 mb-2">
            Füllgrad wählen
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([33, 66, 100] as FillLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setFillLevel(level)}
                className={`py-4 px-3 border rounded-xl text-center transition ${
                  fillLevel === level
                    ? "border-rose-400 bg-rose-50"
                    : "border-rose-100 hover:bg-rose-50/50"
                }`}
              >
                <div className="text-lg font-semibold text-rose-900">
                  {level === 33 ? "⅓" : level === 66 ? "⅔" : "Voll"}
                </div>
                <div className="text-xs text-rose-500">
                  ~{Math.round(selectedProduct.capacity_ml * level / 100)} ml
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
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
        className="w-full bg-rose-600 text-white hover:bg-rose-500"
      >
        Eintrag hinzufügen
      </Button>
    </div>
  );
};
