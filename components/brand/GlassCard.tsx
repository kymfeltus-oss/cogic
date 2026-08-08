import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function GlassCard({
  children,
  className = "",
  featured = false,
  as: Tag = "article",
}: {
  children: ReactNode;
  className?: string;
  featured?: boolean;
  as?: "article" | "section" | "div";
}) {
  return (
    <Tag
      className={cn(
        "brand-glass-card",
        featured && "brand-gradient-border",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
