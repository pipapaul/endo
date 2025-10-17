import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "ghost" | "outline";
type ButtonSize = "default" | "sm" | "icon";

const variantStyles: Record<ButtonVariant, string> = {
  default: "bg-rose-600 text-white hover:bg-rose-700",
  secondary: "bg-rose-100 text-rose-900 hover:bg-rose-200",
  ghost: "bg-transparent text-rose-700 hover:bg-rose-100",
  outline: "border border-rose-200 text-rose-800 hover:bg-rose-50",
};

const sizeStyles: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2 text-sm font-medium rounded-lg",
  sm: "h-8 px-3 text-sm rounded-md",
  icon: "h-9 w-9 rounded-full p-0",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1 transition-colors focus-visible:outline-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
