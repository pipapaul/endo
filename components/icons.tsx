import type { SVGProps } from "react";

export function BauchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 96.91 96.91"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="48.45" cy="48.45" r="48.45" fill="currentColor" fillOpacity={0.2} />
      <ellipse cx="48.5" cy="64.46" rx="3.02" ry="3.9" fill="currentColor" fillOpacity={0.6} />
      <ellipse cx="48.5" cy="63.72" rx="4.33" ry="6.61" fill="currentColor" fillOpacity={0.1} />
    </svg>
  );
}

export function MedicationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 96.91 96.91"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="48.45" cy="48.45" r="48.45" fill="currentColor" fillOpacity={0.2} />
      <path
        d="M37.83 44.05c6.13 0 11.11 4.98 11.11 11.11v18.95H26.72V55.16c0-6.13 4.98-11.11 11.11-11.11Z"
        transform="translate(22.79 127.6) rotate(-135)"
        fill="currentColor"
        fillOpacity={0.3}
      />
      <path
        d="M59.08 22.79c6.13 0 11.11 4.98 11.11 11.11v18.95H47.97V33.9c0-6.13 4.98-11.11 11.11-11.11Z"
        transform="translate(44.05 -30.7) rotate(45)"
        fill="currentColor"
        fillOpacity={0.7}
      />
    </svg>
  );
}

export function PeriodIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 96.91 96.91"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="48.45" cy="48.45" r="48.45" fill="#fff" />
      <circle cx="48.45" cy="48.45" r="48.45" fill="currentColor" fillOpacity={0.2} />
      <path
        d="M64.75 53.86c0-9-16.29-34.73-16.29-34.73S32.17 44.86 32.17 53.86s7.3 16.29 16.29 16.29 16.29-7.3 16.29-16.29Z"
        fill="currentColor"
        fillOpacity={0.7}
      />
    </svg>
  );
}

export function SleepIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 96.91 96.91"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="48.45" cy="48.45" r="48.45" fill="currentColor" fillOpacity={0.2} />
      <path
        d="M32.31 57.05c-3.29 0-6.57-.45-9.82-1.35-.8-.22-1.27-1.05-1.05-1.84.22-.8 1.05-1.27 1.84-1.05 5.98 1.65 12.06 1.65 18.08 0 .8-.22 1.62.25 1.84 1.05.22.8-.25 1.62-1.05 1.84-3.27.9-6.57 1.34-9.85 1.34Z"
        fill="currentColor"
        fillOpacity={0.7}
      />
      <path
        d="M64.56 57.05c-3.29 0-6.57-.45-9.82-1.35-.8-.22-1.27-1.05-1.05-1.84.22-.8 1.05-1.27 1.84-1.05 5.98 1.65 12.06 1.65 18.08 0 .8-.22 1.62.25 1.84 1.05.22.8-.25 1.62-1.05 1.84-3.27.9-6.57 1.34-9.85 1.34Z"
        fill="currentColor"
        fillOpacity={0.7}
      />
    </svg>
  );
}

export function PainIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 96.91 96.91"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {[48.45, 40, 31.55, 23.1, 14.64, 6.19].map((radius) => (
        <circle
          key={radius}
          cx="48.97"
          cy="47.94"
          r={radius}
          fill="currentColor"
          fillOpacity={0.2}
        />
      ))}
    </svg>
  );
}

export function SymptomsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 96.91 96.91"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="48.45" cy="48.45" r="48.45" fill="currentColor" fillOpacity={0.2} />
      <circle cx="39.18" cy="64.48" r="19.78" fill="currentColor" fillOpacity={0.2} />
      <circle cx="48.45" cy="27.79" r="15.09" fill="currentColor" fillOpacity={0.6} />
      <circle cx="66.58" cy="44.24" r="19.78" fill="currentColor" fillOpacity={0.2} />
    </svg>
  );
}

export function NotesTagsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 96.91 96.91"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="48.45" cy="48.45" r="48.45" fill="#fff" />
      <circle cx="48.45" cy="48.45" r="48.45" fill="currentColor" fillOpacity={0.15} />
      <path
        d="M64.63 19.46H34.58c-3.45 0-6.27 2.69-6.49 6.08h-.74c-1.28 0-2.31 1.03-2.31 2.31s1.03 2.31 2.31 2.31h.72v3.64h-.72c-1.28 0-2.31 1.03-2.31 2.31s1.03 2.31 2.31 2.31h.72v3.64h-.72c-1.28 0-2.31 1.03-2.31 2.31s1.03 2.31 2.31 2.31h.72v3.64h-.72c-1.28 0-2.31 1.03-2.31 2.31s1.03 2.31 2.31 2.31h.72v3.64h-.72c-1.28 0-2.31 1.03-2.31 2.31s1.03 2.31 2.31 2.31h.72v3.64h-.72c-1.28 0-2.31 1.03-2.31 2.31s1.03 2.31 2.31 2.31h.74c.22 3.4 3.04 6.08 6.49 6.08h30.05c3.6 0 6.51-2.92 6.51-6.51V25.97c0-3.6-2.92-6.51-6.51-6.51Z"
        fill="currentColor"
        fillOpacity={0.7}
      />
      <path
        d="M79.5 67.52c-2.42 0-4.38-1.96-4.38-4.38V36.72c0-.72.17-1.44.48-2.09l2.81-5.74c.54-.73 1.63-.73 2.17 0l2.81 5.74c.32.65.48 1.37.48 2.09v26.42c0 2.42-1.96 4.38-4.38 4.38Z"
        fill="currentColor"
        fillOpacity={0.48}
      />
      <path
        d="M79.5 37.05c1.55 0 3.02-.37 4.32-1.01-.07-.49-.21-.96-.43-1.41l-2.81-5.74c-.54-.73-1.63-.73-2.17 0l-2.81 5.74c-.22.45-.36.92-.43 1.41 1.31.64 2.77 1.01 4.32 1.01Z"
        fill="currentColor"
        fillOpacity={0.12}
      />
      <path
        d="M79.5 30.06c.53 0 1.03-.16 1.45-.41l-.37-.75c-.54-.73-1.63-.73-2.17 0l-.37.75c.43.26.92.41 1.45.41Z"
        fill="#fff"
      />
    </svg>
  );
}

export function CervixMucusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 96.91 96.91"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="48.45" cy="48.45" r="48.45" fill="#fff" />
      <circle cx="48.45" cy="48.45" r="48.45" fill="currentColor" fillOpacity={0.2} />
      <ellipse cx="48.45" cy="42" rx="18" ry="12" fill="currentColor" fillOpacity={0.5} />
      <ellipse cx="48.45" cy="58" rx="14" ry="10" fill="currentColor" fillOpacity={0.4} />
      <ellipse cx="48.45" cy="50" rx="8" ry="6" fill="currentColor" fillOpacity={0.7} />
    </svg>
  );
}

export function OptionalValuesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 96.91 96.91"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="48.45" cy="48.45" r="48.45" fill="#fff" />
      <circle cx="48.45" cy="48.45" r="48.45" fill="currentColor" fillOpacity={0.15} />
      <rect
        x="43.29"
        y="29.07"
        width="10.32"
        height="38.78"
        rx="2.65"
        ry="2.65"
        fill="currentColor"
      />
      <rect
        x="29.07"
        y="43.29"
        width="38.78"
        height="10.32"
        rx="2.65"
        ry="2.65"
        fill="currentColor"
      />
    </svg>
  );
}
