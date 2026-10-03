import React from 'react';

export default function Badge({
  children,
  variant = 'default', // 'primary', 'accent', 'mastered', 'review', 'hard', 'streak', 'muted'
  size = 'md',
  className = '',
  dot = false,
}) {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 rounded-md font-medium',
    md: 'text-xs px-2.5 py-1 rounded-lg font-medium',
    lg: 'text-sm px-3 py-1 rounded-lg font-semibold',
  };

  const variantClasses = {
    primary: 'bg-brand-50 text-brand-700 border border-brand-200',
    accent: 'bg-accent-50 text-sky-700 border border-sky-200',
    mastered: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    review: 'bg-sky-50 text-sky-700 border border-sky-200',
    hard: 'bg-rose-50 text-rose-700 border border-rose-200',
    streak: 'bg-orange-50 text-orange-700 border border-orange-200',
    muted: 'bg-slate-100 text-slate-600 border border-slate-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  };

  const dotClasses = {
    primary: 'bg-brand-500',
    accent: 'bg-accent-400',
    mastered: 'bg-emerald-500',
    review: 'bg-sky-500',
    hard: 'bg-rose-500',
    streak: 'bg-orange-500',
    muted: 'bg-slate-400',
    warning: 'bg-amber-500',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} ${variantClasses[variant] || variantClasses.muted} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotClasses[variant] || dotClasses.muted}`} />}
      {children}
    </span>
  );
}
