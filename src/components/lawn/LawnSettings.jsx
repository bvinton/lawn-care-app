import React, { useMemo, useState } from 'react';
import { EQUIPMENT_OPTIONS, SPRINKLER_OPTIONS } from '../../data/LawnPackData';
import { MOWER_OPTIONS, LAWN_SURFACE_OPTIONS, LEVELLING_GUIDE_METHODS } from '../../data/lawnUiConfig';

const TOPSOIL_BAG_LITRES = 50;
const COMPOST_BAG_LITRES = 50;
const SHARP_SAND_BAG_LITRES = 15;
const TOPDRESS_DEPTH_MM = 5;

const TOPDRESSING_GOALS = {
  'aeration-recovery': {
    label: 'Aeration Recovery (High Sand)',
    mixLabel: '60% Sharp Sand, 20% Screened Topsoil, 20% Compost',
    sand: 0.6,
    soil: 0.2,
    compost: 0.2,
  },
  'standard-levelling': {
    label: 'Standard Levelling',
    mixLabel: '50% Sharp Sand, 50% Screened Topsoil',
    sand: 0.5,
    soil: 0.5,
    compost: 0,
  },
  'light-seed-bedding': {
    label: 'Light Seed Bedding',
    mixLabel: '34% Sharp Sand, 33% Screened Topsoil, 33% Compost',
    sand: 0.34,
    soil: 0.33,
    compost: 0.33,
  },
};

function formatLitres(litres) {
  return litres.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function CalculatorIcon({ className = 'w-4 h-4' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8" y2="10.01" />
      <line x1="12" y1="10" x2="12" y2="10.01" />
      <line x1="16" y1="10" x2="16" y2="10.01" />
      <line x1="8" y1="14" x2="8" y2="14.01" />
      <line x1="12" y1="14" x2="12" y2="14.01" />
      <line x1="16" y1="14" x2="16" y2="14.01" />
      <line x1="8" y1="18" x2="8" y2="18.01" />
      <line x1="12" y1="18" x2="12" y2="18.01" />
      <line x1="16" y1="18" x2="16" y2="18.01" />
    </svg>
  );
}

/** @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props */
export default function LawnSettings({ app }) {
  const {
    length,
    setLength,
    width,
    setWidth,
    sqm,
    mowerModel,
    setMowerModel,
    lawnSurface,
    setLawnSurface,
    showLevellingGuide,
    setShowLevellingGuide,
    selectedEquipment,
    setSelectedEquipment,
    weatherLocation,
    postcodeInput,
    setPostcodeInput,
    weatherLocationError,
    weatherLocationSaving,
    weatherLocationLabel,
    selectedSprinkler,
    setSelectedSprinkler,
    setEnlargedSprinkler,
    supabaseSyncError,
    jsonCopied,
    handleCopyTasksJson,
    handleSaveWeatherPostcode,
    handleUseMyLocationForWeather,
    handleResetWeatherLocation,
    setActiveScreen,
    setWeatherLocationError,
  } = app;

  const [showMaterialsCalculator, setShowMaterialsCalculator] = useState(false);
  const [topdressingGoal, setTopdressingGoal] = useState('light-seed-bedding');

  const selectedTopdressingGoal = TOPDRESSING_GOALS[topdressingGoal];

  const topdressingMaterials = useMemo(() => {
    const goal = TOPDRESSING_GOALS[topdressingGoal];
    const totalLitres = sqm * TOPDRESS_DEPTH_MM;
    const sandLitres = totalLitres * goal.sand;
    const soilLitres = totalLitres * goal.soil;
    const compostLitres = totalLitres * goal.compost;

    const topsoilBags = soilLitres > 0 ? Math.ceil(soilLitres / TOPSOIL_BAG_LITRES) : 0;
    const sandBags = sandLitres > 0 ? Math.ceil(sandLitres / SHARP_SAND_BAG_LITRES) : 0;
    const compostBags = compostLitres > 0 ? Math.ceil(compostLitres / COMPOST_BAG_LITRES) : 0;

    return {
      totalLitres,
      sandLitres,
      soilLitres,
      compostLitres,
      topsoilBags,
      sandBags,
      compostBags,
    };
  }, [sqm, topdressingGoal]);

  return (
    <>
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h2 className="text-xl font-black text-green-800">⚙️ Lawn Setup</h2>
          <p className="text-sm text-green-700 mt-1">
            Configure your lawn size, equipment, and surface profile.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveScreen('main')}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-1.5 px-3 rounded-lg transition-all"
        >
          ← Back to Workflow
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-green-900 mb-1">
            Lawn Length: <span className="font-bold text-green-700">{length}m</span>
          </label>
          <input
            type="range"
            min="1"
            max="30"
            value={length}
            onChange={(e) => setLength(parseInt(e.target.value, 10))}
            className="w-full accent-green-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-green-900 mb-1">
            Lawn Width: <span className="font-bold text-green-700">{width}m</span>
          </label>
          <input
            type="range"
            min="1"
            max="30"
            value={width}
            onChange={(e) => setWidth(parseInt(e.target.value, 10))}
            className="w-full accent-green-600"
          />
        </div>
        <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-sm text-green-800">
          <span className="font-black">{sqm} SQM</span>
          <span className="text-green-600 ml-1.5">({length}m × {width}m)</span>
        </div>
        <div>
          <label htmlFor="mower-select" className="block text-sm font-medium text-green-900 mb-1">
            Lawnmower Model
          </label>
          <select
            id="mower-select"
            value={mowerModel}
            onChange={(e) => setMowerModel(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm text-gray-700 font-medium focus:ring-2 focus:ring-green-500"
          >
            {Object.values(MOWER_OPTIONS).map((mower) => (
              <option key={mower.id} value={mower.id}>
                {mower.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1 mb-2">
            <p className="text-sm font-medium text-green-900">Lawn Surface Condition</p>
            <button
              type="button"
              onClick={() => setShowLevellingGuide((open) => !open)}
              aria-expanded={showLevellingGuide}
              className="ml-2 text-emerald-600 hover:text-emerald-800 text-xs underline font-medium"
            >
              ℹ️ How to fix a bumpy lawn
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.values(LAWN_SURFACE_OPTIONS).map((option) => {
              const isSelected = lawnSurface === option.id;

              return (
                <label
                  key={option.id}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-green-600 bg-green-100/80 text-green-900 ring-1 ring-green-500/30'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="lawn-surface"
                    value={option.id}
                    checked={isSelected}
                    onChange={(e) => setLawnSurface(e.target.value)}
                    className="accent-green-600"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              showLevellingGuide
                ? 'grid-rows-[1fr] opacity-100 mt-3'
                : 'grid-rows-[0fr] opacity-0 mt-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900">Lawn Levelling Guide</h4>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      Choose the method that matches your dip depth. Once levelled, switch your
                      surface setting to &ldquo;Perfectly Flat / Smooth&rdquo; for a lower cut
                      height recommendation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLevellingGuide(false)}
                    className="shrink-0 text-xs font-bold text-gray-400 hover:text-gray-600"
                    aria-label="Close levelling guide"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-3">
                  {LEVELLING_GUIDE_METHODS.map((method) => (
                    <div
                      key={method.title}
                      className="rounded-lg border border-green-100 bg-green-50/40 p-3.5"
                    >
                      <p className="text-xs font-bold text-green-900 mb-1.5">{method.title}</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{method.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <label htmlFor="equipment-select" className="block text-sm font-bold text-gray-700 mb-1.5">
            Application Tool Profile:
          </label>
          <select
            id="equipment-select"
            value={selectedEquipment}
            onChange={(e) => setSelectedEquipment(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm text-gray-700 font-medium focus:ring-2 focus:ring-green-500"
          >
            {Object.values(EQUIPMENT_OPTIONS).map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowMaterialsCalculator((open) => !open)}
            aria-expanded={showMaterialsCalculator}
            className="flex w-full items-center gap-2 rounded-lg border border-stone-300 bg-stone-100 px-3 py-2.5 text-sm font-bold text-stone-800 transition-all hover:bg-stone-200/80"
          >
            <CalculatorIcon />
            Materials
          </button>
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              showMaterialsCalculator
                ? 'grid-rows-[1fr] opacity-100 mt-3'
                : 'grid-rows-[0fr] opacity-0 mt-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-lg leading-none" aria-hidden="true">
                    ⚖️
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-amber-950">
                      Topdressing &amp; Materials Calculator
                    </h4>
                    <p className="text-[11px] text-amber-900/80 mt-1 leading-snug">
                      Based on your {sqm} SQM lawn — a {TOPDRESS_DEPTH_MM}mm deep layer ideal for
                      protecting new seed and filling minor aeration holes.
                    </p>
                  </div>
                </div>

                <div className="mb-3">
                  <label
                    htmlFor="topdressing-goal"
                    className="block text-xs font-bold text-amber-950 mb-1"
                  >
                    Topdressing Goal
                  </label>
                  <select
                    id="topdressing-goal"
                    value={topdressingGoal}
                    onChange={(event) => setTopdressingGoal(event.target.value)}
                    className="w-full bg-white border border-amber-200 rounded-lg p-2 text-sm text-amber-950 font-medium focus:ring-2 focus:ring-amber-400"
                  >
                    {Object.entries(TOPDRESSING_GOALS).map(([id, goal]) => (
                      <option key={id} value={id}>
                        {goal.label}
                      </option>
                    ))}
                  </select>
                </div>

                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3 rounded-lg border border-amber-200/80 bg-white/70 px-3 py-2">
                    <dt className="font-semibold text-amber-950">Total volume</dt>
                    <dd className="font-black text-amber-900 tabular-nums">
                      {formatLitres(topdressingMaterials.totalLitres)} L
                    </dd>
                  </div>

                  <div className="rounded-lg border border-amber-200/80 bg-white/70 px-3 py-2.5">
                    <p className="text-xs font-bold text-amber-950 mb-2">
                      {selectedTopdressingGoal.mixLabel}
                    </p>
                    <ul className="space-y-1.5 text-xs text-amber-900">
                      {selectedTopdressingGoal.sand > 0 && (
                        <li className="flex justify-between gap-3">
                          <span>Sharp sand</span>
                          <span className="font-bold tabular-nums">
                            {formatLitres(topdressingMaterials.sandLitres)} L
                          </span>
                        </li>
                      )}
                      {selectedTopdressingGoal.soil > 0 && (
                        <li className="flex justify-between gap-3">
                          <span>Screened topsoil</span>
                          <span className="font-bold tabular-nums">
                            {formatLitres(topdressingMaterials.soilLitres)} L
                          </span>
                        </li>
                      )}
                      {selectedTopdressingGoal.compost > 0 && (
                        <li className="flex justify-between gap-3">
                          <span>Compost</span>
                          <span className="font-bold tabular-nums">
                            {formatLitres(topdressingMaterials.compostLitres)} L
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-amber-200/80 bg-white/70 px-3 py-2.5">
                    <p className="text-xs font-bold text-amber-950 mb-2">Bags to buy</p>
                    <ul className="space-y-1.5 text-xs text-amber-900">
                      {topdressingMaterials.topsoilBags > 0 && (
                        <li className="flex justify-between gap-3">
                          <span>Topsoil ({TOPSOIL_BAG_LITRES}L bags)</span>
                          <span className="font-black tabular-nums">
                            {topdressingMaterials.topsoilBags}
                          </span>
                        </li>
                      )}
                      {topdressingMaterials.sandBags > 0 && (
                        <li className="flex justify-between gap-3">
                          <span>Sharp sand (25kg ≈ {SHARP_SAND_BAG_LITRES}L)</span>
                          <span className="font-black tabular-nums">
                            {topdressingMaterials.sandBags}
                          </span>
                        </li>
                      )}
                      {topdressingMaterials.compostBags > 0 && (
                        <li className="flex justify-between gap-3">
                          <span>Compost ({COMPOST_BAG_LITRES}L bags)</span>
                          <span className="font-black tabular-nums">
                            {topdressingMaterials.compostBags}
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                </dl>

                <p className="mt-3 text-[10px] text-amber-900/75 leading-relaxed italic">
                  Depth × area: {TOPDRESS_DEPTH_MM}mm over {sqm} SQM = {sqm} × {TOPDRESS_DEPTH_MM}{' '}
                  = {formatLitres(topdressingMaterials.totalLitres)} litres total, split as{' '}
                  {selectedTopdressingGoal.mixLabel.toLowerCase()}. Bag counts round up so you
                  don&apos;t run short on site.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
          <p className="text-sm font-bold text-sky-950 mb-1">🌦️ Weather location</p>
          <p className="text-[11px] text-sky-900/80 mb-3 leading-snug">
            Rain and soil temperature forecasts use this postcode. Defaults to the Wallsend area
            until you set your own.
          </p>
          <label htmlFor="weather-postcode" className="block text-xs font-semibold text-sky-950 mb-1">
            UK postcode
          </label>
          <div className="flex gap-2">
            <input
              id="weather-postcode"
              type="text"
              value={postcodeInput}
              onChange={(event) => {
                setPostcodeInput(event.target.value.toUpperCase());
                setWeatherLocationError(null);
              }}
              placeholder="NE28 9AB"
              autoComplete="postal-code"
              className="flex-1 min-w-0 bg-white border border-sky-200 rounded-lg px-3 py-2 text-sm text-gray-800 font-medium focus:ring-2 focus:ring-sky-400"
            />
            <button
              type="button"
              onClick={() => void handleSaveWeatherPostcode()}
              disabled={weatherLocationSaving || !postcodeInput.trim()}
              className="shrink-0 text-xs font-bold py-2 px-3 rounded-lg border border-sky-300 bg-white text-sky-900 hover:bg-sky-100 disabled:opacity-50"
            >
              {weatherLocationSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              onClick={() => void handleUseMyLocationForWeather()}
              disabled={weatherLocationSaving}
              className="text-xs font-bold py-2 px-3 rounded-lg border border-sky-300 bg-white text-sky-900 hover:bg-sky-100 disabled:opacity-50"
            >
              📍 Use my location
            </button>
            {weatherLocation.source !== 'default' && (
              <button
                type="button"
                onClick={() => void handleResetWeatherLocation()}
                disabled={weatherLocationSaving}
                className="text-xs font-semibold py-2 px-3 rounded-lg text-sky-800 hover:bg-sky-100/80 disabled:opacity-50"
              >
                Reset to default
              </button>
            )}
          </div>
          <p className="mt-2 text-xs font-medium text-sky-900">
            Forecast for: {weatherLocationLabel}
          </p>
          {weatherLocationError && (
            <p className="mt-2 text-xs font-semibold text-red-700">{weatherLocationError}</p>
          )}
        </div>

        <div>
          <p className="block text-sm font-bold text-gray-700 mb-1">
            Irrigation Profile — Select Your Primary Sprinkler:
          </p>
          <p className="text-[11px] text-gray-500 mb-2 leading-snug">
            Match the photo and description to the sprinkler you own. Tap a photo to enlarge it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.values(SPRINKLER_OPTIONS).map((sprinkler) => {
              const isSelected = selectedSprinkler === sprinkler.id;

              return (
                <button
                  key={sprinkler.id}
                  type="button"
                  onClick={() => setSelectedSprinkler(sprinkler.id)}
                  className={`text-left rounded-lg border p-3 transition-all ${
                    isSelected
                      ? 'border-green-600 bg-green-100/80 shadow-sm ring-1 ring-green-500/30'
                      : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/50'
                  }`}
                >
                  <img
                    src={sprinkler.image}
                    alt={sprinkler.name}
                    onClick={(event) => {
                      event.stopPropagation();
                      setEnlargedSprinkler({
                        image: sprinkler.image,
                        name: sprinkler.name,
                      });
                    }}
                    className="w-16 h-16 object-cover rounded-md mb-2 mx-auto border border-gray-200 shadow-sm cursor-zoom-in hover:opacity-90 transition-opacity"
                  />
                  <span className="text-xs font-bold text-gray-900 leading-snug block">
                    {sprinkler.name}
                  </span>
                  <span className="text-[10px] font-semibold text-green-700 block mb-1.5">
                    ~{sprinkler.ratePerHour}mm / hour
                  </span>
                  <p className="text-[10px] text-gray-700 leading-snug mb-1">
                    {sprinkler.description}
                  </p>
                  <p className="text-[10px] text-gray-500 leading-snug italic">
                    {sprinkler.identification}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-green-200 pt-4 mt-2">
          <p className="text-sm font-bold text-gray-700 mb-2">Developer / Debug Mode</p>
          {supabaseSyncError && (
            <p className="mb-2 text-[11px] font-medium text-red-700">{supabaseSyncError}</p>
          )}
          <button
            type="button"
            onClick={handleCopyTasksJson}
            className="w-full text-xs font-bold py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all"
          >
            {jsonCopied ? 'Copied!' : '📋 Copy Live JSON Payload to Clipboard'}
          </button>
        </div>
      </div>
    </>
  );
}
