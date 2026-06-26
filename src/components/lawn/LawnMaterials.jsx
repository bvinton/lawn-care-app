import React, { useMemo, useState } from 'react';

const TOPSOIL_BAG_LITRES = 25;
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

export function CalculatorIcon({ className = 'w-4 h-4' }) {
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
export default function LawnMaterials({ app }) {
  const { sqm, length, width, setActiveScreen } = app;
  const [topdressingGoal, setTopdressingGoal] = useState('light-seed-bedding');
  const [materialsCoverage, setMaterialsCoverage] = useState('full');

  const selectedTopdressingGoal = TOPDRESSING_GOALS[topdressingGoal];
  const effectiveSqm = materialsCoverage === 'half' ? sqm / 2 : sqm;

  const topdressingMaterials = useMemo(() => {
    const goal = TOPDRESSING_GOALS[topdressingGoal];
    const totalLitres = effectiveSqm * TOPDRESS_DEPTH_MM;
    const sandLitres = totalLitres * goal.sand;
    const soilLitres = totalLitres * goal.soil;
    const compostLitres = totalLitres * goal.compost;

    const topsoilBags = soilLitres > 0 ? Math.ceil(soilLitres / TOPSOIL_BAG_LITRES) : 0;
    const sandBags = sandLitres > 0 ? Math.ceil(sandLitres / SHARP_SAND_BAG_LITRES) : 0;
    const compostBags = compostLitres > 0 ? Math.ceil(compostLitres / COMPOST_BAG_LITRES) : 0;

    return {
      effectiveSqm,
      totalLitres,
      sandLitres,
      soilLitres,
      compostLitres,
      topsoilBags,
      sandBags,
      compostBags,
    };
  }, [effectiveSqm, topdressingGoal]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-6 border-b pb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-green-800 flex items-center gap-2">
            <CalculatorIcon className="w-5 h-5 text-amber-800" />
            Materials
          </h2>
          <p className="text-sm text-green-700 mt-1">
            Topdressing calculator for your{' '}
            <span className="font-black">{sqm} SQM</span>
            <span className="text-green-600"> ({length}m × {width}m)</span> lawn.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveScreen('main')}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 px-3 rounded-lg transition-all shrink-0 self-start"
        >
          ← Back to Workflow
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
        <div className="flex items-start gap-2 mb-3">
          <span className="text-lg leading-none" aria-hidden="true">
            ⚖️
          </span>
          <div>
            <h3 className="text-sm font-bold text-amber-950">Topdressing &amp; Materials Calculator</h3>
            <p className="text-[11px] text-amber-900/80 mt-1 leading-snug">
              {materialsCoverage === 'half'
                ? `Half-lawn pass — ${formatLitres(topdressingMaterials.effectiveSqm)} SQM of your ${sqm} SQM lawn.`
                : `Full lawn — ${sqm} SQM.`}{' '}
              A {TOPDRESS_DEPTH_MM}mm deep layer ideal for protecting new seed and filling minor
              aeration holes.
            </p>
          </div>
        </div>

        <div className="mb-3">
          <p className="text-xs font-bold text-amber-950 mb-1.5">Area to treat</p>
          <div className="grid grid-cols-2 gap-2">
            <label
              className={`flex items-center justify-center gap-2 rounded-lg border px-2.5 py-2 cursor-pointer text-xs font-semibold transition-all ${
                materialsCoverage === 'full'
                  ? 'border-amber-500 bg-white text-amber-950 ring-1 ring-amber-400/40'
                  : 'border-amber-200/80 bg-white/60 text-amber-900/80 hover:bg-white/90'
              }`}
            >
              <input
                type="radio"
                name="materials-coverage"
                value="full"
                checked={materialsCoverage === 'full'}
                onChange={() => setMaterialsCoverage('full')}
                className="accent-amber-600"
              />
              Full lawn
            </label>
            <label
              className={`flex items-center justify-center gap-2 rounded-lg border px-2.5 py-2 cursor-pointer text-xs font-semibold transition-all ${
                materialsCoverage === 'half'
                  ? 'border-amber-500 bg-white text-amber-950 ring-1 ring-amber-400/40'
                  : 'border-amber-200/80 bg-white/60 text-amber-900/80 hover:bg-white/90'
              }`}
            >
              <input
                type="radio"
                name="materials-coverage"
                value="half"
                checked={materialsCoverage === 'half'}
                onChange={() => setMaterialsCoverage('half')}
                className="accent-amber-600"
              />
              Half lawn
            </label>
          </div>
          {materialsCoverage === 'half' && (
            <p className="text-[10px] text-amber-800/80 mt-1.5 leading-snug">
              Use when you can only fence off one section — e.g. keeping dogs off while it recovers.
            </p>
          )}
        </div>

        <div className="mb-3">
          <label htmlFor="topdressing-goal" className="block text-xs font-bold text-amber-950 mb-1">
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
                  <span className="font-black tabular-nums">{topdressingMaterials.topsoilBags}</span>
                </li>
              )}
              {topdressingMaterials.sandBags > 0 && (
                <li className="flex justify-between gap-3">
                  <span>Sharp sand (25kg ≈ {SHARP_SAND_BAG_LITRES}L)</span>
                  <span className="font-black tabular-nums">{topdressingMaterials.sandBags}</span>
                </li>
              )}
              {topdressingMaterials.compostBags > 0 && (
                <li className="flex justify-between gap-3">
                  <span>Compost ({COMPOST_BAG_LITRES}L bags)</span>
                  <span className="font-black tabular-nums">{topdressingMaterials.compostBags}</span>
                </li>
              )}
            </ul>
          </div>
        </dl>

        <p className="mt-3 text-[10px] text-amber-900/75 leading-relaxed italic">
          Depth × area: {TOPDRESS_DEPTH_MM}mm over{' '}
          {formatLitres(topdressingMaterials.effectiveSqm)} SQM ={' '}
          {formatLitres(topdressingMaterials.effectiveSqm)} × {TOPDRESS_DEPTH_MM} ={' '}
          {formatLitres(topdressingMaterials.totalLitres)} litres total, split as{' '}
          {selectedTopdressingGoal.mixLabel.toLowerCase()}. Bag counts round up so you don&apos;t
          run short on site. Adjust lawn size in Setup if needed.
        </p>
      </div>
    </>
  );
}
