"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ClipboardList, QrCode, X } from "lucide-react";
import RegistrationPolicyDocument from "@/components/registration/RegistrationPolicyDocument";
import type { DashboardRegistrationState } from "@/lib/dashboard/load-attendee-dashboard";
import { credentialPresentationCopy } from "@/lib/registration/credential-presentation-state";

const label = (value: string | null) => (value || "unavailable").replaceAll("_", " ");

export default function MyConvocationCard({ registration, signedIn }: { registration: DashboardRegistrationState; signedIn: boolean }) {
  const [policyOpen, setPolicyOpen] = useState(false);
  const [credential, setCredential] = useState<{ memberId:string; name:string; type:string; status:string; qrDataUrl:string } | null>(null);
  const [credentialError, setCredentialError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function showCredential(member: DashboardRegistrationState["members"][number]) {
    setCredentialError(""); setBusyId(member.registrationId);
    try {
      const response = await fetch("/api/registration/credential-presentation", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({registrationId:member.registrationId}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Credential unavailable.");
      setCredential({memberId:member.registrationId,name:member.name,type:result.registrationType,status:result.status,qrDataUrl:result.qrDataUrl});
    } catch (error) { setCredentialError(error instanceof Error ? error.message : "Credential unavailable."); }
    finally { setBusyId(null); }
  }

  if (!signedIn || registration.status === "none") return <article className="cl-feature-card cl-feature-card--registration"><p className="cl-feature-card__eyebrow">Registration Hub</p><ClipboardList aria-hidden="true"/><h2>No Registration</h2><p>Sign in or start registration for the 118th Holy Convocation.</p><Link href={signedIn?"/register":"/login?next=%2Fregister"} className="cl-btn cl-btn--primary cl-btn--block">{signedIn?"Open Registration Hub":"Sign In"}<ArrowRight aria-hidden="true"/></Link></article>;

  return <article className="cl-feature-card cl-feature-card--registration">
    <p className="cl-feature-card__eyebrow">Registration Hub · My Registration</p>
    <div className="cl-feature-card__credential-icon">{registration.credentialReady?<BadgeCheck aria-hidden="true"/>:<ClipboardList aria-hidden="true"/>}</div>
    <h2>{registration.status === "confirmed" ? "Registration Complete" : "Registration In Progress"}</h2>
    <dl className="grid gap-2 text-sm">
      <div><dt>Status</dt><dd className="capitalize">{label(registration.status)}</dd></div>
      <div><dt>Payment</dt><dd className="capitalize">{label(registration.paymentStatus)}</dd></div>
      <div><dt>Registered</dt><dd>{registration.registeredAt ? new Date(registration.registeredAt).toLocaleDateString() : "Unavailable"}</dd></div>
    </dl>
    <h3 className="mt-4 font-semibold">Group Members</h3>
    <div className="grid gap-3 mt-2">
      {registration.members.map(member=>{const credentialState=credentialPresentationCopy(member.credentialStatus);return <section key={member.registrationId} className="rounded-xl border border-purple-400/25 bg-black/20 p-3">
        <div className="flex items-start justify-between gap-3"><div><strong>{member.name}</strong><p className="capitalize text-sm text-white/65">{label(member.relationship)}{member.isJunior?" · Junior":""}</p></div><span className="text-xs">{credentialState.label}</span></div>
        <p className="text-sm">{member.productName || "Product unavailable"} · {label(member.status)}</p>
        {member.guardianName?<p className="text-sm">Guardian: {member.guardianName}</p>:null}
        {member.interpretationLanguage?<p className="text-sm">Interpretation: {member.interpretationLanguage}</p>:null}
        {member.confirmationReference?<p className="text-sm">Confirmation: {member.confirmationReference}</p>:null}
        {credentialState.canPresent?<button type="button" className="cl-btn cl-btn--primary mt-3" disabled={busyId===member.registrationId} onClick={()=>void showCredential(member)}><QrCode aria-hidden="true"/>{busyId===member.registrationId?"Preparing…":"Show Credential"}</button>:<p className="mt-2 text-sm">{credentialState.message}</p>}
      </section>})}
    </div>
    <section className="mt-4 rounded-xl border border-yellow-500/20 p-3"><h3>Policy Agreement</h3>{registration.policy?<><p>Accepted · Version {registration.policy.version}</p><p className="text-sm">{new Date(registration.policy.acceptedAt).toLocaleString()} · {registration.policy.signerName}</p><button type="button" className="cl-btn cl-btn--ghost mt-2" onClick={()=>setPolicyOpen(true)}>View Accepted Policy</button></>:<p>Policy acceptance pending.</p>}</section>
    {credentialError?<p role="alert" className="mt-3 text-red-300">{credentialError}</p>:null}
    <Link href="/register" className="cl-btn cl-btn--primary cl-btn--block mt-3">Open Registration Hub<ArrowRight aria-hidden="true"/></Link>
    {policyOpen&&registration.policy?<div role="dialog" aria-modal="true" aria-label="Accepted policy" className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-[#0b0715] p-6"><button aria-label="Close policy" className="float-right" onClick={()=>setPolicyOpen(false)}><X/></button><RegistrationPolicyDocument title="Accepted Registration Policy" version={registration.policy.version} content={registration.policy.snapshot}/></div></div>:null}
    {credential?<div role="dialog" aria-modal="true" aria-label={`${credential.name} credential`} className="fixed inset-0 z-[100] grid place-items-center bg-black/95 p-3"><div className="w-full max-w-lg rounded-3xl bg-white p-5 text-center text-[#07040F]"><button aria-label="Close credential" className="float-right" onClick={()=>setCredential(null)}><X/></button><h2 className="text-2xl font-bold">My Credential</h2><p>{credential.name}</p><img src={credential.qrDataUrl} alt={`${credential.name} secure entry QR code`} className="mx-auto my-4 aspect-square w-full max-w-[420px]"/><strong>{credential.type}</strong><p className="capitalize">Credential {label(credential.status)}</p></div></div>:null}
  </article>;
}
