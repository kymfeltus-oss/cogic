"use client";

import { FormEvent, useRef } from "react";
import Link from "next/link";
import { buildAttendeeGateUrl } from "@/lib/auth/routing";
import { FELLOWSHIP_MAX_CONTENT_LENGTH } from "@/lib/experience/fellowship-chat";
import type { FellowshipChatSession } from "@/lib/experience/fellowship-chat";

type IanCraigLiveComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  session: FellowshipChatSession;
  isSending: boolean;
  chatError: string | null;
  signInHref: string;
  variant: "overlay" | "sidebar";
};

export default function IanCraigLiveComposer({
  draft,
  onDraftChange,
  onSubmit,
  session,
  isSending,
  chatError,
  signInHref,
  variant,
}: IanCraigLiveComposerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const wrapperClass =
    variant === "overlay"
      ? "ian-craig-live-mobile-composer absolute inset-x-[clamp(0.75rem,3vw,1.25rem)] z-30"
      : "shrink-0 pt-3";

  if (!session.authenticated) {
    return (
      <div className={wrapperClass}>
        <div className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-3 backdrop-blur-md">
          <p className="min-w-0 flex-1 font-body text-sm text-white/75 viewer-pov-text-shadow">
            Sign in to join the conversation
          </p>
          <Link
            href={buildAttendeeGateUrl(signInHref)}
            className="touch-target shrink-0 rounded-full border border-brand-blue/40 bg-brand-blue/10 px-4 py-2 font-ui text-[0.58rem] font-bold uppercase tracking-[0.12em] text-brand-blue"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!session.canSend) {
    return (
      <div className={wrapperClass}>
        <p className="rounded-full bg-black/50 px-5 py-3 text-center font-body text-sm text-brand-muted backdrop-blur-md">
          You are muted in Fellowship Chat.
        </p>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      {chatError ? (
        <p className="mb-2 truncate text-center font-body text-xs text-brand-pink">{chatError}</p>
      ) : null}
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`ian-craig-composer-${variant}`}>
          Join the conversation
        </label>
        <input
          ref={inputRef}
          id={`ian-craig-composer-${variant}`}
          type="text"
          enterKeyHint="send"
          inputMode="text"
          autoComplete="off"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Join the conversation..."
          disabled={isSending}
          maxLength={FELLOWSHIP_MAX_CONTENT_LENGTH}
          className="h-12 min-w-0 flex-1 rounded-full border border-white/10 bg-black/50 px-4 font-body text-base text-white placeholder:text-white/50 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-brand-blue/35"
        />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          className="touch-target shrink-0 rounded-full border border-brand-blue/40 bg-brand-blue/15 px-4 py-3 font-ui text-[0.58rem] font-bold uppercase tracking-[0.12em] text-brand-blue disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
