import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { searchVendors, submitLead } from "../lib/firestore";
import type { VendorPublicProfile } from "../lib/firestore";
import { SERVICE_CATEGORIES, getCategoryLabel } from "../lib/categories";
import type { ServiceCategory } from "../lib/categories";
import type { VerificationTier } from "../lib/docTypes";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

type SearchResult = VendorPublicProfile & { uid: string };

// ── Category icons (emoji per service type) ───────────────────────────────────

const CATEGORY_ICONS: Record<ServiceCategory, string> = {
  plumbing: "🔧",
  landscaping: "🌿",
  electrical: "⚡",
  hvac: "❄️",
  painting: "🖌️",
  pest_control: "🛡️",
  general_handyman: "🔨",
};

// ── Tier accent colors ────────────────────────────────────────────────────────

function tierAccent(tier: VerificationTier | undefined) {
  if (tier === "verified") return "bg-primary-container";
  if (tier === "self_verified") return "bg-tier-2-bg";
  return "bg-outline-variant";
}

// ── Vendor card ───────────────────────────────────────────────────────────────

function VendorCard({ vendor }: { vendor: SearchResult }) {
  const icon =
    vendor.categories[0] ? CATEGORY_ICONS[vendor.categories[0]] : "🏢";
  const tier = vendor.overallTier;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded overflow-hidden flex flex-col">
      {/* Tier color bar */}
      <div className={`h-1.5 w-full ${tierAccent(tier)}`} />

      <div className="p-md flex flex-col flex-1">
        {/* Icon + name */}
        <div className="flex items-start gap-sm mb-sm">
          <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-lg flex-shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-h2 text-on-surface leading-tight truncate">
              {vendor.businessName || "—"}
            </p>
            <p className="text-body-sm text-on-surface-variant mt-xs">
              {vendor.categories.map(getCategoryLabel).join(" · ")}
            </p>
          </div>
        </div>

        {/* Tier badge */}
        <div className="mt-auto pt-sm border-t border-outline-variant flex items-center justify-between">
          <TierChip tier={tier} />
          <span className="text-body-sm text-on-surface-variant">
            {vendor.businessZipCode}
          </span>
        </div>
      </div>

      {/* CTA footer */}
      <div className="px-md pb-md">
        <Link
          to="/signup"
          className="block text-center text-body-sm text-primary underline underline-offset-2 hover:text-on-surface"
        >
          Sign up to invite →
        </Link>
      </div>
    </div>
  );
}

function TierChip({ tier }: { tier: VerificationTier | undefined }) {
  if (tier === "verified") {
    return (
      <span className="inline-flex items-center gap-xs text-body-sm font-semibold text-on-primary bg-primary-container px-sm py-xs rounded">
        <ShieldCheck /> Verified
      </span>
    );
  }
  if (tier === "self_verified") {
    return (
      <span className="inline-flex items-center gap-xs text-body-sm font-semibold text-on-surface bg-tier-2-bg px-sm py-xs rounded">
        <PendingIcon /> Self-Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-xs text-body-sm text-on-surface-variant border border-tier-1-border px-sm py-xs rounded">
      Unverified
    </span>
  );
}

// ── Info sidebar panels ───────────────────────────────────────────────────────

function ComplianceTiersPanel() {
  return (
    <div className="border border-outline-variant rounded bg-surface-container-lowest p-md">
      <p className="text-label-caps uppercase text-on-surface-variant mb-md tracking-widest">
        Compliance Tiers
      </p>
      <div className="space-y-md">
        <TierRow
          accent="bg-primary-container"
          label="Tier 3: Verified"
          labelColor="text-primary"
          desc="Documentation reviewed and approved by VendorPass. Highest trust level."
        />
        <TierRow
          accent="bg-tier-2-bg"
          label="Tier 2: Self-Verified"
          labelColor="text-on-surface"
          desc="Documentation submitted by the vendor and awaiting admin review."
        />
        <TierRow
          accent="bg-outline-variant"
          label="Tier 1: Unverified"
          labelColor="text-on-surface-variant"
          desc="Basic profile only. No verified documentation on file."
        />
      </div>
    </div>
  );
}

function TierRow({
  accent,
  label,
  labelColor,
  desc,
}: {
  accent: string;
  label: string;
  labelColor: string;
  desc: string;
}) {
  return (
    <div className="flex gap-sm">
      <div className={`w-1 rounded-full flex-shrink-0 ${accent}`} />
      <div>
        <p className={`text-body-sm font-semibold ${labelColor}`}>{label}</p>
        <p className="text-body-sm text-on-surface-variant mt-xs">{desc}</p>
      </div>
    </div>
  );
}

function WhyVendorPassPanel() {
  return (
    <div className="border border-outline-variant rounded bg-primary-container p-md">
      <p className="text-label-caps uppercase text-on-primary mb-md tracking-widest">
        Why VendorPass?
      </p>
      <ul className="space-y-sm">
        {[
          "Instant compliance document check",
          "Insurance & license verification",
          "Expiration date tracking & alerts",
          "Risk-scored vendor roster",
        ].map((item) => (
          <li key={item} className="flex items-start gap-sm text-body-sm text-on-primary">
            <span className="flex-shrink-0 mt-xs">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VendorCTAPanel({
  submitted,
  email,
  setEmail,
  emailError,
  setEmailError,
  submitError,
  submitting,
  onSubmit,
}: {
  submitted: boolean;
  email: string;
  setEmail: (v: string) => void;
  emailError: string | null;
  setEmailError: (v: string | null) => void;
  submitError: string | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="border border-outline-variant rounded bg-surface-container-lowest p-md">
      <p className="text-h2 text-on-surface mb-xs">Are you a vendor?</p>
      <p className="text-body-sm text-on-surface-variant mb-md">
        Register your business to appear in property manager searches.
      </p>
      <Link to="/signup" className="btn-primary block text-center mb-md">
        Register Your Business
      </Link>

      {submitted ? (
        <p className="text-body-sm text-on-surface-variant text-center">
          You're on the list. We'll be in touch.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-xs">
          <input
            type="email"
            className={`input w-full ${emailError ? "input-error" : ""}`}
            placeholder="Email for updates"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
          />
          {emailError && (
            <p className="text-body-sm text-error">{emailError}</p>
          )}
          {submitError && (
            <p className="text-body-sm text-error">{submitError}</p>
          )}
          <button type="submit" className="btn-secondary w-full" disabled={submitting}>
            {submitting ? "Joining…" : "Stay updated"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

function ShieldCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M6 1L1.5 3v3c0 2.5 1.9 4.3 4.5 5 2.6-.7 4.5-2.5 4.5-5V3L6 1z"
        stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.25"
      />
      <path d="M4 6l1.3 1.3L8 4.5" stroke="white" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1" />
      <path d="M6 3.5v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeroShield() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" aria-hidden="true"
      className="opacity-10">
      <path
        d="M80 10L20 35v45c0 35 25 62 60 70 35-8 60-35 60-70V35L80 10z"
        fill="#0052cc"
      />
      <path
        d="M55 80l16 16L105 60"
        stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Landing() {
  const [category, setCategory] = useState<ServiceCategory | "">("");
  const [zip, setZip] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
    if (!siteKey) return;
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(null);
    if (!category) { setSearchError("Please select a service category."); return; }
    if (!/^\d{5}$/.test(zip)) { setSearchError("Enter a valid 5-digit zip code."); return; }
    setSearching(true);
    setSearched(true);
    try {
      setResults(await searchVendors(category as ServiceCategory, zip));
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) { setEmailError("Please enter a valid email address."); return; }
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
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">

      {/* ── Nav ── */}
      <header className="bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-10">
        <div className="page-container flex items-center justify-between h-14">
          <span className="text-h2 text-on-surface font-bold">VendorPass.</span>
          <div className="flex items-center gap-sm">
            <Link to="/login" className="btn-tertiary text-body-sm">Sign in</Link>
            <Link to="/signup" className="btn-primary">Add Your Business</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="bg-surface-container-lowest border-b border-outline-variant overflow-hidden">
        <div className="page-container py-xl flex items-center justify-between gap-lg">
          <div className="max-w-xl">
            <h1 className="text-display text-on-surface" style={{ fontSize: "32px", lineHeight: "40px" }}>
              Find the right hands, locally.
            </h1>
            <p className="mt-sm text-body-md text-on-surface-variant max-w-md">
              Search verified service providers across your area. All vendors are
              categorized by compliance and risk-mitigation tiers.
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="mt-lg flex flex-wrap gap-sm items-stretch">
              <select
                className="input flex-1 min-w-40"
                value={category}
                onChange={(e) => setCategory(e.target.value as ServiceCategory | "")}
                aria-label="Service category"
              >
                <option value="">All Services</option>
                {SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                ))}
              </select>

              <input
                className="input w-32"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="Zip code"
                maxLength={5}
                aria-label="Zip code"
              />

              <button type="submit" className="btn-primary px-lg" disabled={searching}>
                {searching ? "Searching…" : "Search"}
              </button>
            </form>

            {searchError && (
              <p className="mt-sm text-body-sm text-error">{searchError}</p>
            )}
          </div>

          {/* Decorative shield */}
          <div className="hidden md:flex flex-shrink-0 items-center justify-center w-40 h-40">
            <HeroShield />
          </div>
        </div>
      </section>

      {/* ── Body: results + sidebar ── */}
      <div className="flex-1">
        <div className="page-container py-lg flex gap-lg items-start">

          {/* Main results area */}
          <main className="flex-1 min-w-0">
            {!searched && (
              <div>
                <p className="text-h2 text-on-surface mb-md">Registered Businesses</p>
                <div className="flex items-center justify-center h-48 border border-dashed border-outline-variant rounded text-body-md text-on-surface-variant text-center">
                  Select a category and zip code above to find local vendors.
                </div>
              </div>
            )}

            {searched && searching && (
              <div className="flex items-center justify-center h-48 text-body-md text-on-surface-variant">
                Searching…
              </div>
            )}

            {searched && !searching && results !== null && (
              <>
                <div className="flex items-center justify-between mb-md">
                  <p className="text-h2 text-on-surface">
                    Registered Businesses
                    <span className="ml-sm text-body-md text-on-surface-variant font-normal">
                      ({results.length})
                    </span>
                  </p>
                </div>

                {results.length === 0 ? (
                  <div className="flex items-center justify-center h-48 border border-dashed border-outline-variant rounded text-body-md text-on-surface-variant text-center px-lg">
                    No vendors found in zip {zip} for this category.
                    Try a nearby zip or a different category.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
                    {results.map((vendor) => (
                      <VendorCard key={vendor.uid} vendor={vendor} />
                    ))}
                  </div>
                )}
              </>
            )}
          </main>

          {/* Sidebar */}
          <aside className="w-72 flex-shrink-0 space-y-md hidden lg:block">
            <ComplianceTiersPanel />
            <WhyVendorPassPanel />
            <VendorCTAPanel
              submitted={submitted}
              email={email}
              setEmail={setEmail}
              emailError={emailError}
              setEmailError={setEmailError}
              submitError={submitError}
              submitting={submitting}
              onSubmit={handleWaitlist}
            />
          </aside>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-outline-variant bg-surface-container-lowest">
        <div className="page-container py-md flex flex-wrap items-center justify-between gap-sm">
          <div>
            <p className="text-body-sm font-semibold text-on-surface">VendorPass</p>
            <p className="text-body-sm text-on-surface-variant">
              © {new Date().getFullYear()} VendorPass. All rights reserved.
            </p>
          </div>
          <div className="flex gap-md">
            <Link to="/terms" className="text-body-sm text-on-surface-variant hover:text-on-surface">
              Terms of Service
            </Link>
            <Link to="/terms" className="text-body-sm text-on-surface-variant hover:text-on-surface">
              Liability Disclosure
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
