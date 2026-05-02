import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { submitLead } from "../lib/firestore";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export default function Landing() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load reCAPTCHA v3 script
  useEffect(() => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
    if (!siteKey) return;
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();

    if (!EMAIL_RE.test(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    setSubmitError(null);

    try {
      const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
      if (siteKey && window.grecaptcha) {
        await new Promise<void>((resolve) => window.grecaptcha!.ready(resolve));
        await window.grecaptcha!.execute(siteKey, { action: "waitlist" });
      }
      await submitLead(email);
      setSubmitted(true);
    } catch (err) {
      setSubmitError("Something went wrong. Please try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-gutter py-xl">
        <div className="w-full max-w-2xl">
          {/* Hero image placeholder — replace /public/hero.jpg when available */}
          <div
            className="w-full h-48 bg-surface-container rounded mb-lg"
            role="img"
            aria-label="Compliance Roster hero image"
          />

          <h1 className="text-display text-on-surface">Compliance Roster.</h1>
          <p className="mt-sm text-body-md text-on-surface-variant">
            Find compliant local vendors for every job.
          </p>

          {/* CTAs */}
          <div className="mt-lg flex flex-wrap gap-sm items-start">
            <Link to="/signup" className="btn-primary">
              Access Beta
            </Link>

            {submitted ? (
              <p className="text-body-md text-on-surface py-sm">
                You're on the list. We'll be in touch.
              </p>
            ) : (
              <form onSubmit={handleWaitlist} className="flex flex-wrap gap-sm items-start" noValidate>
                <div>
                  <input
                    type="email"
                    className={`input w-64 ${emailError ? "input-error" : ""}`}
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    aria-label="Email address for waitlist"
                  />
                  {emailError && (
                    <p className="mt-xs text-body-sm text-error">{emailError}</p>
                  )}
                  {submitError && (
                    <p className="mt-xs text-body-sm text-error">{submitError}</p>
                  )}
                </div>
                <button type="submit" className="btn-secondary" disabled={submitting}>
                  {submitting ? "Joining…" : "Join Waitlist"}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Minimal footer */}
      <footer className="px-gutter pb-lg">
        <p className="text-body-sm text-on-surface-variant">
          <Link to="/terms" className="underline underline-offset-2 hover:text-on-surface">
            Terms
          </Link>
        </p>
      </footer>
    </div>
  );
}
