import type { ReactNode } from "react";
import BottomNavigation from "@/components/navigation/BottomNavigation";

export default function TravelLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <BottomNavigation />
    </>
  );
}
