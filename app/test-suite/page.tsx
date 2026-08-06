import { notFound } from "next/navigation";
import TestSuiteClient from "./TestSuiteClient";

/** Dev-only diagnostics surface — never available in production builds. */
export default function TestSuitePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <TestSuiteClient />;
}
