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
    <Wrapper className="block" {...(htmlFor ? { htmlFor } : { role: "group" })}>
      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-rose-900">
        <span className="leading-snug">{label}</span>
        {meta ? <span className="leading-snug">{meta}</span> : null}
        {help ? <InfoTip tech={tech ?? label} help={help} /> : null}
      </span>
      <div className="mt-2">{children}</div>
    </Wrapper>
  );
}
