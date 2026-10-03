import React from 'react';

export default function ToggleSwitch({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  activeColor = 'bg-brand-500', // or 'bg-emerald-500', 'bg-amber-500'
}) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="relative inline-flex items-center mt-0.5">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => !disabled && onChange && onChange(e.target.checked)}
        />
        <div
          className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${
            checked ? activeColor : 'bg-slate-300'
          }`}
        ></div>
        <div
          className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow-sm ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        ></div>
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-semibold text-slate-900">{label}</span>}
          {description && <span className="text-xs text-slate-500 leading-relaxed">{description}</span>}
        </div>
      )}
    </label>
  );
}
