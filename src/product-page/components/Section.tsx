import type { ReactNode } from "react";

type SectionProps = {
  id: string;
  variant?: "default" | "muted" | "accent" | "inverse";
  ariaLabel?: string;
  children: ReactNode;
};

export function Section({ id, variant = "default", ariaLabel, children }: SectionProps) {
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={`pp-section pp-section--${variant}`}
      data-section={id}
    >
      <div className="pp-section__inner">{children}</div>
    </section>
  );
}
