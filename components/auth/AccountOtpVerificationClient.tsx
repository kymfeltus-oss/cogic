"use client";

import { useState } from "react";

type Props = { initialEmail: string; nextPath: string };
type Channel = "email" | "phone";

function normalPhone(value: string) { return value.replace(/\D/g, "").slice(0, 10); }

export default function AccountOtpVerificationClient({ initialEmail, nextPath }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [phoneSent, setPhoneSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [busy, setBusy] = useState<"email-send" | "email-verify" | "phone-send" | "phone-verify" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function request(channel: Channel, action: "send" | "verify") {
    const token = channel === "email" ? emailCode : phoneCode;
    const key = `${channel}-${action}` as typeof busy;
    setBusy(key); setError(null);
    try {
      const response = await fetch("/api/auth/otp", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, action, email: email.trim().toLowerCase(), phone: normalPhone(phone), token, next: nextPath }) });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "We couldn't process that verification request.");
      if (action === "send") {
        if (channel === "email") setEmailSent(true);
        else setPhoneSent(true);
      }
      else if (channel === "email") setEmailVerified(true); else setPhoneVerified(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn't process that verification request."); }
    finally { setBusy(null); }
  }

  const field = "mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-brand-black/50 px-3 text-white outline-none focus:border-brand-blue";
  const button = "mt-3 min-h-11 w-full rounded-xl bg-brand-blue px-4 font-ui text-sm font-bold uppercase tracking-[0.08em] text-white disabled:opacity-50";
  return <main id="main-content" className="cogic-auth-page mx-auto w-full max-w-md px-5 py-8">
    <p className="cogic-auth-kicker">Account security</p><h1 className="cogic-auth-title">Verify your account</h1>
    <p className="cogic-auth-copy mt-2">Verification proves ownership only. It does not subscribe you to emails or text updates.</p>
    <section className="mt-6 rounded-2xl border border-brand-border bg-white/[0.03] p-4" aria-labelledby="email-verification-title">
      <h2 id="email-verification-title" className="font-ui text-sm font-bold uppercase tracking-[0.08em] text-white">Email verification</h2>
      <label className="mt-3 block text-sm text-white" htmlFor="verification-email">Email address<input id="verification-email" value={email} onChange={(event) => setEmail(event.target.value)} inputMode="email" autoComplete="email" className={field} disabled={emailVerified || busy !== null} /></label>
      {emailVerified ? <p className="mt-3 text-sm text-green-300">Email verified.</p> : <>
        <button type="button" className={button} disabled={busy !== null} onClick={() => void request("email", "send")}>{busy === "email-send" ? "Sending…" : emailSent ? "Resend code" : "Send email code"}</button>
        {emailSent ? <label className="mt-3 block text-sm text-white" htmlFor="email-code">Verification code<input id="email-code" value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" className={`${field} tracking-[0.35em]`} /></label> : null}
        {emailSent ? <button type="button" className={button} disabled={busy !== null} onClick={() => void request("email", "verify")}>{busy === "email-verify" ? "Verifying…" : "Verify email code"}</button> : null}
      </>}
    </section>
    {emailVerified ? <section className="mt-4 rounded-2xl border border-brand-border bg-white/[0.03] p-4" aria-labelledby="phone-verification-title">
      <h2 id="phone-verification-title" className="font-ui text-sm font-bold uppercase tracking-[0.08em] text-white">Mobile phone verification <span className="text-white/55">(optional)</span></h2>
      <label className="mt-3 block text-sm text-white" htmlFor="verification-phone">US mobile number<input id="verification-phone" value={phone} onChange={(event) => setPhone(normalPhone(event.target.value))} inputMode="tel" autoComplete="tel-national" placeholder="5555555555" className={field} disabled={phoneVerified || busy !== null} /></label>
      {phoneVerified ? <p className="mt-3 text-sm text-green-300">Mobile phone verified.</p> : <><button type="button" className={button} disabled={busy !== null} onClick={() => void request("phone", "send")}>{busy === "phone-send" ? "Sending…" : phoneSent ? "Resend code" : "Send text code"}</button>{phoneSent ? <><label className="mt-3 block text-sm text-white" htmlFor="phone-code">Verification code<input id="phone-code" value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" className={`${field} tracking-[0.35em]`} /></label><button type="button" className={button} disabled={busy !== null} onClick={() => void request("phone", "verify")}>{busy === "phone-verify" ? "Verifying…" : "Verify mobile code"}</button></> : null}</>}
    </section> : null}
    {emailVerified ? <a className={`${button} block text-center`} href={nextPath}>Continue</a> : null}
    {error ? <p role="alert" className="mt-4 rounded-xl border border-red-300/40 bg-red-950/30 px-3 py-3 text-sm text-red-100">{error}</p> : null}
  </main>;
}
