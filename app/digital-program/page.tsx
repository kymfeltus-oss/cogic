import type { Metadata } from "next";
import AwakeningProgramClient from "@/components/experience/program/AwakeningProgramClient";
import "./awakening-program.css";

export const metadata: Metadata = {
  title: "Digital Program | 300 Awakening",
  description: "Interactive digital event program for 300 Awakening.",
};

export default function AwakeningProgramPage() {
  return <AwakeningProgramClient />;
}
