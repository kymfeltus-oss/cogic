"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import RegistrationPolicyDocument from "@/components/registration/RegistrationPolicyDocument";
import {
  formatRegistrationAmount,
  getGroupTotalCents,
  getPrimaryRegistrant,
  isJuniorRegistrationProduct,
  REGISTRATION_WIZARD_STEPS,
  type RegistrationExperience,
  type RegistrationProduct,
  type RegistrationWizardDestination,
} from "@/lib/registration/group-experience";
import { SALUTATIONS } from "@/lib/registration/slice2-validation";
import type { RegistrantInput } from "@/lib/registration/slice2-repository";

const TOTAL_WIZARD_STEPS = REGISTRATION_WIZARD_STEPS.length;

function wizardStepNumberFromId(stepId: string | undefined, fallbackStep: number): number {
  if (!stepId) {
    return Math.min(TOTAL_WIZARD_STEPS, Math.max(1, fallbackStep));
  }
  const index = REGISTRATION_WIZARD_STEPS.findIndex((milestone) => milestone.id === stepId);
  if (index < 0) {
    return Math.min(TOTAL_WIZARD_STEPS, Math.max(1, fallbackStep));
  }
  return index + 1;
}

type PrimaryForm = Omit<RegistrantInput, "isPrimary"> & {
  id?: string;
  productId: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  streetAddress: string;
  city: string;
  postalCode: string;
  churchName: string;
  pastorName: string;
  jurisdiction: string;
  requiresInterpretation: boolean;
};

type MemberForm = {
  id?: string;
  firstName: string;
  lastName: string;
  relationship: string;
  productId: string;
  dateOfBirth: string;
};

const BLANK_PRIMARY: PrimaryForm = {
  productId: "",
  salutation: "",
  firstName: "",
  lastName: "",
  suffix: "",
  email: "",
  mobilePhone: "",
  assistantEmail: "",
  streetAddress: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  countryCode: "US",
  gender: "",
  requiresInterpretation: false,
  preferredLanguage: "",
  churchName: "",
  pastorName: "",
  jurisdiction: "",
};

const BLANK_MEMBER: MemberForm = {
  firstName: "",
  lastName: "",
  relationship: "spouse",
  productId: "",
  dateOfBirth: "",
};

function primaryFormFromExperience(experience: RegistrationExperience): PrimaryForm {
  const primary = getPrimaryRegistrant(experience.group);
  if (!primary) {
    return {
      ...BLANK_PRIMARY,
      firstName: experience.profileDefaults?.firstName ?? "",
      lastName: experience.profileDefaults?.lastName ?? "",
      email: experience.profileDefaults?.email ?? "",
      mobilePhone: experience.profileDefaults?.mobilePhone ?? "",
      city: experience.profileDefaults?.city ?? "",
      state: experience.profileDefaults?.state ?? "",
    };
  }

  return {
    ...BLANK_PRIMARY,
    id: primary.id,
    productId: primary.registration_product_id ?? "",
    salutation: primary.salutation ?? "",
    firstName: primary.first_name ?? "",
    lastName: primary.last_name ?? "",
    suffix: primary.suffix ?? "",
    email: primary.email ?? "",
    mobilePhone: primary.mobile_phone ?? "",
    assistantEmail: primary.assistant_email ?? "",
    streetAddress: primary.street_address ?? "",
    addressLine2: primary.address_line_2 ?? "",
    city: primary.city ?? "",
    state: primary.state ?? "",
    postalCode: primary.postal_code ?? "",
    countryCode: primary.country_code ?? "US",
    gender: primary.gender ?? "",
    requiresInterpretation: primary.requires_interpretation,
    preferredLanguage: primary.preferred_language ?? "",
    churchName: primary.church_name ?? "",
    pastorName: primary.pastor_name ?? "",
    jurisdiction: primary.jurisdiction ?? "",
  };
}

function eligibleProducts(products: RegistrationProduct[], relationship: string, isPrimary = false) {
  return products.filter((product) => {
    const isJunior = isJuniorRegistrationProduct(product.product_key);
    return isPrimary ? !isJunior : relationship === "child" ? isJunior : !isJunior;
  });
}

function requiredPrimaryMessage(form: PrimaryForm): string | null {
  const required = [
    ["First name", form.firstName],
    ["Last name", form.lastName],
    ["Email", form.email],
    ["Cell phone", form.mobilePhone],
    ["Address line 1", form.streetAddress],
    ["City", form.city],
    ["State / Province", form.state],
    ["Postal code", form.postalCode],
    ["Church name", form.churchName],
    ["Pastor name", form.pastorName],
    ["Jurisdiction", form.jurisdiction],
  ];
  const missing = required.find(([, value]) => !value?.trim());
  if (missing) {
    return `${missing[0]} is required.`;
  }
  if (!/^\S+@\S+\.\S+$/.test(form.email ?? "")) {
    return "Enter a valid email address.";
  }
  if (form.requiresInterpretation && !form.preferredLanguage?.trim()) {
    return "Preferred interpretation language is required.";
  }
  return null;
}

async function responseJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

type RegistrationSlice2ExperienceProps = {
  initial: RegistrationExperience;
  /** Server-clamped wizard index (1..TOTAL_WIZARD_STEPS). Intent may come from `?step=` but never from client trust. */
  initialStep: number;
  /** Destination id matching REGISTRATION_WIZARD_STEPS (e.g. "attendee"). */
  activeStepId?: RegistrationWizardDestination | string;
  /** Server-derived resume index from the evaluator. */
  resumeStep?: number;
};

export default function RegistrationSlice2Experience({
  initial,
  initialStep,
  activeStepId,
  resumeStep,
}: RegistrationSlice2ExperienceProps) {
  const router = useRouter();
  const [isDraftPending, startDraftTransition] = useTransition();
  const [isProceedPending, startProceedTransition] = useTransition();
  const [data, setData] = useState(initial);
  const [step, setStep] = useState(() => {
    const resumeFallback = resumeStep ?? initial.requirements.resumeStep;
    const fromActiveId = wizardStepNumberFromId(activeStepId, resumeFallback);
    if (activeStepId) {
      return fromActiveId;
    }
    const candidate = Number.isFinite(initialStep) ? initialStep : resumeFallback;
    return Math.min(TOTAL_WIZARD_STEPS, Math.max(1, candidate));
  });
  const [form, setForm] = useState(() => primaryFormFromExperience(initial));
  const [member, setMember] = useState<MemberForm>(BLANK_MEMBER);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const initialMetadata = initial.group?.wizard_metadata ?? {};
  const [musicalQuantity, setMusicalQuantity] = useState(Number(initialMetadata.musical_ticket_quantity ?? 0));
  const [printedProgram, setPrintedProgram] = useState(initialMetadata.printed_program_selected === true);
  const [digitalProgram, setDigitalProgram] = useState(initialMetadata.digital_program_selected === true);
  const [smsOptIn, setSmsOptIn] = useState(initialMetadata.sms_opt_in === true);
  const [emailOptIn, setEmailOptIn] = useState(initialMetadata.email_opt_in === true);

  const members = data.group?.registrations ?? [];
  const primary = getPrimaryRegistrant(data.group);
  const totalCents = useMemo(() => getGroupTotalCents(data.group), [data.group]);
  const extrasTotalCents = musicalQuantity * 3000 + (printedProgram ? 1000 : 0);
  const memberProducts = useMemo(
    () => eligibleProducts(data.products, member.relationship),
    [data.products, member.relationship],
  );
  const currentMilestone = REGISTRATION_WIZARD_STEPS[step - 1] ?? REGISTRATION_WIZARD_STEPS[0];
  const stepDisplayNumber = wizardStepNumberFromId(currentMilestone.id, step);

  function applyExperience(experience: RegistrationExperience) {
    setData(experience);
    setForm(primaryFormFromExperience(experience));
  }

  function navigateStep(nextStep: number, experience = data) {
    const allowed = new Set(
      experience.requirements.allowedStepDestinations.map(({ step: allowedStep }) => allowedStep),
    );
    const clamped = allowed.has(nextStep) ? nextStep : experience.requirements.resumeStep;
    const safeStep = Math.min(TOTAL_WIZARD_STEPS, Math.max(1, clamped));
    setStep(safeStep);
    router.replace(`/register?step=${REGISTRATION_WIZARD_STEPS[safeStep - 1].id}`, { scroll: false });
  }

  function proceedToSubmit() {
    if (busy || isProceedPending) return;
    setError("");
    startProceedTransition(() => navigateStep(6));
  }

  async function reload(): Promise<RegistrationExperience> {
    const response = await fetch("/api/registration/experience", { cache: "no-store" });
    const refreshed = await responseJson<RegistrationExperience & { error?: string }>(response);
    if (!response.ok) {
      throw new Error(refreshed.error ?? "Unable to refresh registration.");
    }
    applyExperience(refreshed);
    return refreshed;
  }

  async function request<T>(body: Record<string, unknown>, method = "POST", url = "/api/registration/experience"): Promise<T> {
    const response = await fetch(url, {
      method,
      headers: method === "DELETE" ? undefined : { "Content-Type": "application/json" },
      body: method === "DELETE" ? undefined : JSON.stringify(body),
    });
    const payload = await responseJson<T & { error?: string }>(response);
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to save registration.");
    }
    return payload;
  }

  async function saveRegistrant(registrant: RegistrantInput): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const result = await request<{ experience: RegistrationExperience }>({ action: "save_registrant", registrant });
      applyExperience(result.experience);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save registration.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function updatePrimary<K extends keyof PrimaryForm>(key: K, value: PrimaryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateMember<K extends keyof MemberForm>(key: K, value: MemberForm[K]) {
    setMember((current) => ({ ...current, [key]: value }));
  }

  function continueFromAttendee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = requiredPrimaryMessage(form);
    if (message) {
      setError(message);
      return;
    }

    // Step 1 persists identity immediately (product remains null until step 2).
    startDraftTransition(() => {
      void (async () => {
        setError("");
        try {
          const result = await request<{ experience: RegistrationExperience }>({
            action: "save_primary_draft",
            draft: {
              salutation: form.salutation,
              firstName: form.firstName,
              lastName: form.lastName,
              suffix: form.suffix,
              email: form.email,
              mobilePhone: form.mobilePhone,
              assistantEmail: form.assistantEmail,
              streetAddress: form.streetAddress,
              addressLine2: form.addressLine2,
              city: form.city,
              state: form.state,
              postalCode: form.postalCode,
              countryCode: form.countryCode,
              gender: form.gender,
              requiresInterpretation: form.requiresInterpretation,
              preferredLanguage: form.preferredLanguage,
              churchName: form.churchName,
              pastorName: form.pastorName,
              jurisdiction: form.jurisdiction,
              draftLastStep: "product",
            },
            versions: {
              groupVersion: data.group?.row_version ?? null,
              registrationVersion: getPrimaryRegistrant(data.group)?.row_version ?? null,
            },
          });
          applyExperience(result.experience);
          // Prefer server evaluator resume; fall back to product step.
          const nextStep =
            result.experience.requirements.resumeStep > 1
              ? result.experience.requirements.resumeStep
              : 2;
          navigateStep(nextStep, result.experience);
          router.refresh();
        } catch (saveError) {
          setError(
            saveError instanceof Error ? saveError.message : "Unable to save attendee information.",
          );
        }
      })();
    });
  }

  async function savePrimaryAndContinue() {
    const message = requiredPrimaryMessage(form);
    if (message) {
      setError(message);
      navigateStep(1);
      return;
    }
    if (!form.productId) {
      setError("Choose a registration type to continue.");
      return;
    }
    const saved = await saveRegistrant({ ...form, isPrimary: true });
    if (saved) {
      try {
        const latest = await reload();
        const result = await request<{ experience: RegistrationExperience }>({
          action: "save_extras",
          musicalQuantity,
          printedProgram,
          digitalProgram,
          smsOptIn,
          emailOptIn,
          versions: { groupVersion: latest.group?.row_version ?? null },
        });
        applyExperience(result.experience);
        navigateStep(3, result.experience);
      } catch (selectionError) {
        setError(selectionError instanceof Error ? selectionError.message : "Unable to save optional selections.");
      }
    }
  }

  async function saveMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!primary) {
      setError("Complete the primary attendee registration before adding a group registrant.");
      return;
    }
    if (!member.productId) {
      setError("Choose a registration type for this registrant.");
      return;
    }
    const saved = await saveRegistrant({
      id: member.id,
      isPrimary: false,
      relationship: member.relationship,
      guardianRegistrationId: member.relationship === "child" ? primary.id : null,
      productId: member.productId,
      firstName: member.firstName,
      lastName: member.lastName,
      dateOfBirth: member.relationship === "child" ? member.dateOfBirth : null,
    });
    if (saved) {
      setMember(BLANK_MEMBER);
    }
  }

  async function removeMember(id: string) {
    setBusy(true);
    setError("");
    try {
      await request({}, "DELETE", `/api/registration/experience?id=${encodeURIComponent(id)}`);
      await reload();
      if (member.id === id) {
        setMember(BLANK_MEMBER);
      }
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove registrant.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptPolicy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.policy) {
      setError("A published registration policy is required before submission.");
      return;
    }
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await request<{ experience: RegistrationExperience }>({
        action: "accept_policy",
        policyId: data.policy.id,
        authorizedSignerName: values.get("authorized"),
        agreementSignerName: values.get("agreement"),
      });
      applyExperience(result.experience);
      navigateStep(5, result.experience);
    } catch (acceptanceError) {
      setError(acceptanceError instanceof Error ? acceptanceError.message : "Unable to accept policy.");
    } finally {
      setBusy(false);
    }
  }

  async function submitGroup() {
    setBusy(true);
    setError("");
    try {
      const result = await request<{ status: string }>({ action: "submit_group" });
      router.push(result.status === "confirmed" ? "/register/payment/complete" : "/register/review");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to submit registration.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="registration-shell" aria-labelledby="registration-title">
      <p className="registration-kicker">Holy Convocation registration</p>
      <h1 id="registration-title" className="registration-title">
        {currentMilestone.label}
      </h1>
      <p className="registration-progress">
        Step {stepDisplayNumber} of {TOTAL_WIZARD_STEPS}
      </p>
      {error ? (
        <p role="alert" className="registration-error-summary">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <form className="registration-fields" onSubmit={continueFromAttendee} noValidate>
          <label className="registration-field">
            <span className="registration-label">Salutation</span>
            <select autoComplete="honorific-prefix" className="registration-input" value={form.salutation ?? ""} onChange={(event) => updatePrimary("salutation", event.target.value)}>
              <option value="">Select</option>
              {SALUTATIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="registration-field"><span className="registration-label">First name</span><input autoComplete="given-name" required className="registration-input" value={form.firstName} onChange={(event) => updatePrimary("firstName", event.target.value)} /></label>
          <label className="registration-field"><span className="registration-label">Last name</span><input autoComplete="family-name" required className="registration-input" value={form.lastName} onChange={(event) => updatePrimary("lastName", event.target.value)} /></label>
          <label className="registration-field"><span className="registration-label">Suffix</span><input className="registration-input" value={form.suffix ?? ""} onChange={(event) => updatePrimary("suffix", event.target.value)} /></label>
          <label className="registration-field"><span className="registration-label">Email</span><input autoComplete="email" required className="registration-input" type="email" value={form.email ?? ""} onChange={(event) => updatePrimary("email", event.target.value)} /></label>
          <label className="registration-field"><span className="registration-label">Cell phone</span><input autoComplete="tel" required className="registration-input" type="tel" value={form.mobilePhone ?? ""} onChange={(event) => updatePrimary("mobilePhone", event.target.value)} /></label>
          <label className="registration-field"><span className="registration-label">Assistant email</span><input className="registration-input" type="email" value={form.assistantEmail ?? ""} onChange={(event) => updatePrimary("assistantEmail", event.target.value)} /></label>
          <label className="registration-field"><span className="registration-label">Country code</span><input autoComplete="country" required className="registration-input" value={form.countryCode} onChange={(event) => updatePrimary("countryCode", event.target.value.toUpperCase())} /></label>
          <label className="registration-field"><span className="registration-label">Address line 1</span><input autoComplete="address-line1" required className="registration-input" value={form.streetAddress} onChange={(event) => updatePrimary("streetAddress", event.target.value)} /></label>
          <label className="registration-field"><span className="registration-label">Address line 2</span><input autoComplete="address-line2" className="registration-input" value={form.addressLine2 ?? ""} onChange={(event) => updatePrimary("addressLine2", event.target.value)} /></label>
          <label className="registration-field"><span className="registration-label">City</span><input autoComplete="address-level2" required className="registration-input" value={form.city} onChange={(event) => updatePrimary("city", event.target.value)} /></label>
          <label className="registration-field"><span className="registration-label">State / Province</span><input autoComplete="address-level1" required className="registration-input" value={form.state ?? ""} onChange={(event) => updatePrimary("state", event.target.value)} /></label>
          <label className="registration-field"><span className="registration-label">Postal code</span><input autoComplete="postal-code" required className="registration-input" value={form.postalCode} onChange={(event) => updatePrimary("postalCode", event.target.value)} /></label>
          <label className="registration-field"><span className="registration-label">Gender</span><input className="registration-input" value={form.gender ?? ""} onChange={(event) => updatePrimary("gender", event.target.value)} /></label>
          <label className="registration-field"><span className="registration-label">Church name</span><input required className="registration-input" value={form.churchName} onChange={(event) => updatePrimary("churchName", event.target.value)} /></label>
          <label className="registration-field"><span className="registration-label">Pastor name</span><input required className="registration-input" value={form.pastorName} onChange={(event) => updatePrimary("pastorName", event.target.value)} /></label>
          <label className="registration-field"><span className="registration-label">Jurisdiction</span><input required className="registration-input" value={form.jurisdiction} onChange={(event) => updatePrimary("jurisdiction", event.target.value)} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.requiresInterpretation} onChange={(event) => updatePrimary("requiresInterpretation", event.target.checked)} />I require language interpretation</label>
          {form.requiresInterpretation ? <label className="registration-field"><span className="registration-label">Preferred interpretation language</span><input required className="registration-input" value={form.preferredLanguage ?? ""} onChange={(event) => updatePrimary("preferredLanguage", event.target.value)} /></label> : null}
          <button
            type="submit"
            disabled={isDraftPending}
            className="registration-btn registration-btn-primary"
          >
            {isDraftPending ? "Saving draft…" : "Continue to registration type"}
          </button>
        </form>
      ) : null}

      {step === 2 ? (
        <div>
          <div className="grid gap-3">
            {data.products.length ? data.products.map((product) => {
              const junior = isJuniorRegistrationProduct(product.product_key);
              return (
              <label key={product.id} className="rounded border border-purple-400/30 p-4">
                <input disabled={junior} type="radio" name="primary-product" checked={form.productId === product.id} onChange={() => updatePrimary("productId", product.id)} />
                <strong className="ml-2">{product.name}</strong>
                <span className="block text-sm">{product.description}</span>
                <span>{formatRegistrationAmount(product.price_cents, product.currency)}</span>
                {product.eligibility_description ? <small className="block">{product.eligibility_description}</small> : null}
                {junior ? <small className="block font-bold">Add an eligible child on the Group / Junior step.</small> : null}
              </label>
            );}) : <p>No public registration products are currently available.</p>}
          </div>
          <section className="mt-6 grid gap-3 rounded border border-white/15 p-4">
            <h2 className="text-xl font-bold">Musical Ticket Only Registration</h2>
            <p>Select this option only to purchase tickets to the musical.</p>
            <p>Enter the total number of tickets below (include yourself in the count).</p>
            <strong>Musical Ticket — $30 each</strong>
            <div className="flex items-center justify-center gap-5" aria-label="Musical Ticket quantity">
              <button type="button" className="registration-btn registration-btn-secondary" onClick={() => setMusicalQuantity((value) => Math.max(0, value - 1))}>−</button>
              <output className="min-w-10 text-center text-2xl font-bold">{musicalQuantity}</output>
              <button type="button" className="registration-btn registration-btn-secondary" onClick={() => setMusicalQuantity((value) => Math.min(10, value + 1))}>+</button>
            </div>
          </section>
          <section className="mt-6 grid gap-3 rounded border border-white/15 p-4">
            <h2 className="text-xl font-bold">Additional Items</h2>
            <label className="flex gap-3"><input type="checkbox" checked={printedProgram} onChange={(event) => setPrintedProgram(event.target.checked)} /><span><strong>Printed Program — $10</strong><br />Optional printed copy for pickup.</span></label>
            <label className="flex gap-3"><input type="checkbox" checked={digitalProgram} onChange={(event) => setDigitalProgram(event.target.checked)} /><span><strong>Digital Program — FREE</strong><br />Digital program entitlement.</span></label>
          </section>
          <section className="mt-6 grid gap-3 rounded border border-white/15 p-4">
            <h2 className="text-xl font-bold">Communication preferences</h2>
            <label className="flex gap-3"><input type="checkbox" checked={smsOptIn} onChange={(event) => setSmsOptIn(event.target.checked)} />Receive Holy Convocation updates by text message.</label>
            <label className="flex gap-3"><input type="checkbox" checked={emailOptIn} onChange={(event) => setEmailOptIn(event.target.checked)} />Receive Holy Convocation updates by email.</label>
            <small>These optional choices are separate from phone and email verification.</small>
          </section>
          <div className="registration-actions">
            <button type="button" className="registration-btn registration-btn-secondary" onClick={() => navigateStep(1)}>Back</button>
            <button type="button" disabled={!form.productId || busy} className="registration-btn registration-btn-primary" onClick={() => void savePrimaryAndContinue()}>Save and continue</button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <ul className="grid gap-2">
            {members.map((registrant) => (
              <li key={registrant.id} className="flex flex-wrap justify-between gap-2 rounded border border-white/10 p-3">
                <span>{registrant.first_name} {registrant.last_name} — {registrant.is_primary_registrant ? "Primary attendee" : registrant.relationship_to_primary}</span>
                {!registrant.is_primary_registrant ? <span className="flex gap-2"><button type="button" onClick={() => setMember({ id: registrant.id, firstName: registrant.first_name ?? "", lastName: registrant.last_name ?? "", relationship: registrant.relationship_to_primary ?? "spouse", productId: registrant.registration_product_id ?? "", dateOfBirth: registrant.date_of_birth ?? "" })}>Edit</button><button type="button" onClick={() => void removeMember(registrant.id)}>Remove</button></span> : null}
              </li>
            ))}
          </ul>
          <form className="registration-fields mt-4" onSubmit={saveMember}>
            <label className="registration-field"><span className="registration-label">Registrant first name</span><input required className="registration-input" value={member.firstName} onChange={(event) => updateMember("firstName", event.target.value)} /></label>
            <label className="registration-field"><span className="registration-label">Registrant last name</span><input required className="registration-input" value={member.lastName} onChange={(event) => updateMember("lastName", event.target.value)} /></label>
            <label className="registration-field"><span className="registration-label">Relationship</span><select className="registration-input" value={member.relationship} onChange={(event) => { const relationship = event.target.value; setMember((current) => ({ ...current, relationship, productId: eligibleProducts(data.products, relationship).some((product) => product.id === current.productId) ? current.productId : "" })); }}><option value="spouse">Spouse</option><option value="adjutant">Adjutant</option><option value="child">Child</option><option value="traveling_companion">Traveling companion</option><option value="other">Other</option></select></label>
            {member.relationship === "child" ? <label className="registration-field"><span className="registration-label">Junior date of birth</span><input required className="registration-input" type="date" value={member.dateOfBirth} onChange={(event) => updateMember("dateOfBirth", event.target.value)} /></label> : null}
            <label className="registration-field"><span className="registration-label">Registration product</span><select required className="registration-input" value={member.productId} onChange={(event) => updateMember("productId", event.target.value)}><option value="">Select</option>{memberProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatRegistrationAmount(product.price_cents, product.currency)}</option>)}</select></label>
            {!memberProducts.length ? <p className="registration-field-error">No registration products are currently available for this relationship.</p> : null}
            <button disabled={busy || !memberProducts.length} className="registration-btn registration-btn-secondary">{member.id ? "Update registrant" : "Add registrant"}</button>
          </form>
          <div className="registration-actions"><button type="button" className="registration-btn registration-btn-secondary" onClick={() => navigateStep(2)}>Back</button><button type="button" className="registration-btn registration-btn-primary" onClick={() => navigateStep(4)}>Continue</button></div>
        </div>
      ) : null}

      {step === 4 ? (
        data.policy ? <form onSubmit={acceptPolicy} className="grid gap-4"><RegistrationPolicyDocument className="max-h-80 overflow-auto rounded border border-yellow-500/30 p-4" title={data.policy.title} version={data.policy.version} content={data.policy.content} effectiveAt={data.policy.effective_at} /><label className="registration-field"><span className="registration-label">Authorized/responsible person full name</span><input required name="authorized" className="registration-input" /></label><label className="registration-field"><span className="registration-label">Agreement full name</span><input required name="agreement" className="registration-input" /></label><div className="registration-actions"><button type="button" className="registration-btn registration-btn-secondary" onClick={() => navigateStep(3)}>Back</button><button disabled={busy} className="registration-btn registration-btn-primary">Accept policy</button></div></form> : <div><p>No published registration policy is available. Submission is disabled until an owner publishes the current policy.</p><button type="button" className="registration-btn registration-btn-secondary" onClick={() => navigateStep(3)}>Back</button></div>
      ) : null}

      {step === 5 ? (
        <div>
          <dl className="registration-summary">
            {members.map((registrant) => (
              <div key={registrant.id}><dt>{registrant.first_name} {registrant.last_name}</dt><dd>{formatRegistrationAmount(registrant.amount_cents ?? 0, registrant.currency ?? "usd")}</dd></div>
            ))}
            <div><dt>Registration total due</dt><dd>{formatRegistrationAmount(totalCents, primary?.currency ?? "usd")}</dd></div>
            {musicalQuantity > 0 ? <div><dt>Musical Ticket × {musicalQuantity}</dt><dd>{formatRegistrationAmount(musicalQuantity * 3000)}</dd></div> : null}
            {printedProgram ? <div><dt>Printed Program</dt><dd>{formatRegistrationAmount(1000)}</dd></div> : null}
            {digitalProgram ? <div><dt>Digital Program</dt><dd>FREE</dd></div> : null}
            <div><dt>TOTAL</dt><dd>{formatRegistrationAmount(totalCents + extrasTotalCents, primary?.currency ?? "usd")}</dd></div>
          </dl>
          <div className="registration-actions"><button type="button" className="registration-btn registration-btn-secondary" onClick={() => navigateStep(4)}>Back</button><button type="button" disabled={busy || isProceedPending} className="registration-btn registration-btn-primary" onClick={proceedToSubmit}>{isProceedPending ? "Proceeding…" : "Proceed"}</button></div>
        </div>
      ) : null}

      {step === 6 ? <div className="registration-actions"><button type="button" className="registration-btn registration-btn-secondary" onClick={() => navigateStep(5)}>Back</button><button disabled={busy} type="button" className="registration-btn registration-btn-primary" onClick={() => void submitGroup()}>{totalCents > 0 ? `Submit and pay ${formatRegistrationAmount(totalCents + extrasTotalCents, primary?.currency ?? "usd")}` : "Complete free registration"}</button></div> : null}
    </section>
  );
}
