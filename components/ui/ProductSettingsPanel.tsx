"use client";

import React, { useState } from "react";
import {
  DEFAULT_PRODUCTS,
  ProductDefinition,
  ProductCategory,
  TrackingMethod,
} from "@/lib/pbac";
import {
  ProductSettings,
  PRODUCT_CATEGORY_LABELS,
  PRODUCT_CATEGORY_ICONS,
  createCustomProduct,
  validateProductDefinition,
} from "@/lib/productSettings";

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
    <div className="space-y-6">
      {/* Tracking-Methode */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Erfassungsmethode</h3>
        <div className="space-y-2">
          <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="trackingMethod"
              checked={settings.trackingMethod === "pbac_classic"}
              onChange={() => handleTrackingMethodChange("pbac_classic")}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Klassischer PBAC</div>
              <div className="text-sm text-gray-600">
                Nur Binden & Tampons (leicht/mittel/schwer)
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="trackingMethod"
              checked={settings.trackingMethod === "pbac_extended"}
              onChange={() => handleTrackingMethodChange("pbac_extended")}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Erweiterter PBAC</div>
              <div className="text-sm text-gray-600">
                Alle Produkte mit Volumen-Schätzung
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Deine bisherigen Daten bleiben vergleichbar durch den PBAC-Äquivalent-Score
              </div>
            </div>
          </label>
        </div>
      </section>

      {/* Produkt-Auswahl */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Meine Produkte</h3>
        <p className="text-sm text-gray-600 mb-4">
          Aktiviere nur die Produkte, die du verwendest. So bleibt die Erfassung übersichtlich.
        </p>

        <div className="space-y-4">
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
              <div key={category} className="border rounded-lg overflow-hidden">
                {/* Kategorie-Header */}
                <label className="flex items-center gap-3 p-3 bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFullyEnabled}
                    ref={(el) => {
                      if (el) el.indeterminate = isPartiallyEnabled;
                    }}
                    onChange={(e) => handleCategoryToggle(category, e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="text-xl">{PRODUCT_CATEGORY_ICONS[category]}</span>
                  <span className="font-medium">{PRODUCT_CATEGORY_LABELS[category]}</span>
                </label>

                {/* Produkte in dieser Kategorie */}
                <div className="p-3 space-y-2">
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
                          className="w-4 h-4"
                        />
                        <span>{product.name}</span>
                        {product.isCustom && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            Eigenes
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          {product.capacity_ml > 0 ? `${product.capacity_ml} ml` : "–"}
                        </span>
                        {product.isCustom && (
                          <button
                            onClick={() => handleRemoveCustomProduct(product.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                            title="Entfernen"
                          >
                            ✕
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
                        className="text-sm text-blue-600 hover:text-blue-800 mt-2"
                      >
                        + Eigene Größe hinzufügen
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Anzeige-Optionen */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Anzeige</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showVolumeEstimate}
              onChange={(e) =>
                onSettingsChange({ ...settings, showVolumeEstimate: e.target.checked })
              }
              className="w-4 h-4"
            />
            <span>Geschätztes Volumen (ml) anzeigen</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showPbacEquivalent}
              onChange={(e) =>
                onSettingsChange({ ...settings, showPbacEquivalent: e.target.checked })
              }
              className="w-4 h-4"
            />
            <span>PBAC-Äquivalent-Score anzeigen</span>
          </label>
        </div>
      </section>

      {/* Modal für eigenes Produkt */}
      {showAddCustom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {PRODUCT_CATEGORY_ICONS[customCategory]} Eigenes Produkt hinzufügen
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="z.B. Meine Tasse XL"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Kapazität (ml)
                </label>
                <input
                  type="number"
                  value={customCapacity}
                  onChange={(e) => setCustomCapacity(Number(e.target.value))}
                  min={0}
                  max={200}
                  className="w-full border rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Typisch: Tasse 20-35ml, Disc 50-80ml, Slip 10-30ml
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddCustom(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddCustomProduct}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
