import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        variant === "outline"
          ? "border border-rose-200 text-rose-800"
          : "bg-rose-100 text-rose-800",
        className
      )}
      {...props}
    />
  );
}
