import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function IconBadge({
  icon: Icon,
  className = "",
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("brand-icon-badge", className)}>
      <Icon aria-hidden="true" className="size-5" />
    </div>
  );
}
