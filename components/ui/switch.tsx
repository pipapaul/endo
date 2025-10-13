import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, onCheckedChange, className, ...props }, ref) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange?.(!checked)}
        ref={ref}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full border border-rose-200 transition",
          checked ? "bg-rose-500" : "bg-white",
          className
        )}
        {...props}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
            checked ? "translate-x-5" : "translate-x-1"
          )}
        />
      </button>
    );
  }
);
Switch.displayName = "Switch";
