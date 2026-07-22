import React, { useEffect, useRef, useState } from 'react';
import { EQUIPMENT_OPTIONS, SPRINKLER_OPTIONS } from '../../data/LawnPackData';
import { MOWER_OPTIONS, LAWN_SURFACE_OPTIONS, LEVELLING_GUIDE_METHODS } from '../../data/lawnUiConfig';
import { LAWN_THEMES } from '../../data/lawnThemes';

const DEBUG_TOOLS_STORAGE_KEY = 'lawnPackShowDebugTools';

/**
 * Snapshot of Setup fields that apply immediately while editing.
 * Cancel restores this; Save keeps the current values and leaves Setup.
 * @param {ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp>} app
 */
function captureSettingsSnapshot(app) {
  return {
    length: app.length,
    width: app.width,
    mowerModel: app.mowerModel,
    lawnSurface: app.lawnSurface,
    selectedEquipment: app.selectedEquipment,
    selectedSprinkler: app.selectedSprinkler,
    themeId: app.themeId,
    activeRoom: app.activeRoom,
  };
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
    themeId,
    setThemeId,
    setActiveRoom,
  } = app;

  const snapshotRef = useRef(/** @type {ReturnType<typeof captureSettingsSnapshot> | null} */ (null));
  const [dirty, setDirty] = useState(false);
  const [showDebugTools, setShowDebugTools] = useState(() => {
    try {
      return localStorage.getItem(DEBUG_TOOLS_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const debugTapRef = useRef({ count: 0, timer: /** @type {ReturnType<typeof setTimeout> | null} */ (null) });

  const setDebugToolsVisible = (visible) => {
    setShowDebugTools(visible);
    try {
      if (visible) localStorage.setItem(DEBUG_TOOLS_STORAGE_KEY, '1');
      else localStorage.removeItem(DEBUG_TOOLS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const handleSetupTitleTap = () => {
    const tap = debugTapRef.current;
    if (tap.timer) clearTimeout(tap.timer);
    tap.count += 1;
    if (tap.count >= 7) {
      tap.count = 0;
      setDebugToolsVisible(!showDebugTools);
      return;
    }
    tap.timer = setTimeout(() => {
      tap.count = 0;
    }, 1400);
  };

  useEffect(() => {
    snapshotRef.current = captureSettingsSnapshot(app);
    setDirty(false);
    // Capture once when Setup opens — intentional empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount snapshot only
  }, []);

  useEffect(() => {
    const snap = snapshotRef.current;
    if (!snap) return;
    setDirty(
      length !== snap.length ||
        width !== snap.width ||
        mowerModel !== snap.mowerModel ||
        lawnSurface !== snap.lawnSurface ||
        selectedEquipment !== snap.selectedEquipment ||
        selectedSprinkler !== snap.selectedSprinkler ||
        themeId !== snap.themeId
    );
  }, [
    length,
    width,
    mowerModel,
    lawnSurface,
    selectedEquipment,
    selectedSprinkler,
    themeId,
  ]);

  const leaveSetup = () => {
    setShowLevellingGuide(false);
    setActiveScreen('main');
  };

  const handleCancel = () => {
    const snap = snapshotRef.current;
    if (snap) {
      setLength(snap.length);
      setWidth(snap.width);
      setMowerModel(snap.mowerModel);
      setLawnSurface(snap.lawnSurface);
      setSelectedEquipment(snap.selectedEquipment);
      setSelectedSprinkler(snap.selectedSprinkler);
      setThemeId(snap.themeId);
      setActiveRoom(snap.activeRoom);
    }
    leaveSetup();
  };

  const handleSave = () => {
    leaveSetup();
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4 border-b pb-4 gap-3">
        <div className="min-w-0">
          <h2
            className="text-xl font-black text-green-800 select-none"
            onClick={handleSetupTitleTap}
          >
            ⚙️ Lawn Setup
          </h2>
          <p className="text-sm text-green-700 mt-1">
            Configure appearance, lawn size, equipment, and surface profile.
          </p>
        </div>
        {!dirty && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-1.5 px-3 rounded-lg transition-all"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="text-xs bg-green-700 hover:bg-green-800 text-white font-bold py-1.5 px-3 rounded-lg transition-all"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {dirty && (
        <div
          className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 shadow-sm"
          role="status"
          aria-live="polite"
        >
          <p className="text-xs font-bold text-amber-950 mb-2">Unsaved changes</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 text-sm font-bold py-2.5 px-3 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 text-sm font-bold py-2.5 px-3 rounded-xl bg-green-700 text-white hover:bg-green-800 transition-all"
            >
              Save changes
            </button>
          </div>
        </div>
      )}

      <div className={`space-y-5 ${dirty ? 'pb-4' : 'pb-2'}`}>
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <h3 className="text-sm font-bold text-emerald-950 mb-1">Appearance</h3>
          <p className="text-xs text-emerald-900/80 mb-3 leading-snug">
            Classic (long page), Atelier (moss home hub), Signal (dark status tabs), Canopy (neon
            yard board), Folio (paper desk folders), and Official (thelawnpack.co.uk brand). Change
            anything and Cancel / Save appear under Lawn Setup above.
          </p>
          <div className="grid gap-2">
            {LAWN_THEMES.map((theme) => {
              const selected = themeId === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    setThemeId(theme.id);
                    setActiveRoom('hub');
                  }}
                  className={`text-left rounded-xl border p-3 transition-all ${
                    selected
                      ? 'border-emerald-600 bg-white ring-2 ring-emerald-500/30'
                      : 'border-emerald-100 bg-white/80 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900">{theme.name}</p>
                      <p className="text-[11px] font-semibold text-emerald-800 mt-0.5">
                        {theme.tagline}
                      </p>
                      <p className="text-[11px] text-gray-600 mt-1.5 leading-snug">
                        {theme.description}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md ${
                        selected ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {selected ? 'Active' : 'Try'}
                    </span>
                  </div>
                  <div className="flex gap-1.5 mt-3" aria-hidden="true">
                    {theme.swatches.map((color) => (
                      <span
                        key={color}
                        className="h-4 w-4 rounded-full border border-black/10"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

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
          <span className="text-green-600 ml-1.5">
            ({length}m × {width}m)
          </span>
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
                      surface setting to &ldquo;Perfectly Flat / Smooth&rdquo; for a lower cut height
                      recommendation.
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
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
          <p className="text-sm font-bold text-sky-950 mb-1">🌦️ Weather location</p>
          <p className="text-[11px] text-sky-900/80 mb-3 leading-snug">
            Rain and soil temperature forecasts use this postcode. Defaults to the Wallsend area
            until you set your own. This section saves on its own (separate from Cancel / Save
            below).
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

        {showDebugTools && (
          <div className="border-t border-green-200 pt-4 mt-2">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-bold text-gray-700">Developer / Debug Mode</p>
              <button
                type="button"
                onClick={() => setDebugToolsVisible(false)}
                className="text-[10px] font-bold uppercase tracking-wide text-gray-500 hover:text-gray-700"
              >
                Hide
              </button>
            </div>
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
        )}
      </div>
    </>
  );
}
