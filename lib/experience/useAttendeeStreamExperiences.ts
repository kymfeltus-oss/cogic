"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildAttendeeFeedOption,
  DEFAULT_ATTENDEE_EXPERIENCE,
  type AttendeeStreamFeedOption,
} from "@/lib/experience/stream-experiences";
import { getClientAppUrl } from "@/lib/client-api";

type UseAttendeeStreamExperiencesResult = {
  feeds: AttendeeStreamFeedOption[];
  isLoading: boolean;
  showSelector: boolean;
};

export function useAttendeeStreamExperiences(
  enabled: boolean,
): UseAttendeeStreamExperiencesResult {
  const [feeds, setFeeds] = useState<AttendeeStreamFeedOption[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setFeeds([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    void fetch(`${getClientAppUrl()}/api/experience/stream-feeds`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("feed registry unavailable");
        }
        return (await response.json()) as { feeds?: AttendeeStreamFeedOption[] };
      })
      .then((payload) => {
        if (cancelled) return;
        const nextFeeds = Array.isArray(payload.feeds) ? payload.feeds : [];
        setFeeds(
          nextFeeds.length > 0
            ? nextFeeds
            : [buildAttendeeFeedOption(DEFAULT_ATTENDEE_EXPERIENCE)],
        );
      })
      .catch((error) => {
        console.error("Attendee stream experiences load failed:", error);
        if (!cancelled) {
          setFeeds([buildAttendeeFeedOption(DEFAULT_ATTENDEE_EXPERIENCE)]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const showSelector = useMemo(() => feeds.length > 1, [feeds.length]);

  return { feeds, isLoading, showSelector };
}
