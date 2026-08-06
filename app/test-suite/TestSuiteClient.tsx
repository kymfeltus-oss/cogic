"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EXPERIENCE_LIVE_PATH } from "@/lib/experience/live-routes";

export default function TestSuiteClient() {
  const [logs, setLogs] = useState<string[]>([]);
  const [hasMounted, setHasMounted] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  }, []);

  const runDiagnostics = useCallback(
    (width: number) => {
      const email = localStorage.getItem("awakening_user_email");
      if (email) {
        addLog(
          `✅ STEP 1 PASS: User Identity found: "${email}". Root route will instantly bypass intro video and route to Live Hub.`,
        );
      } else {
        addLog(
          "⚠️ STEP 1 ALERT: No user email found. Root route will show 12s intro video and redirect to Onboarding Gate.",
        );
      }

      const isGuest = localStorage.getItem("guest_session") === "true";
      if (isGuest) {
        addLog(
          "ℹ️ SESSION TYPE: Active profile is a Bypass Guest. Checking live room authorization permissions...",
        );
      }

      if (width < 768) {
        addLog(
          `📱 RESPONSIVE BREAKPOINT: Mobile View Detected (${width}px). Nav bar will render as a BOTTOM STICKY BAR.`,
        );
      } else {
        addLog(
          `💻 RESPONSIVE BREAKPOINT: Widescreen View Detected (${width}px). Nav bar will render as a LEFT FIXED SIDEBAR (Width: 16rem). Layout will flow edge-to-edge.`,
        );
      }
    },
    [addLog],
  );

  useEffect(() => {
    const initialWidth = window.innerWidth;
    setWindowWidth(initialWidth);
    setHasMounted(true);

    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);

    addLog("🚀 Initializing Awakening Application Diagnostics Suite...");
    runDiagnostics(initialWidth);

    return () => window.removeEventListener("resize", handleResize);
  }, [addLog, runDiagnostics]);

  const simulateClearLocalStorage = () => {
    localStorage.clear();
    addLog(
      "🧹 LocalStorage wiped completely. Refresh page to test clean first-time user flow.",
    );
  };

  const simulatePaidUser = () => {
    localStorage.setItem("awakening_user_email", "test_verified_user@domain.com");
    localStorage.removeItem("guest_session");
    addLog("🎟️ State Injection: Simulating a verified, registered user profile.");
  };

  const simulateGuestUser = () => {
    localStorage.setItem(
      "awakening_user_email",
      `guest_${Math.floor(Math.random() * 10000)}@awakening.local`,
    );
    localStorage.setItem("guest_session", "true");
    addLog(
      "👤 State Injection: Simulating an instant Guest entry session bypass profile.",
    );
  };

  return (
    <main className="flex min-h-dvh w-screen flex-col gap-6 bg-zinc-950 p-6 font-mono text-xs text-white md:flex-row">
      <div className="flex-1 space-y-4 rounded-xl border border-white/10 bg-zinc-900 p-4">
        <h1 className="text-sm font-bold tracking-tight text-zinc-200 uppercase">
          Interactive Simulation Deck
        </h1>
        <p className="text-zinc-400">
          Force environment states to verify if your routers transition without
          logic loops:
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={simulateClearLocalStorage}
            className="w-full rounded-lg border border-red-500/30 bg-red-950 py-2.5 text-red-200 transition-colors hover:bg-red-900"
          >
            1. Force Clean First-Time Visitor View (Wipe Local Storage)
          </button>
          <button
            type="button"
            onClick={simulatePaidUser}
            className="w-full rounded-lg border border-white/10 bg-zinc-800 py-2.5 text-white transition-colors hover:bg-zinc-700"
          >
            2. Force Inject Registered User Credentials
          </button>
          <button
            type="button"
            onClick={simulateGuestUser}
            className="w-full rounded-lg border border-white/10 bg-zinc-800 py-2.5 text-white transition-colors hover:bg-zinc-700"
          >
            3. Force Inject Guest Session Bypass State
          </button>
        </div>

        <div className="space-y-2 border-t border-white/5 pt-4">
          <span className="block text-[10px] tracking-wider text-zinc-500 uppercase">
            Manual Routing Verification Checks
          </span>
          <div className="grid grid-cols-2 gap-2 text-center font-semibold">
            <Link
              href="/"
              className="rounded border border-white/5 bg-white/5 p-2 hover:bg-white/10"
            >
              Go to `/` (Intro)
            </Link>
            <Link
              href="/email-gate"
              className="rounded border border-white/5 bg-white/5 p-2 hover:bg-white/10"
            >
              Go to `/email-gate`
            </Link>
            <Link
              href={EXPERIENCE_LIVE_PATH}
              className="rounded border border-white/5 bg-white/5 p-2 hover:bg-white/10"
            >
              Go to `{EXPERIENCE_LIVE_PATH}`
            </Link>
            <Link
              href={`${EXPERIENCE_LIVE_PATH}?success=true`}
              className="rounded border border-white/5 bg-white/5 p-2 hover:bg-white/10"
            >
              Test Stripe Hook Retry (`?success=true`)
            </Link>
          </div>
        </div>
      </div>

      <div className="flex h-[50dvh] flex-1 flex-col rounded-xl border border-white/10 bg-black p-4 md:h-auto">
        <div className="mb-2 flex items-center justify-between text-[10px] text-zinc-500 uppercase">
          <span>Diagnostic Log Stream Output</span>
          <span>Width: {hasMounted ? `${windowWidth}px` : "—"}</span>
        </div>
        <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto rounded-lg border border-white/5 bg-zinc-950 p-3 text-zinc-300">
          {logs.map((log, index) => (
            <div key={index} className="leading-relaxed whitespace-pre-wrap">
              {log}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
