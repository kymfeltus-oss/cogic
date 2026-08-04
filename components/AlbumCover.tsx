"use client";

import { motion } from "framer-motion";

type AlbumCoverProps = {
  className?: string;
};

export default function AlbumCover({ className = "" }: AlbumCoverProps) {
  return (
    <div className={`relative mx-auto w-full max-w-[280px] ${className}`}>
      <motion.div
        initial={{ opacity: 0, rotate: -2 }}
        animate={{ opacity: 1, rotate: 0 }}
        transition={{ duration: 0.6 }}
        className="relative aspect-square overflow-hidden rounded-sm border-2 border-[#1E40AF]/40 shadow-[0_0_40px_rgba(30,64,175,0.35)]"
        style={{
          background:
            "repeating-linear-gradient(135deg, #1E40AF 0px, #1E40AF 8px, #0B090A 8px, #0B090A 16px)",
        }}
      >
        <div className="absolute inset-0 bg-[#1E40AF]/90" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 18px, #B0267A 18px, #B0267A 20px)",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <p className="text-[0.55rem] font-black uppercase leading-tight tracking-wider text-[#B0267A] drop-shadow-[0_2px_0_#0B090A]">
            Hallelujah
          </p>
          <p className="text-[0.55rem] font-black uppercase leading-tight tracking-wider text-[#B0267A] drop-shadow-[0_2px_0_#0B090A]">
            Anyhow!
          </p>
          <h2
            className="mt-2 font-black uppercase leading-none tracking-tight text-white"
            style={{
              fontSize: "clamp(1.4rem, 6vw, 1.75rem)",
              textShadow:
                "3px 3px 0 #B0267A, -1px -1px 0 #1E40AF, 0 0 20px rgba(176,38,122,0.6)",
              transform: "rotate(-3deg)",
            }}
          >
            Hallelujah
            <br />
            Anyhow!
          </h2>
        </div>
      </motion.div>

      <motion.div
        aria-hidden="true"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-3 top-1/2 h-[88%] w-[18%] -translate-y-1/2 rounded-full border border-zinc-700/80 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 shadow-[inset_0_0_12px_rgba(0,0,0,0.8)]"
      >
        <div className="absolute inset-[18%] rounded-full border border-zinc-600/50" />
        <div className="absolute inset-[38%] rounded-full bg-zinc-950" />
      </motion.div>
    </div>
  );
}
