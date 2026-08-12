import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Historical debt quarantine: React Compiler eslint rules + explicit-any on
 * pre-existing surfaces. Functional behavior stays unchanged; tsc --noEmit is
 * the hard gate. New Phase 0–3 corporate travel modules should still prefer
 * unknown + narrowing over any when edited.
 */
const HISTORICAL_LINT_DEBT_FILES = [
  "components/travel/MyTripClient.tsx",
  "components/owner/TravelManagementClient.tsx",
  "app/api/travel/itinerary/route.ts",
  "app/travel/getting-around/page.tsx",
  "app/api/housing/route.ts",
  "app/api/owner/check-in/route.ts",
  "app/api/owner/housing/route.ts",
  "app/api/owner/tickets/export/route.ts",
  "app/api/owner/tickets/route.ts",
  "app/api/tickets/checkout/route.ts",
  "app/t/[token]/page.tsx",
  "app/test-suite/TestSuiteClient.tsx",
  "components/experience/live/LiveExperienceClient.tsx",
  "components/housing/HousingExperience.tsx",
  "components/notifications/NotificationPreferencesPanel.tsx",
  "components/notifications/StayConnectedPrompt.tsx",
  "components/owner/AnnouncementManagementClient.tsx",
  "components/owner/CheckInOperationsClient.tsx",
  "components/owner/ConnectModerationClient.tsx",
  "components/owner/EventManagementClient.tsx",
  "components/owner/HousingManagementClient.tsx",
  "components/owner/TicketManagementClient.tsx",
  "components/owner/TravelGroupRequestsClient.tsx",
  "components/owner/TravelTaxReviewClient.tsx",
  "components/profile/ProfileEditorModal.tsx",
  "components/program/ProgramToolbar.tsx",
  "components/reminders/RemindMeControl.tsx",
  "components/social/DMOverlayPopup.tsx",
  "components/tickets/TicketStoreClient.tsx",
  "components/travel/TaxExemptUploadClient.tsx",
  "components/travel/TravelGroupRequestsClient.tsx",
  "components/travel/checkout/TravelCheckoutClient.tsx",
  "components/travel/checkout/TravelConfirmationClient.tsx",
  "components/travel/hotels-map/HotelsInventoryMap.tsx",
  "components/updates/AnnouncementsFeed.tsx",
  "hooks/useLiveStream.ts",
  "lib/access/check-in.ts",
  "lib/experience/useAttendeeChatRealtime.ts",
  "lib/experience/useAttendeeStreamExperiences.ts",
  "lib/experience/useEventCountdown.ts",
  "lib/parable/BroadcastHealthContext.tsx",
  "lib/tickets/repository.ts",
  "lib/tickets/stripe-webhook.ts",
  "lib/travel/ops/ledger.ts",
  "lib/useCountdownConfig.ts",
  "lib/useLiveStreamState.ts",
];

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "android/**",
      "ios/**",
      "next-env.d.ts",
    ],
  },
  {
    files: HISTORICAL_LINT_DEBT_FILES,
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
    },
  },
];

export default eslintConfig;
