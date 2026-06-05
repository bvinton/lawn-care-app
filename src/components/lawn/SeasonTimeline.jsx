import React from 'react';
import { SEASONS, makeStepKey } from '../../data/LawnPackData';
import { formatDisplayDate } from '../../utils/lawnDates';
import { getStepAmounts } from '../../utils/lawnStepAmounts';
import { PET_SAFETY_CLASS } from '../../data/lawnUiConfig';
import { UkDateInput } from './UkDateInput';

/** @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props */
export default function SeasonTimeline({ app }) {
  const {
    currentSeason,
    setCurrentSeason,
    seasonManuallySelected,
    setSeasonManuallySelected,
    workflowSeason,
    isCatchUpMode,
    incompleteSpringSteps,
    activeSeason,
    sqm,
    userLogs,
    pendingDates,
    showsWeedolAdvisory,
    weedolClearanceLabel,
    weedolBarrierActive,
    weedolDaysRemaining,
    activeEquipment,
    handlePendingDateChange,
    handleLogTask,
    handleClearLog,
  } = app;

  return (
    <>
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(SEASONS).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setCurrentSeason(key);
                setSeasonManuallySelected(key !== workflowSeason);
              }}
              className={`p-2.5 text-xs font-bold rounded-lg border transition-all ${
                currentSeason === key
                  ? 'bg-green-600 text-white border-green-600 shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {SEASONS[key].name}
            </button>
          ))}
        </div>
        {seasonManuallySelected && currentSeason !== workflowSeason && (
          <p className="text-xs text-center text-amber-700 mt-2">
            Viewing {SEASONS[currentSeason].name}
            {isCatchUpMode ? (
              <>
                {' '}
                — finish Spring Pack first ({incompleteSpringSteps.length} step
                {incompleteSpringSteps.length !== 1 ? 's' : ''} left). Tap Spring Pack to continue
                catch-up.
              </>
            ) : (
              <>
                {' '}
                — recommended now is {SEASONS[workflowSeason].name}. Tap{' '}
                {SEASONS[workflowSeason].name} to follow the workflow.
              </>
            )}
          </p>
        )}
        {!seasonManuallySelected && isCatchUpMode && currentSeason === 'SPRING' && (
          <p className="text-xs text-center text-emerald-800 mt-2 font-medium">
            Catch-up: {SEASONS[app.calendarSeason].name} on the calendar — finishing Spring Pack first.
          </p>
        )}
        <p className="text-xs text-center text-gray-500 mt-2 italic">{activeSeason.focus}</p>
      </div>

      <div className="space-y-0">
        <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">
          Sequential Timeline — {sqm} SQM
        </h3>

        {activeSeason.steps.map((step, index) => {
          const stepKey = makeStepKey(currentSeason, step.id);
          const completedDate = userLogs[stepKey] ?? null;
          const isCompleted = completedDate !== null;
          const isWeedolAdvisoryStep = showsWeedolAdvisory(step);
          const amounts = getStepAmounts(step, sqm);
          const isLast = index === activeSeason.steps.length - 1;
          const dateInputValue = isCompleted
            ? completedDate
            : pendingDates[currentSeason]?.[step.id];

          return (
            <div key={stepKey} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    isCompleted
                      ? 'bg-green-600 text-white'
                      : isWeedolAdvisoryStep
                        ? 'bg-amber-100 text-amber-800 border-2 border-amber-400'
                        : 'bg-gray-100 text-gray-500 border-2 border-gray-200'
                  }`}
                >
                  {isCompleted ? '✅' : index + 1}
                </div>
                {!isLast && (
                  <div
                    className={`w-0.5 flex-1 min-h-[1rem] ${isCompleted ? 'bg-green-300' : 'bg-gray-200'}`}
                  />
                )}
              </div>

              <div
                className={`flex-1 mb-4 p-4 rounded-xl border transition-all ${
                  isWeedolAdvisoryStep
                    ? 'bg-amber-50 border-amber-200'
                    : isCompleted
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4
                    className={`text-sm font-bold ${isWeedolAdvisoryStep ? 'text-amber-900' : 'text-gray-900'}`}
                  >
                    {step.label}
                  </h4>
                  {isCompleted && (
                    <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
                      ✅ {formatDisplayDate(completedDate)}
                    </span>
                  )}
                </div>

                {isWeedolAdvisoryStep && weedolClearanceLabel && (
                  <div className="mb-3 p-3 bg-amber-100 rounded-lg border border-amber-300 text-xs text-amber-900 font-medium leading-relaxed">
                    {weedolBarrierActive ? (
                      <>
                        ⏳ TIMELINE ADVISORY: Weedol barrier active. Do not complete this step until{' '}
                        <strong>{weedolClearanceLabel}</strong> ({weedolDaysRemaining} day
                        {weedolDaysRemaining !== 1 ? 's' : ''} remaining).
                      </>
                    ) : (
                      <>
                        ✅ Weedol clearance date was <strong>{weedolClearanceLabel}</strong> — safe to
                        proceed when conditions are right (soil temp, dry weather).
                      </>
                    )}
                  </div>
                )}

                {step.dogSafety && (
                  <div className={PET_SAFETY_CLASS}>
                    <span className="shrink-0">🐶</span>
                    <span>PET SAFETY: {step.dogSafety}</span>
                  </div>
                )}

                {amounts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {amounts.map((amount, amountIdx) => (
                      <span
                        key={amountIdx}
                        className="font-mono text-xs font-bold text-green-700 bg-white px-2 py-0.5 rounded border border-green-100"
                      >
                        {amount.name ? `${amount.name}: ` : 'Required Dose: '}
                        {Number.isInteger(amount.total) ? amount.total : amount.total.toFixed(1)}
                        {amount.unit}
                      </span>
                    ))}
                  </div>
                )}

                {step.toolType === 'sprayer' && step.ratePerSqm != null && (
                  <p className="text-xs text-blue-800 bg-blue-50 p-2.5 rounded-lg border border-blue-100 mt-2 leading-relaxed">
                    {activeEquipment.instructionTemplate(
                      Math.round(step.ratePerSqm * sqm),
                      step.setting
                    )}
                  </p>
                )}

                {step.note && (
                  <p className="text-xs text-gray-500 mt-2 font-medium bg-white/60 p-2 rounded">
                    {step.note}
                  </p>
                )}

                <div className="mt-3 pt-3 border-t border-gray-200/60 flex flex-col sm:flex-row sm:items-end gap-2">
                  <div className="flex-1">
                    <label
                      htmlFor={`date-${stepKey}`}
                      className="block text-xs font-semibold text-gray-600 mb-1"
                    >
                      Target Date (DD/MM/YYYY)
                    </label>
                    <UkDateInput
                      id={`date-${stepKey}`}
                      value={dateInputValue ?? ''}
                      onChange={(nextValue) => handlePendingDateChange(step.id, nextValue)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleLogTask(step.id)}
                      className="bg-green-700 hover:bg-green-800 text-white text-xs font-bold py-2 px-3 rounded-lg transition-all shadow-sm"
                    >
                      Log Task
                    </button>
                    {isCompleted && (
                      <button
                        type="button"
                        onClick={() => handleClearLog(step.id)}
                        className="text-xs font-bold py-2 px-3 rounded-lg border border-red-200 text-red-600 bg-white hover:bg-red-50"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeSeason.generalGuidelines && (
        <section className="mt-8 pt-6 border-t border-green-100">
          <h3 className="font-bold text-gray-800 mb-4">
            📖 Master Guide: Seasonal Maintenance & Best Practices
          </h3>

          <div className="rounded-xl border border-green-100 bg-white p-4 md:p-5 shadow-sm">
            <p className="text-sm text-gray-600 italic leading-relaxed mb-5">
              {activeSeason.generalGuidelines.overview}
            </p>

            <div className="space-y-3">
              {activeSeason.generalGuidelines.bullets.map((bullet, bulletIdx) => (
                <div
                  key={bulletIdx}
                  className="rounded-lg bg-green-50/30 border border-green-100/80 p-3.5"
                >
                  <p className="text-xs font-bold text-green-900 mb-1.5">{bullet.title}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{bullet.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
