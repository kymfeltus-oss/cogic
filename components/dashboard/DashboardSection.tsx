import type { ReactNode } from "react";

export default function DashboardSection({
  eyebrow,
  title,
  action,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`cl-section ${className}`.trim()} aria-label={title}>
      <header className="cl-section__head">
        <div>
          {eyebrow ? <p className="cl-section__eyebrow">{eyebrow}</p> : null}
          <h2 className="cl-section__title">{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
