"use client";

import { useEffect, type ReactNode } from "react";
import { HandHeart, Heart, ListOrdered, BarChart3, X } from "lucide-react";
import {
  IG_LIVE_SHEET_TITLES,
  type IgLiveSheetAction,
} from "@/lib/experience/ig-live-config";

type IgLiveSheetProps = {
  action: IgLiveSheetAction;
  onClose: () => void;
  onSelectAction: (action: Exclude<IgLiveSheetAction, null | "more">) => void;
  children: ReactNode;
};

const MORE_ITEMS: {
  id: Exclude<IgLiveSheetAction, null | "more">;
  label: string;
  icon: typeof Heart;
}[] = [
  { id: "prayer", label: "Prayer", icon: HandHeart },
  { id: "give", label: "Give Seeds", icon: Heart },
  { id: "program", label: "Event Program", icon: ListOrdered },
  { id: "polls", label: "Live Polls", icon: BarChart3 },
];

export default function IgLiveSheet({
  action,
  onClose,
  onSelectAction,
  children,
}: IgLiveSheetProps) {
  useEffect(() => {
    if (!action) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [action, onClose]);

  if (!action) return null;

  const title =
    action === "more"
      ? "More"
      : IG_LIVE_SHEET_TITLES[action];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ig-live-sheet-title"
        className="ig-live-sheet relative flex max-h-[min(88dvh,720px)] w-full flex-col rounded-t-3xl border-t border-brand-border bg-brand-panel/95 backdrop-blur-xl md:my-4 md:mr-4 md:max-h-[calc(100dvh-2rem)] md:w-[min(28rem,92vw)] md:rounded-2xl md:border"
      >
        <div className="flex shrink-0 flex-col items-center border-b border-brand-border px-4 py-3">
          <span className="mb-3 h-1 w-10 rounded-full bg-white/20 md:hidden" aria-hidden="true" />
          <div className="flex w-full items-center justify-between gap-3">
            <h2
              id="ig-live-sheet-title"
              className="font-ui text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="touch-target rounded-lg border border-brand-border p-2 text-brand-muted transition hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {action === "more" ? (
            <ul className="space-y-2">
              {MORE_ITEMS.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onSelectAction(id)}
                    className="touch-target flex w-full items-center gap-3 rounded-xl border border-brand-border bg-black/30 px-4 py-3 text-left transition hover:border-brand-blue/35 hover:bg-black/45"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-brand-blue" aria-hidden="true" />
                    <span className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.12em] text-white">
                      {label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
