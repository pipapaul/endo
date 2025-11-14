import * as React from "react";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

export interface BackButtonProps extends Omit<ButtonProps, "children"> {
  children: React.ReactNode;
}

export function BackButton({ children, className, ...props }: BackButtonProps): JSX.Element {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-auto gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 hover:text-rose-800",
        className
      )}
      {...props}
    >
      <ChevronLeft aria-hidden="true" className="h-4 w-4" />
      <span className="leading-none">{children}</span>
    </Button>
  );
}

export default BackButton;
