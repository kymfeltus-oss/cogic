"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Loader2, Trash2, X } from "lucide-react";
import {
  gateFieldClass,
  PrimaryGateButton,
  SecondaryGateButton,
} from "@/components/auth/EmailGateShell";
import ProfileOrb from "@/components/ProfileOrb";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import { isValidEmail } from "@/lib/auth/validation";

type ProfileEditorModalProps = {
  isOpen: boolean;
  profile: AttendeeProfileSnapshot;
  onClose: () => void;
  onSaved: (profile: AttendeeProfileSnapshot) => void;
};

export default function ProfileEditorModal({
  isOpen,
  profile,
  onClose,
  onSaved,
}: ProfileEditorModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatarUrl);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setEmail(profile.email ?? "");
    setAvatarPreview(profile.avatarUrl);
    setPendingFile(null);
    setError(null);
    setStatus("idle");
  }, [isOpen, profile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPendingFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleRemovePhoto = async () => {
    if (pendingFile) {
      setPendingFile(null);
      setAvatarPreview(profile.avatarUrl);
      return;
    }

    if (!profile.avatarUrl && !avatarPreview) {
      return;
    }

    setStatus("saving");
    setError(null);

    try {
      const response = await fetch("/api/profile/avatar", {
        method: "DELETE",
        credentials: "include",
      });
      const result = (await response.json()) as {
        success?: boolean;
        profile?: AttendeeProfileSnapshot;
        error?: string;
      };

      if (!response.ok || !result.success || !result.profile) {
        throw new Error(result.error ?? "Unable to remove photo.");
      }

      setPendingFile(null);
      setAvatarPreview(null);
      onSaved(result.profile);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to remove photo.");
    } finally {
      setStatus("idle");
    }
  };

  const handleSave = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedFirst || !trimmedLast) {
      setError("First and last name are required.");
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setStatus("saving");
    setError(null);

    try {
      const nameResponse = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: trimmedFirst,
          lastName: trimmedLast,
          email: trimmedEmail,
        }),
      });

      const nameResult = (await nameResponse.json()) as {
        success?: boolean;
        profile?: AttendeeProfileSnapshot;
        error?: string;
      };

      if (!nameResponse.ok || !nameResult.success || !nameResult.profile) {
        throw new Error(nameResult.error ?? "Unable to save profile.");
      }

      let nextProfile = nameResult.profile;

      if (pendingFile) {
        const formData = new FormData();
        formData.append("avatar", pendingFile);

        const avatarResponse = await fetch("/api/profile/avatar", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        const avatarResult = (await avatarResponse.json()) as {
          success?: boolean;
          profile?: AttendeeProfileSnapshot;
          error?: string;
        };

        if (!avatarResponse.ok || !avatarResult.success || !avatarResult.profile) {
          throw new Error(avatarResult.error ?? "Unable to upload profile photo.");
        }

        nextProfile = avatarResult.profile;
      }

      setPendingFile(null);
      onSaved(nextProfile);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to save profile.");
    } finally {
      setStatus("idle");
    }
  };

  const previewInitials = `${firstName.charAt(0) || "G"}${lastName.charAt(0) || "U"}`.toUpperCase();

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.button
            type="button"
            aria-label="Close profile editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm"
          />

          <div className="fixed inset-0 z-[130] flex items-center justify-center px-4 pt-safe pb-safe pointer-events-none">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-editor-title"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="pointer-events-auto max-h-[min(90dvh,calc(100dvh-2rem))] w-full max-w-lg overflow-y-auto rounded-2xl border border-brand-border bg-brand-panel p-6 shadow-[0_0_40px_rgba(0,168,255,0.15)]"
            >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="font-ui text-[0.58rem] font-bold uppercase tracking-[0.22em] text-brand-blue">
                  Your Profile
                </p>
                <h2
                  id="profile-editor-title"
                  className="mt-1 font-headline text-fluid-section uppercase tracking-[0.12em] text-white"
                >
                  Customize Identity
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="touch-target rounded-full border border-brand-border p-2 text-brand-muted transition hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <ProfileOrb
                initials={previewInitials}
                avatarUrl={avatarPreview}
                size="lg"
                aria-label="Profile preview"
              />

              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={status === "saving"}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-blue/40 bg-brand-blue/10 px-4 py-2 font-ui text-[0.62rem] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-brand-blue/20 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4 text-brand-blue" aria-hidden="true" />
                  Upload Photo
                </button>

                {avatarPreview ? (
                  <button
                    type="button"
                    onClick={() => void handleRemovePhoto()}
                    disabled={status === "saving"}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-border px-4 py-2 font-ui text-[0.62rem] font-bold uppercase tracking-[0.1em] text-brand-muted transition hover:border-brand-pink/40 hover:text-white disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </button>
                ) : null}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-ui text-[0.58rem] font-bold uppercase tracking-[0.12em] text-brand-muted">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={gateFieldClass(false, false)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-ui text-[0.58rem] font-bold uppercase tracking-[0.12em] text-brand-muted">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={gateFieldClass(false, false)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-ui text-[0.58rem] font-bold uppercase tracking-[0.12em] text-brand-muted">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={profile.isGuest ? "name@domain.com" : undefined}
                  className={`${gateFieldClass(isValidEmail(email), Boolean(email.trim()) && !isValidEmail(email))} break-all`}
                />
                {profile.isGuest ? (
                  <p className="mt-1.5 font-body text-[0.68rem] leading-relaxed text-brand-muted">
                    Guest contact email for updates. Your temporary sign-in address stays
                    private.
                  </p>
                ) : null}
              </div>

              {profile.isGuest ? (
                <p className="rounded-xl border border-brand-border bg-brand-black/70 px-4 py-3 font-body text-xs leading-relaxed text-brand-muted">
                  Guest sessions can customize your display name and photo here. Create a full
                  account later to keep your profile across devices.
                </p>
              ) : null}
            </div>

            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-brand-pink/40 bg-brand-pink/10 px-4 py-3 text-center font-body text-sm text-white"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SecondaryGateButton onClick={onClose} disabled={status === "saving"}>
                Cancel
              </SecondaryGateButton>
              <PrimaryGateButton
                type="button"
                disabled={status === "saving"}
                onClick={() => void handleSave()}
              >
                {status === "saving" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  "Save Profile"
                )}
              </PrimaryGateButton>
            </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
