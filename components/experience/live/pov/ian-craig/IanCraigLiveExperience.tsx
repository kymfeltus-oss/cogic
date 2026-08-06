"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import IanCraigLiveMobileDock from "@/components/experience/live/pov/ian-craig/IanCraigLiveMobileDock";
import IanCraigLiveHeader from "@/components/experience/live/pov/ian-craig/IanCraigLiveHeader";
import IanCraigLiveChatFeed, {
  IanCraigLiveChatFeedSidebar,
} from "@/components/experience/live/pov/ian-craig/IanCraigLiveChatFeed";
import IanCraigLiveComposer from "@/components/experience/live/pov/ian-craig/IanCraigLiveComposer";
import { IanCraigLiveDashboardSidebar } from "@/components/experience/live/pov/ian-craig/IanCraigLiveDashboard";
import IanCraigLiveReactionsRail from "@/components/experience/live/pov/ian-craig/IanCraigLiveReactionsRail";
import IanCraigLiveVideoStage from "@/components/experience/live/pov/ian-craig/IanCraigLiveVideoStage";
import {
  mapFellowshipToIanCraigLine,
} from "@/components/experience/live/pov/ian-craig/ian-craig-live-types";
import { shouldDisplayViewerCount } from "@/lib/live/attendee-live-honesty";
import ExperienceGivingPanel from "@/components/experience/live/ExperienceGivingPanel";
import ExperiencePrayerPanel from "@/components/experience/live/ExperiencePrayerPanel";
import IgLiveSheet from "@/components/experience/live/ig/IgLiveSheet";
import LiveActionSheet from "@/components/live/LiveActionSheet";
import { useIgLiveChat } from "@/components/experience/live/ig/IgLiveChatContext";
import type { IgLiveSheetAction } from "@/lib/experience/ig-live-config";
import { useIanCraigLiveLayout } from "@/lib/experience/useIanCraigLiveLayout";
import { useIanCraigLiveSeedActions } from "@/lib/experience/useIanCraigLiveSeedActions";
import { useLiveElapsedTimer } from "@/lib/experience/useLiveElapsedTimer";
import { useLiveStreamReactions } from "@/lib/experience/LiveStreamReactionsContext";
import { useAttendeeLiveNavTarget } from "@/lib/experience/useAttendeeLiveNavTarget";
import { useLiveViewerCount } from "@/lib/experience/useLiveViewerCount";
import { useCountdownConfig } from "@/lib/useCountdownConfig";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";
import { DEVICE_FIT_VIEWPORT } from "@/lib/responsive";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

const CHAT_VISIBLE_LIMIT = 12;

type IanCraigLiveExperienceProps = {
  profile: AttendeeProfileSnapshot;
  onProfileChange: (profile: AttendeeProfileSnapshot) => void;
};

export default function IanCraigLiveExperience({
  profile,
  onProfileChange,
}: IanCraigLiveExperienceProps) {
  const router = useRouter();
  const layout = useIanCraigLiveLayout();
  const { config } = useCountdownConfig();
  const { href: liveNavHref } = useAttendeeLiveNavTarget();
  const { messages, session, isSending, error: chatError, sendMessage, clearError } =
    useIgLiveChat();
  const { actualCount, displayLabel } = useLiveViewerCount({
    enabled: true,
    userId: profile.userId,
  });
  const viewerLabel = shouldDisplayViewerCount(actualCount) ? displayLabel : "";
  const { enabled: reactionsEnabled, isSending: isSendingHeart, sendReaction } =
    useLiveStreamReactions();
  const elapsedSeconds = useLiveElapsedTimer(config?.start_time);

  const [draft, setDraft] = useState("");
  const [sheetAction, setSheetAction] = useState<IgLiveSheetAction>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const openGiveSheet = useCallback(() => setSheetAction("give"), []);

  const {
    balance: seedBalance,
    usedFreeTaps,
    isLoading: seedBalanceLoading,
    isSowing,
    error: seedBalanceError,
    sowError,
    clearSowError,
    handleAddSeeds,
    handleSowSeed,
    refreshAfterGive,
  } = useIanCraigLiveSeedActions({ onOpenGiveSheet: openGiveSheet });

  const chatLines = useMemo(
    () => messages.slice(-CHAT_VISIBLE_LIMIT).map(mapFellowshipToIanCraigLine),
    [messages],
  );

  const showSidebar = layout === "tablet-sidebar" || layout === "desktop-split";
  const isMobileLayout = layout === "mobile";

  useEffect(() => {
    if (!isMobileLayout) return;

    const root = document.querySelector(".ian-craig-live--mobile");
    const dock = document.querySelector(".ian-craig-live-mobile-dock");
    if (!(root instanceof HTMLElement) || !(dock instanceof HTMLElement)) return;

    const syncDockOffset = () => {
      const dockHeight = Math.ceil(dock.getBoundingClientRect().height);
      root.style.setProperty("--ian-craig-dock-h", `${dockHeight}px`);
    };

    syncDockOffset();
    const observer = new ResizeObserver(syncDockOffset);
    observer.observe(dock);

    return () => observer.disconnect();
  }, [isMobileLayout]);

  useEffect(() => {
    if (!showSidebar) return;
    const node = document.getElementById("ian-craig-sidebar-chat-scroll");
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [chatLines.length, showSidebar]);

  const handleCloseExperience = useCallback(() => {
    router.push(ATTENDEE_DASHBOARD_PATH);
  }, [router]);

  const handlePrayAction = useCallback(() => {
    router.push("/experience/contact-us");
  }, [router]);

  const handleShare = useCallback(async () => {
    const { buildCanonicalLiveShareUrl } = await import("@/lib/sharing/canonical");
    const url = buildCanonicalLiveShareUrl();
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "COGIC LIVE",
          text: "Watch COGIC LIVE",
          url,
        });
        return;
      }
    } catch {
      /* fall through */
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2_000);
    }
  }, []);

  const handleMore = useCallback(() => {
    setActionSheetOpen(true);
  }, []);

  const handleSpawnHeart = useCallback(() => {
    if (!reactionsEnabled || isSendingHeart) return;
    void sendReaction("heart");
  }, [isSendingHeart, reactionsEnabled, sendReaction]);

  const handleCloseSheet = useCallback(() => {
    if (sheetAction === "give") {
      refreshAfterGive();
    }
    setSheetAction(null);
  }, [refreshAfterGive, sheetAction]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isSending || !session.authenticated || !session.canSend) return;

    void sendMessage(trimmed).then((sent) => {
      if (sent) setDraft("");
    });
  };

  const dashboardProps = {
    elapsedSeconds,
    seedBalance,
    seedBalanceLoading,
    seedBalanceError,
    topSupporter: { name: "—", initials: "", amount: 0 },
    viewerCount: actualCount,
    shareCopied,
    onAddSeeds: handleAddSeeds,
    onSowSeed: handleSowSeed,
    onPray: handlePrayAction,
    onShare: handleShare,
    onMore: handleMore,
  };

  const composerProps = {
    draft,
    onDraftChange: (value: string) => {
      clearError();
      setDraft(value);
    },
    onSubmit: handleSubmit,
    session,
    isSending,
    chatError,
    signInHref: liveNavHref,
  };

  return (
    <div
      className={`ian-craig-live ${DEVICE_FIT_VIEWPORT} bg-brand-black${
        isMobileLayout ? " ian-craig-live--mobile" : ""
      }`}
    >
      <div
        className={`ian-craig-live__grid grid h-full min-h-0 w-full ${
          showSidebar
            ? layout === "desktop-split"
              ? "grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(18rem,3fr)]"
              : "grid-cols-[minmax(0,1.75fr)_minmax(16rem,1fr)]"
            : "grid-cols-1"
        }`}
      >
        <div className="relative min-h-0 min-w-0">
          <IanCraigLiveVideoStage />

          <IanCraigLiveHeader
            viewerLabel={viewerLabel}
            profile={profile}
            onProfileChange={onProfileChange}
            onMore={handleMore}
            onClose={handleCloseExperience}
          />

          {isMobileLayout ? (
            <>
              <IanCraigLiveChatFeed lines={chatLines} variant="overlay" />
              <IanCraigLiveComposer {...composerProps} variant="overlay" />
              {sowError ? (
                <p
                  className="pointer-events-none absolute inset-x-4 z-30 text-center font-body text-xs text-brand-pink viewer-pov-text-shadow"
                  style={{ bottom: "calc(var(--ian-craig-dock-h) + var(--ian-craig-composer-h) + 0.25rem)" }}
                  role="status"
                >
                  {sowError}
                </p>
              ) : null}
              <IanCraigLiveMobileDock
                seedBalance={seedBalance}
                seedBalanceLoading={seedBalanceLoading}
                usedFreeTaps={usedFreeTaps}
                isSowing={isSowing}
                shareCopied={shareCopied}
                onAddSeeds={() => {
                  clearSowError();
                  handleAddSeeds();
                }}
                onSowSeed={() => {
                  clearSowError();
                  void handleSowSeed();
                }}
                onShare={handleShare}
                onMore={handleMore}
              />
            </>
          ) : null}

          <IanCraigLiveReactionsRail
            onSpawnHeart={handleSpawnHeart}
            isSendingHeart={isSendingHeart}
          />
        </div>

        {showSidebar ? (
          <aside className="flex min-h-0 min-w-0 flex-col border-l border-white/10 bg-brand-panel/80 p-[clamp(0.75rem,2vw,1.25rem)] backdrop-blur-xl">
            <IanCraigLiveChatFeedSidebar lines={chatLines} />
            <IanCraigLiveDashboardSidebar {...dashboardProps} />
            <IanCraigLiveComposer {...composerProps} variant="sidebar" />
          </aside>
        ) : null}
      </div>

      <IgLiveSheet
        action={sheetAction}
        onClose={handleCloseSheet}
        onSelectAction={(action) => setSheetAction(action)}
      >
        {sheetAction === "give" ? <ExperienceGivingPanel /> : null}
        {sheetAction === "prayer" ? <ExperiencePrayerPanel /> : null}
      </IgLiveSheet>

      <LiveActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        onReport={() => setActionSheetOpen(false)}
        onShare={() => {
          setActionSheetOpen(false);
          void handleShare();
        }}
        onCopyLink={() => {
          setActionSheetOpen(false);
          void handleShare();
        }}
      />
    </div>
  );
}
