import Link from "next/link";
import {
  MUSIC_MOBILE_VISIBLE_ACTION_IDS,
  MUSIC_PAGE_ACTIONS,
} from "@/lib/music/assets";

const visibleActions = MUSIC_PAGE_ACTIONS.filter((action) =>
  MUSIC_MOBILE_VISIBLE_ACTION_IDS.includes(
    action.id as (typeof MUSIC_MOBILE_VISIBLE_ACTION_IDS)[number],
  ),
);

export default function MusicOverlay() {
  return (
    <div className="music-page__actions" aria-label="Music page actions">
      {visibleActions.map((action) => {
        const hitClassName =
          "music-page__action touch-target rounded-[999px] bg-transparent transition hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue";
        const style = {
          left: action.left,
          top: action.top,
          width: action.width,
          height: action.height,
        };

        if (action.external) {
          return (
            <a
              key={action.id}
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={action.label}
              className={hitClassName}
              style={style}
            />
          );
        }

        return (
          <Link
            key={action.id}
            href={action.href}
            aria-label={action.label}
            className={hitClassName}
            style={style}
          />
        );
      })}
    </div>
  );
}
