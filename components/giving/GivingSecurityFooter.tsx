import { Lock } from "lucide-react";

export default function GivingSecurityFooter() {
  return (
    <p className="cogic-giving-security">
      <Lock className="size-3.5" aria-hidden="true" />
      Your information is secure and encrypted.
    </p>
  );
}
