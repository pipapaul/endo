import type { ReactNode } from "react";

import InfoTip from "./InfoTip";

type Props = {
  label: string;
  tech?: string;
  help?: string;
  htmlFor?: string;
  meta?: ReactNode;
  children: ReactNode;
};

export function Labeled({ label, tech, help, htmlFor, meta, children }: Props) {
  const Wrapper = (htmlFor ? "label" : "div") as "label" | "div";
  return (
    <Wrapper
      className="block rounded-lg border border-rose-100/60 bg-gradient-to-b from-rose-50/30 to-transparent p-3"
      {...(htmlFor ? { htmlFor } : { role: "group" })}
    >
      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-rose-800">
        <span className="leading-snug">{label}</span>
        {meta ? <span className="leading-snug">{meta}</span> : null}
        {help ? <InfoTip tech={tech ?? label} help={help} /> : null}
      </span>
      <div className="mt-3">{children}</div>
    </Wrapper>
  );
}
