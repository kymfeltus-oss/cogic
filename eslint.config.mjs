import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

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
    files: [
      "components/travel/MyTripClient.tsx",
      "components/owner/TravelManagementClient.tsx",
      "app/api/travel/itinerary/route.ts",
      "app/travel/getting-around/page.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default eslintConfig;
