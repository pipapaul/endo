import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-rose-100 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-rose-200 placeholder:text-rose-400",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
