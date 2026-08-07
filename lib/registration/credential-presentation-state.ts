export type CredentialPresentationState =
  | "issued"
  | "active"
  | "revoked"
  | "not_issued"
  | "unavailable";

export function normalizeCredentialPresentationState(status: string | null | undefined): CredentialPresentationState {
  if (status === "issued" || status === "active" || status === "revoked") return status;
  if (!status || status === "not_issued") return "not_issued";
  return "unavailable";
}

export function credentialPresentationCopy(status: string | null | undefined) {
  switch (normalizeCredentialPresentationState(status)) {
    case "issued":
      return { label: "Issued", message: "Credential issued.", canPresent: true };
    case "active":
      return { label: "Active", message: "Credential active.", canPresent: true };
    case "revoked":
      return { label: "Revoked", message: "Credential revoked.", canPresent: false };
    case "unavailable":
      return { label: "Unavailable", message: "Credential unavailable.", canPresent: false };
    default:
      return { label: "Not yet issued", message: "Credential not yet issued.", canPresent: false };
  }
}
