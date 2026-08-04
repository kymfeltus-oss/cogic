"use client";

type LiveActionSheetProps = {
  open: boolean;
  onClose: () => void;
  onReport: () => void;
  onShare: () => void;
  onCopyLink: () => void;
};

export default function LiveActionSheet({
  open,
  onClose,
  onReport,
  onShare,
  onCopyLink,
}: LiveActionSheetProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close actions"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/10 bg-brand-panel/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <div className="space-y-2">
          <SheetButton label="Report" onClick={onReport} />
          <SheetButton label="Share" onClick={onShare} />
          <SheetButton label="Copy link" onClick={onCopyLink} />
          <SheetButton label="Cancel" onClick={onClose} muted />
        </div>
      </div>
    </div>
  );
}

function SheetButton({
  label,
  onClick,
  muted = false,
}: {
  label: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-target w-full rounded-2xl px-4 py-3 font-ui text-sm font-semibold ${
        muted
          ? "bg-white/5 text-brand-muted"
          : "bg-white/8 text-white hover:bg-white/12"
      }`}
    >
      {label}
    </button>
  );
}
