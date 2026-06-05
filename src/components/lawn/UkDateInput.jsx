import React, { useEffect, useRef, useState } from 'react';
import { formatInputDate, formatUkDate, parseUkDate } from '../../utils/lawnDates';

/** @param {{ id?: string, value: string, onChange: (value: string) => void, max?: string, disabled?: boolean, className?: string }} props */
export function UkDateInput({ id, value, onChange, max, disabled, className }) {
  const [text, setText] = useState(() => formatUkDate(value));
  const nativeInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  useEffect(() => {
    setText(formatUkDate(value));
  }, [value]);

  const handleBlur = () => {
    const parsed = parseUkDate(text);
    if (!parsed || (max && parsed > max)) {
      setText(formatUkDate(value));
      return;
    }
    onChange(parsed);
    setText(formatUkDate(parsed));
  };

  const handleNativeChange = (event) => {
    const iso = event.target.value;
    if (!iso) return;
    if (max && iso > max) return;
    onChange(iso);
    setText(formatUkDate(iso));
  };

  const openCalendar = () => {
    const input = nativeInputRef.current;
    if (!input || disabled) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.click();
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={handleBlur}
        disabled={disabled}
        className={`${className ?? ''} pr-9`.trim()}
      />
      <button
        type="button"
        onClick={openCalendar}
        disabled={disabled}
        aria-label="Open calendar"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-sm text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        📅
      </button>
      <input
        ref={nativeInputRef}
        type="date"
        value={value || ''}
        max={max}
        onChange={handleNativeChange}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
    </div>
  );
}
