import { ButtonHTMLAttributes, ReactNode, cloneElement, isValidElement } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
  asChild?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  asChild = false,
  ...props
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center font-semibold rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

  const variants = {
    primary: "bg-[#FF6B35] text-white hover:bg-[#FF8B68] shadow-lg hover:shadow-xl hover:scale-105",
    secondary: "bg-white border-2 border-[#FF6B35] text-[#FF6B35] hover:bg-orange-50",
    ghost: "text-[#FF6B35] hover:bg-orange-50",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  if (asChild && isValidElement<{ className?: string }>(children)) {
    // Clone the child element so the button classes actually apply to it
    return cloneElement(children, {
      className: `${classes} ${children.props.className ?? ''}`.trim(),
    });
  }

  return (
    <button
      className={classes}
      {...props}
    >
      {children}
    </button>
  );
}
