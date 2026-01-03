"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import {
  DEFAULT_PRODUCTS,
  ProductDefinition,
  ProductCategory,
  TrackingMethod,
} from "@/lib/pbac";
import {
  ProductSettings,
  PRODUCT_CATEGORY_LABELS,
  createCustomProduct,
  validateProductDefinition,
} from "@/lib/productSettings";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface ProductSettingsPanelProps {
  settings: ProductSettings;
  onSettingsChange: (settings: ProductSettings) => void;
}

export const ProductSettingsPanel: React.FC<ProductSettingsPanelProps> = ({
  settings,
  onSettingsChange,
}) => {
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState<ProductCategory>("cup");
  const [customCapacity, setCustomCapacity] = useState(25);

  // Alle Produkte (Standard + Custom)
  const allProducts = [...DEFAULT_PRODUCTS, ...settings.customProducts];

  // Gruppiert nach Kategorie
  const productsByCategory = allProducts.reduce((acc, product) => {
    if (!acc[product.category]) acc[product.category] = [];
    acc[product.category].push(product);
    return acc;
  }, {} as Record<ProductCategory, ProductDefinition[]>);

  const handleTrackingMethodChange = (method: TrackingMethod) => {
    onSettingsChange({ ...settings, trackingMethod: method });
  };

  const handleProductToggle = (productId: string, enabled: boolean) => {
    const newEnabledIds = enabled
      ? [...settings.enabledProductIds, productId]
      : settings.enabledProductIds.filter((id) => id !== productId);
    onSettingsChange({ ...settings, enabledProductIds: newEnabledIds });
  };

  const handleCategoryToggle = (category: ProductCategory, enabled: boolean) => {
    const categoryProductIds = allProducts
      .filter((p) => p.category === category)
      .map((p) => p.id);

    const newEnabledIds = enabled
      ? [...new Set([...settings.enabledProductIds, ...categoryProductIds])]
      : settings.enabledProductIds.filter((id) => !categoryProductIds.includes(id));

    onSettingsChange({ ...settings, enabledProductIds: newEnabledIds });
  };

  const handleAddCustomProduct = () => {
    const errors = validateProductDefinition({
      name: customName,
      category: customCategory,
      capacity_ml: customCapacity,
    });

    if (errors.length > 0) {
      alert(errors.join("\n"));
      return;
    }

    const newProduct = createCustomProduct(customCategory, customName, customCapacity);
    onSettingsChange({
      ...settings,
      customProducts: [...settings.customProducts, newProduct],
      enabledProductIds: [...settings.enabledProductIds, newProduct.id],
    });

    setCustomName("");
    setCustomCapacity(25);
    setShowAddCustom(false);
  };

  const handleRemoveCustomProduct = (productId: string) => {
    onSettingsChange({
      ...settings,
      customProducts: settings.customProducts.filter((p) => p.id !== productId),
      enabledProductIds: settings.enabledProductIds.filter((id) => id !== productId),
    });
  };

  const isCategoryFullyEnabled = (category: ProductCategory): boolean => {
    const categoryProducts = productsByCategory[category] || [];
    return categoryProducts.every((p) => settings.enabledProductIds.includes(p.id));
  };

  const isCategoryPartiallyEnabled = (category: ProductCategory): boolean => {
    const categoryProducts = productsByCategory[category] || [];
    const enabledCount = categoryProducts.filter((p) =>
      settings.enabledProductIds.includes(p.id)
    ).length;
    return enabledCount > 0 && enabledCount < categoryProducts.length;
  };

  return (
    <div className="space-y-5">
      {/* Tracking-Methode */}
      <div className="space-y-2">
        <label
          className={`flex items-start justify-between gap-4 rounded-xl border p-4 cursor-pointer transition ${
            settings.trackingMethod === "pbac_classic"
              ? "border-rose-300 bg-rose-50/50"
              : "border-rose-100 hover:bg-rose-50/30"
          }`}
          onClick={() => handleTrackingMethodChange("pbac_classic")}
        >
          <div className="flex-1">
            <p className="font-medium text-rose-900">Klassischer PBAC</p>
            <p className="mt-1 text-sm text-rose-600">
              Nur Binden & Tampons (leicht/mittel/schwer)
            </p>
          </div>
          <div className="mt-0.5">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                settings.trackingMethod === "pbac_classic"
                  ? "border-rose-500 bg-rose-500"
                  : "border-rose-300"
              }`}
            >
              {settings.trackingMethod === "pbac_classic" && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
          </div>
        </label>

        <label
          className={`flex items-start justify-between gap-4 rounded-xl border p-4 cursor-pointer transition ${
            settings.trackingMethod === "pbac_extended"
              ? "border-rose-300 bg-rose-50/50"
              : "border-rose-100 hover:bg-rose-50/30"
          }`}
          onClick={() => handleTrackingMethodChange("pbac_extended")}
        >
          <div className="flex-1">
            <p className="font-medium text-rose-900">Erweiterter PBAC</p>
            <p className="mt-1 text-sm text-rose-600">
              Alle Produkte mit Volumen-Schätzung
            </p>
            <p className="mt-2 text-xs text-rose-500">
              Deine bisherigen Daten bleiben vergleichbar durch den PBAC-Äquivalent-Score
            </p>
          </div>
          <div className="mt-0.5">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                settings.trackingMethod === "pbac_extended"
                  ? "border-rose-500 bg-rose-500"
                  : "border-rose-300"
              }`}
            >
              {settings.trackingMethod === "pbac_extended" && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
          </div>
        </label>
      </div>

      {/* Produkt-Auswahl */}
      <div>
        <p className="font-medium text-rose-900 mb-2">Meine Produkte</p>
        <p className="text-sm text-rose-600 mb-4">
          Aktiviere nur die Produkte, die du verwendest.
        </p>

        <div className="space-y-3">
          {(Object.keys(productsByCategory) as ProductCategory[]).map((category) => {
            const products = productsByCategory[category];
            const isFullyEnabled = isCategoryFullyEnabled(category);
            const isPartiallyEnabled = isCategoryPartiallyEnabled(category);

            // Bei klassischem PBAC nur pad und tampon anzeigen
            if (
              settings.trackingMethod === "pbac_classic" &&
              !["pad", "tampon"].includes(category)
            ) {
              return null;
            }

            return (
              <div key={category} className="rounded-xl border border-rose-100 overflow-hidden">
                {/* Kategorie-Header */}
                <label className="flex items-center justify-between gap-3 p-3 bg-rose-50/50 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isFullyEnabled}
                      ref={(el) => {
                        if (el) el.indeterminate = isPartiallyEnabled;
                      }}
                      onChange={(e) => handleCategoryToggle(category, e.target.checked)}
                      className="w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-medium text-rose-900">{PRODUCT_CATEGORY_LABELS[category]}</span>
                  </div>
                </label>

                {/* Produkte in dieser Kategorie */}
                <div className="p-3 space-y-2 bg-white">
                  {products.map((product) => (
                    <label
                      key={product.id}
                      className="flex items-center justify-between gap-2 py-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={settings.enabledProductIds.includes(product.id)}
                          onChange={(e) =>
                            handleProductToggle(product.id, e.target.checked)
                          }
                          className="w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                        />
                        <span className="text-rose-800">{product.name}</span>
                        {product.isCustom && (
                          <span className="text-xs bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                            Eigenes
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-rose-500">
                          {product.capacity_ml > 0 ? `${product.capacity_ml} ml` : "–"}
                        </span>
                        {product.isCustom && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              handleRemoveCustomProduct(product.id);
                            }}
                            className="text-rose-400 hover:text-rose-600 text-sm"
                            title="Entfernen"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </label>
                  ))}

                  {/* Button für eigenes Produkt (nur bei erweiterten Kategorien) */}
                  {!["pad", "tampon"].includes(category) &&
                    settings.trackingMethod === "pbac_extended" && (
                      <button
                        onClick={() => {
                          setCustomCategory(category);
                          setShowAddCustom(true);
                        }}
                        className="text-sm text-rose-600 hover:text-rose-800 mt-2"
                      >
                        + Eigene Größe hinzufügen
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Anzeige-Optionen */}
      <div className="space-y-3">
        <p className="font-medium text-rose-900">Anzeige-Optionen</p>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-100 bg-rose-50/50 p-4">
          <div className="flex-1">
            <p className="text-sm text-rose-800">Geschätztes Volumen anzeigen</p>
          </div>
          <Switch
            checked={settings.showVolumeEstimate}
            onCheckedChange={(checked) =>
              onSettingsChange({ ...settings, showVolumeEstimate: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-100 bg-rose-50/50 p-4">
          <div className="flex-1">
            <p className="text-sm text-rose-800">PBAC-Äquivalent-Score anzeigen</p>
          </div>
          <Switch
            checked={settings.showPbacEquivalent}
            onCheckedChange={(checked) =>
              onSettingsChange({ ...settings, showPbacEquivalent: checked })
            }
          />
        </div>
      </div>

      {/* Modal für eigenes Produkt */}
      {showAddCustom && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[110]">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-rose-900">
                Eigenes Produkt hinzufügen
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowAddCustom(false)}
                className="text-rose-500 hover:text-rose-700"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-rose-900 mb-1">Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="z.B. Meine Tasse XL"
                  className="w-full border border-rose-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-rose-900 mb-1">
                  Kapazität (ml)
                </label>
                <input
                  type="number"
                  value={customCapacity}
                  onChange={(e) => setCustomCapacity(Number(e.target.value))}
                  min={0}
                  max={200}
                  className="w-full border border-rose-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
                <p className="text-xs text-rose-500 mt-1">
                  Typisch: Tasse 20-35ml, Disc 50-80ml, Slip 10-30ml
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddCustom(false)}
                className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleAddCustomProduct}
                className="flex-1 bg-rose-600 text-white hover:bg-rose-500"
              >
                Hinzufügen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
