import * as React from "react";

import { cn } from "@/lib/utils";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        "h-4 w-4 rounded border border-rose-300 bg-white text-rose-600 transition",
        "checked:bg-rose-600 checked:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300",
        className
      )}
      {...props}
    />
  )
);
Checkbox.displayName = "Checkbox";

export default Checkbox;
