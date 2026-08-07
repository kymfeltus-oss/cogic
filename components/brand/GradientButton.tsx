import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CommonProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
};

export default function GradientButton({
  children,
  className = "",
  href,
  disabled,
  type = "button",
  onClick,
}: CommonProps & {
  href?: string;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  const classes = cn("brand-gradient-button", className);

  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
