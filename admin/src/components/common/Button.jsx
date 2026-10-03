import React from 'react';

export default function Button({
  children,
  variant = 'primary', // 'primary', 'secondary', 'danger', 'outline', 'ghost', 'streak'
  size = 'md',        // 'sm', 'md', 'lg'
  icon: Icon,
  iconPosition = 'left',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  const variantClasses = {
    primary: 'bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/20 focus:ring-brand-500 active:scale-[0.98]',
    secondary: 'bg-accent-400 hover:bg-accent-500 text-white shadow-md shadow-accent-400/20 focus:ring-accent-400 active:scale-[0.98]',
    danger: 'bg-hard-500 hover:bg-hard-600 text-white shadow-md shadow-hard-500/20 focus:ring-hard-500 active:scale-[0.98]',
    outline: 'border border-inglyBorder bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-300 focus:ring-brand-500',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-300',
    streak: 'bg-gradient-to-r from-streak-DEFAULT to-amber-500 hover:opacity-95 text-white shadow-md shadow-streak-DEFAULT/25',
    success: 'bg-mastered-DEFAULT hover:bg-emerald-600 text-white shadow-md shadow-mastered-DEFAULT/20',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
      {children}
      {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
    </button>
  );
}
