import React from 'react';

export default function Card({
  children,
  className = '',
  hoverEffect = false,
  padding = 'default', // 'none', 'sm', 'default', 'lg'
  header,
  footer,
}) {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-4',
    default: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-inglyBorder shadow-sm transition-all duration-200 ${
        hoverEffect ? 'hover:shadow-md hover:border-slate-300' : ''
      } ${className}`}
    >
      {header && (
        <div className="px-6 py-4 border-b border-inglyBorder flex items-center justify-between">
          {header}
        </div>
      )}
      <div className={paddingClasses[padding]}>{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t border-inglyBorder bg-slate-50/50 rounded-b-2xl">
          {footer}
        </div>
      )}
    </div>
  );
}
