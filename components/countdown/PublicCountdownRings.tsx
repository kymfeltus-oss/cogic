"use client";

import { motion } from "framer-motion";
import PublicCountdownUnit from "@/components/countdown/PublicCountdownUnit";
import {
  publicCountdownUnitsForDisplay,
  resolvePublicCountdownValues,
} from "@/lib/countdown/public-countdown-units";
import type { CountdownParts } from "@/lib/live/event-lobby";

type PublicCountdownRingsProps = {
  countdown: CountdownParts;
  compact?: boolean;
};

export default function PublicCountdownRings({ countdown, compact = false }: PublicCountdownRingsProps) {
  const showDays = countdown.days > 0;
  const units = publicCountdownUnitsForDisplay(showDays);
  const values = resolvePublicCountdownValues(countdown, showDays);

  return (
    <motion.div
      className={`public-countdown-rings${compact ? " public-countdown-rings--compact" : ""}`}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.08, delayChildren: 0.12 },
        },
      }}
      aria-live="polite"
      aria-label="Event countdown"
    >
      {units.map((unit, index) => (
        <motion.div
          key={unit.id}
          variants={{
            hidden: { opacity: 0, y: 18, scale: 0.92 },
            visible: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: "spring", stiffness: 260, damping: 22 },
            },
          }}
        >
          <PublicCountdownUnit unit={unit} value={values[unit.id]} index={index} />
        </motion.div>
      ))}
    </motion.div>
  );
}
