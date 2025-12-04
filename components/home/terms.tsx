"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Labeled } from "@/components/Labeled";
import InfoTip from "@/components/InfoTip";
import { TERMS, type TermDescriptor, type TermKey } from "@/lib/terms";

export function TermField({ termKey, htmlFor, children }: { termKey: TermKey; htmlFor?: string; children: ReactNode }) {
  const term: TermDescriptor = TERMS[termKey];
  const meta = term.optional ? (
    <Badge className="bg-amber-100 text-amber-800">
      {term.deviceNeeded ? `Optional (Hilfsmittel nötig: ${term.deviceNeeded})` : "Optional"}
    </Badge>
  ) : null;
  return (
    <Labeled label={term.label} tech={term.tech} help={term.help} htmlFor={htmlFor} meta={meta}>
      {children}
    </Labeled>
  );
}

export function TermHeadline({ termKey }: { termKey: TermKey }) {
  const term: TermDescriptor = TERMS[termKey];
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-rose-900">
      <span>{term.label}</span>
      {term.optional ? (
        <Badge className="bg-amber-100 text-amber-800">
          {term.deviceNeeded ? `Optional (Hilfsmittel nötig: ${term.deviceNeeded})` : "Optional"}
        </Badge>
      ) : null}
      {term.help ? <InfoTip tech={term.tech ?? term.label} help={term.help} /> : null}
    </div>
  );
}
