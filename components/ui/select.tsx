import * as React from "react";
import { cn } from "@/lib/utils";

type SelectContextValue = {
  value?: string;
  setValue: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  registerItem: (value: string, label: string) => void;
  unregisterItem: (value: string) => void;
  getLabel: (value?: string) => string | undefined;
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function Select({ value: controlled, defaultValue, onValueChange, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue);
  const [open, setOpen] = React.useState(false);
  const itemsRef = React.useRef(new Map<string, string>());
  const [, forceUpdate] = React.useState(0);
  const value = controlled ?? internalValue;

  const setValue = React.useCallback(
    (next: string) => {
      if (controlled === undefined) {
        setInternalValue(next);
      }
      onValueChange?.(next);
      setOpen(false);
    },
    [controlled, onValueChange]
  );

  const registerItem = React.useCallback(
    (val: string, label: string) => {
      itemsRef.current.set(val, label);
      forceUpdate((x) => x + 1);
    },
    [forceUpdate]
  );

  const unregisterItem = React.useCallback(
    (val: string) => {
      itemsRef.current.delete(val);
      forceUpdate((x) => x + 1);
    },
    [forceUpdate]
  );

  const getLabel = React.useCallback((val?: string) => {
    if (!val) return undefined;
    return itemsRef.current.get(val);
  }, []);

  return (
    <SelectContext.Provider
      value={{ value, setValue, open, setOpen, registerItem, unregisterItem, getLabel }}
    >
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error("SelectTrigger must be used within Select");
  return (
    <button
      type="button"
      onClick={() => context.setOpen(!context.open)}
      className={cn(
        "flex w-full items-center justify-between rounded-lg border border-rose-100 bg-white px-3 py-2 text-sm shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string;
}

export function SelectValue({ placeholder, className, ...props }: SelectValueProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error("SelectValue must be used within Select");
  const label = context.getLabel(context.value);
  return (
    <span className={cn("text-left", !label && "text-zinc-400", className)} {...props}>
      {label ?? placeholder ?? ""}
    </span>
  );
}

export function SelectContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error("SelectContent must be used within Select");
  if (!context.open) return null;
  return (
    <div
      className={cn(
        "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-rose-100 bg-white py-1 shadow-lg",
        className
      )}
      {...props}
    />
  );
}

export interface SelectItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function SelectItem({ value, children, className, ...props }: SelectItemProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error("SelectItem must be used within Select");

  React.useEffect(() => {
    context.registerItem(value, String(children));
    return () => context.unregisterItem(value);
  }, [context, value, children]);

  const isActive = context.value === value;

  return (
    <button
      type="button"
      onClick={() => context.setValue(value)}
      className={cn(
        "flex w-full items-center px-3 py-2 text-left text-sm transition",
        isActive ? "bg-rose-100 text-rose-700" : "hover:bg-rose-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
