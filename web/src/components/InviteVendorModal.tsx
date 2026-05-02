import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

interface Props {
  projectId: string;
  onClose: () => void;
  onInvited?: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InviteVendorModal({ projectId, onClose, onInvited }: Props) {
  const { profile } = useAuth();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    if (!EMAIL_RE.test(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError(null);
    setSending(true);
    setError(null);

    try {
      const sendInvite = httpsCallable(functions, "sendInvite");
      await sendInvite({
        pmUid: profile.uid,
        vendorEmail: email,
        projectId,
        source: "email",
      });
      setSent(true);
      onInvited?.();
    } catch (err) {
      setError("Failed to send invite. Please try again.");
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="flex items-center justify-between mb-lg">
          <h2 className="text-h1 text-on-surface">Invite Vendor by Email</h2>
          <button
            className="text-on-surface-variant hover:text-on-surface"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {sent ? (
          <div className="space-y-md">
            <p className="text-body-md text-on-surface">
              Invite sent to <strong>{email}</strong>.
            </p>
            <p className="text-body-sm text-on-surface-variant">
              If they don't have an account, they'll receive a signup link valid for 14 days.
            </p>
            <button className="btn-secondary w-full" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-md">
            <div>
              <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
                Vendor email
              </label>
              <input
                type="email"
                className={`input ${emailError ? "input-error" : ""}`}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder="vendor@company.com"
                autoFocus
              />
              {emailError && <p className="mt-xs text-body-sm text-error">{emailError}</p>}
            </div>

            {error && <p className="text-body-sm text-error">{error}</p>}

            <div className="flex gap-sm">
              <button type="submit" className="btn-primary flex-1" disabled={sending}>
                {sending ? "Sending…" : "Send Invite"}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
