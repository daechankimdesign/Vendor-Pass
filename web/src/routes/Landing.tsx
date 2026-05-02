import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDiscoverableVendors, submitLead } from "../lib/firestore";
import type { VendorPublicProfile } from "../lib/firestore";
import { SERVICE_CATEGORIES, getCategoryLabel } from "../lib/categories";
import type { ServiceCategory } from "../lib/categories";
import type { VerificationTier } from "../lib/docTypes";
import { DOC_TYPE_ORDER, DOC_TYPE_SCHEMAS } from "../lib/docTypes";
import { useAuth } from "../contexts/AuthContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DisplayVendor = VendorPublicProfile & { uid: string; demo?: boolean };

// ── Hardcoded demo businesses ─────────────────────────────────────────────────

const DEMO_VENDORS: DisplayVendor[] = [
  {
    uid: "demo-1",
    businessName: "GreenScapes Landscaping",
    businessZipCode: "90210",
    serviceZipCodes: ["90210", "90211", "90212"],
    categories: ["landscaping"],
    discoverable: true,
    overallTier: "verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-2",
    businessName: "ProFlow Plumbing",
    businessZipCode: "90210",
    serviceZipCodes: ["90210", "90213"],
    categories: ["plumbing"],
    discoverable: true,
    overallTier: "verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-3",
    businessName: "Volt Logic Electric",
    businessZipCode: "90211",
    serviceZipCodes: ["90210", "90211", "90214"],
    categories: ["electrical"],
    discoverable: true,
    overallTier: "self_verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-4",
    businessName: "Arctic Air HVAC",
    businessZipCode: "90212",
    serviceZipCodes: ["90210", "90212"],
    categories: ["hvac"],
    discoverable: true,
    overallTier: "self_verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-5",
    businessName: "Fresh Coat Painting",
    businessZipCode: "90210",
    serviceZipCodes: ["90210", "90211"],
    categories: ["painting"],
    discoverable: true,
    overallTier: "unverified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-6",
    businessName: "Shield Pest Solutions",
    businessZipCode: "90213",
    serviceZipCodes: ["90210", "90213", "90214"],
    categories: ["pest_control"],
    discoverable: true,
    overallTier: "verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-7",
    businessName: "All-Pro Handyman Services",
    businessZipCode: "90211",
    serviceZipCodes: ["90210", "90211", "90212"],
    categories: ["general_handyman"],
    discoverable: true,
    overallTier: "unverified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-8",
    businessName: "Blue River Plumbing Co.",
    businessZipCode: "90214",
    serviceZipCodes: ["90213", "90214"],
    categories: ["plumbing", "general_handyman"],
    discoverable: true,
    overallTier: "self_verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-9",
    businessName: "Precision Climate Control",
    businessZipCode: "90212",
    serviceZipCodes: ["90210", "90212", "90213"],
    categories: ["hvac", "electrical"],
    discoverable: true,
    overallTier: "verified",
    createdAt: null as never,
    demo: true,
  },
];

// ── Category icons ────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<ServiceCategory, string> = {
  plumbing: "🔧",
  landscaping: "🌿",
  electrical: "⚡",
  hvac: "❄️",
  painting: "🖌️",
  pest_control: "🛡️",
  general_handyman: "🔨",
};

// ── Tier helpers ──────────────────────────────────────────────────────────────

function tierBar(tier: VerificationTier | undefined) {
  if (tier === "verified") return "bg-primary-container";
  if (tier === "self_verified") return "bg-tier-2-bg";
  return "bg-outline-variant";
}

// ── Vendor card ───────────────────────────────────────────────────────────────

function VendorCard({ vendor, onClick }: { vendor: DisplayVendor; onClick: () => void }) {
  const icon = vendor.categories[0] ? CATEGORY_ICONS[vendor.categories[0]] : "🏢";
  const tier = vendor.overallTier;

  return (
    <button
      onClick={onClick}
      className="bg-surface-container-lowest border border-outline-variant rounded overflow-hidden flex flex-col w-full text-left hover:border-primary-container hover:shadow-modal transition-all"
    >
      {/* Tier color bar */}
      <div className={`h-1.5 w-full ${tierBar(tier)}`} />

      <div className="p-md flex flex-col flex-1">
        {/* Icon + name */}
        <div className="flex items-start gap-sm mb-sm">
          <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-xl flex-shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-h2 text-on-surface leading-tight">
              {vendor.businessName}
            </p>
            <p className="text-body-sm text-on-surface-variant mt-xs">
              {vendor.categories.map(getCategoryLabel).join(" · ")}
            </p>
          </div>
        </div>

        {/* Tier badge + zip */}
        <div className="mt-auto pt-sm border-t border-outline-variant flex items-center justify-between">
          <TierChip tier={tier} />
          <span className="text-body-sm text-on-surface-variant">
            {vendor.businessZipCode}
          </span>
        </div>
      </div>

      <div className="px-md pb-md">
        <span className="text-body-sm text-primary">
          View details →
        </span>
      </div>
    </button>
  );
}

// ── Vendor detail modal ───────────────────────────────────────────────────────

function docStatusForTier(overallTier: VerificationTier | undefined): VerificationTier | "missing" {
  if (overallTier === "verified") return "verified";
  if (overallTier === "self_verified") return "self_verified";
  return "missing";
}

function DocStatusBadge({ status }: { status: VerificationTier | "missing" }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-xs text-body-sm font-semibold text-on-primary bg-primary-container px-sm py-xs rounded">
        <ShieldCheckIcon /> Verified
      </span>
    );
  }
  if (status === "self_verified") {
    return (
      <span className="inline-flex items-center gap-xs text-body-sm font-semibold text-on-surface bg-tier-2-bg px-sm py-xs rounded">
        <PendingIcon /> Self-Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-body-sm text-on-surface-variant border border-tier-1-border px-sm py-xs rounded">
      Not uploaded
    </span>
  );
}

function VendorDetailModal({
  vendor,
  onClose,
}: {
  vendor: DisplayVendor;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const docStatus = docStatusForTier(vendor.overallTier);

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isLoggedIn = !!user;
  const isPm = profile?.role === "pm" || profile?.role === "property_manager";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay px-md"
      onClick={handleBackdrop}
    >
      <div className="modal w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-md mb-md">
          <div>
            <h2 className="text-h1 text-on-surface">{vendor.businessName}</h2>
            <p className="text-body-sm text-on-surface-variant mt-xs">
              {vendor.businessZipCode}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface text-xl leading-none flex-shrink-0 mt-xs"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tier */}
        <div className="mb-md">
          <TierChip tier={vendor.overallTier} />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-xs mb-lg">
          {vendor.categories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-xs bg-surface-container text-on-surface-variant text-body-sm px-sm py-xs rounded"
            >
              <span>{CATEGORY_ICONS[cat]}</span>
              {getCategoryLabel(cat)}
            </span>
          ))}
        </div>

        {/* Service area */}
        <div className="mb-lg">
          <p className="text-label-caps uppercase text-on-surface-variant mb-sm">Service Area</p>
          <div className="flex flex-wrap gap-xs">
            {(vendor.serviceZipCodes ?? [vendor.businessZipCode]).map((zip) => (
              <span key={zip} className="bg-surface-container text-on-surface text-body-sm px-sm py-xs rounded">
                {zip}
              </span>
            ))}
          </div>
        </div>

        {/* Compliance documents */}
        <div className="mb-lg">
          <p className="text-label-caps uppercase text-on-surface-variant mb-sm">Compliance Documents</p>
          <div className="space-y-sm">
            {DOC_TYPE_ORDER.map((docType) => (
              <div key={docType} className="flex items-center justify-between gap-md py-xs border-b border-outline-variant last:border-0">
                <span className="text-body-md text-on-surface font-semibold">
                  {DOC_TYPE_SCHEMAS[docType].label}
                </span>
                <DocStatusBadge status={docStatus} />
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="pt-sm border-t border-outline-variant">
          {!isLoggedIn && (
            <div className="space-y-sm">
              <p className="text-body-sm text-on-surface-variant">
                Sign in to invite this vendor to your project.
              </p>
              <div className="flex gap-sm">
                <button
                  className="btn-primary flex-1"
                  onClick={() => navigate("/login")}
                >
                  Sign in to Contact
                </button>
                <button
                  className="btn-secondary flex-1"
                  onClick={() => navigate("/signup")}
                >
                  Create Account
                </button>
              </div>
            </div>
          )}
          {isLoggedIn && isPm && !vendor.demo && (
            <button
              className="btn-primary w-full"
              onClick={() => { onClose(); navigate("/dashboard?tab=search"); }}
            >
              Invite to Project
            </button>
          )}
          {isLoggedIn && isPm && vendor.demo && (
            <div className="space-y-sm">
              <p className="text-body-sm text-on-surface-variant">
                This is a demo listing. Search real vendors from your dashboard.
              </p>
              <button
                className="btn-primary w-full"
                onClick={() => { onClose(); navigate("/dashboard?tab=search"); }}
              >
                Go to Dashboard
              </button>
            </div>
          )}
          {isLoggedIn && !isPm && (
            <p className="text-body-sm text-on-surface-variant text-center">
              Only property managers can invite vendors.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TierChip({ tier }: { tier: VerificationTier | undefined }) {
  if (tier === "verified") {
    return (
      <span className="inline-flex items-center gap-xs text-body-sm font-semibold text-on-primary bg-primary-container px-sm py-xs rounded">
        <ShieldCheckIcon /> Verified
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
    <span className="inline-flex items-center text-body-sm text-on-surface-variant border border-tier-1-border px-sm py-xs rounded">
      Unverified
    </span>
  );
}

// ── Sidebar panels ────────────────────────────────────────────────────────────

function ComplianceTiersPanel() {
  return (
    <div className="border border-outline-variant rounded bg-surface-container-lowest p-md">
      <p className="text-label-caps uppercase text-on-surface-variant mb-md tracking-widest">
        Compliance Tiers
      </p>
      <div className="space-y-md">
        {[
          {
            bar: "bg-primary-container",
            label: "Tier 3: Verified",
            color: "text-primary",
            desc: "Documents reviewed and approved by VendorPass. Highest trust level.",
          },
          {
            bar: "bg-tier-2-bg border border-outline-variant",
            label: "Tier 2: Self-Verified",
            color: "text-on-surface",
            desc: "Documentation submitted by the vendor, awaiting admin review.",
          },
          {
            bar: "bg-outline-variant",
            label: "Tier 1: Unverified",
            color: "text-on-surface-variant",
            desc: "Basic profile only. No verified documentation on file.",
          },
        ].map(({ bar, label, color, desc }) => (
          <div key={label} className="flex gap-sm">
            <div className={`w-1 rounded-full flex-shrink-0 ${bar}`} />
            <div>
              <p className={`text-body-sm font-semibold ${color}`}>{label}</p>
              <p className="text-body-sm text-on-surface-variant mt-xs">{desc}</p>
            </div>
          </div>
        ))}
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
  submitted, email, setEmail, emailError, setEmailError,
  submitError, submitting, onSubmit,
}: {
  submitted: boolean; email: string; setEmail: (v: string) => void;
  emailError: string | null; setEmailError: (v: string | null) => void;
  submitError: string | null; submitting: boolean; onSubmit: (e: React.FormEvent) => void;
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
            onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
          />
          {emailError && <p className="text-body-sm text-error">{emailError}</p>}
          {submitError && <p className="text-body-sm text-error">{submitError}</p>}
          <button type="submit" className="btn-secondary w-full" disabled={submitting}>
            {submitting ? "Joining…" : "Stay updated"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

function ShieldCheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1L1.5 3v3c0 2.5 1.9 4.3 4.5 5 2.6-.7 4.5-2.5 4.5-5V3L6 1z"
        stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.25" />
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
      <path d="M80 10L20 35v45c0 35 25 62 60 70 35-8 60-35 60-70V35L80 10z" fill="#0052cc" />
      <path d="M55 80l16 16L105 60" stroke="white" strokeWidth="8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Landing() {
  const { user, profile } = useAuth();
  const dashboardPath =
    profile?.role === "property_manager" ? "/dashboard" :
    profile?.role === "vendor" ? "/vendor" :
    profile?.role === "admin" ? "/admin" : "/dashboard";

  const [allVendors, setAllVendors] = useState<DisplayVendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<DisplayVendor | null>(null);

  // Search / filter state
  const [category, setCategory] = useState<ServiceCategory | "">("");
  const [zip, setZip] = useState("");
  const [activeFilter, setActiveFilter] = useState<{ category: ServiceCategory | ""; zip: string } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Waitlist state
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load reCAPTCHA
  useEffect(() => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
    if (!siteKey) return;
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  // Load all real vendors on mount, merge with demo
  useEffect(() => {
    getDiscoverableVendors()
      .then((real) => {
        // Real vendors replace demo entries with same uid; keep remaining demos
        const realUids = new Set(real.map((v) => v.uid));
        const filteredDemo = DEMO_VENDORS.filter((d) => !realUids.has(d.uid));
        setAllVendors([...real, ...filteredDemo]);
      })
      .catch(() => {
        setAllVendors(DEMO_VENDORS);
      })
      .finally(() => setLoadingVendors(false));
  }, []);

  // Derived: filtered list
  const displayVendors = (() => {
    if (!activeFilter) return allVendors;
    return allVendors.filter((v) => {
      const catMatch =
        !activeFilter.category || v.categories.includes(activeFilter.category as ServiceCategory);
      const zipMatch =
        !activeFilter.zip || v.serviceZipCodes?.includes(activeFilter.zip);
      return catMatch && zipMatch;
    });
  })();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(null);
    if (zip && !/^\d{5}$/.test(zip)) {
      setSearchError("Enter a valid 5-digit zip code.");
      return;
    }
    setActiveFilter({ category, zip });
  }

  function clearFilter() {
    setCategory("");
    setZip("");
    setActiveFilter(null);
    setSearchError(null);
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
            {user ? (
              <>
                <span className="text-body-sm text-on-surface-variant hidden sm:block">
                  {profile?.displayName || user.email}
                </span>
                <Link to={dashboardPath} className="btn-primary">
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-tertiary text-body-sm">Sign in</Link>
                <Link to="/signup" className="btn-primary">Add Your Business</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="bg-surface-container-lowest border-b border-outline-variant overflow-hidden">
        <div className="page-container py-xl flex items-center justify-between gap-lg">
          <div className="max-w-xl">
            <h1 className="text-on-surface font-bold" style={{ fontSize: "32px", lineHeight: "40px" }}>
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

              <button type="submit" className="btn-primary px-lg">
                Search
              </button>
            </form>

            {searchError && (
              <p className="mt-sm text-body-sm text-error">{searchError}</p>
            )}
          </div>

          <div className="hidden md:flex flex-shrink-0 items-center justify-center w-40 h-40">
            <HeroShield />
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="flex-1">
        <div className="page-container py-lg flex gap-lg items-start">

          {/* Main results */}
          <main className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-md flex-wrap gap-sm">
              <p className="text-h2 text-on-surface">
                Registered Businesses
                {!loadingVendors && (
                  <span className="ml-sm text-body-md text-on-surface-variant font-normal">
                    ({displayVendors.length})
                  </span>
                )}
              </p>
              {activeFilter && (
                <button
                  onClick={clearFilter}
                  className="text-body-sm text-primary underline underline-offset-2"
                >
                  Clear filter
                </button>
              )}
            </div>

            {loadingVendors ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-44 bg-surface-container rounded animate-pulse" />
                ))}
              </div>
            ) : displayVendors.length === 0 ? (
              <div className="flex items-center justify-center h-48 border border-dashed border-outline-variant rounded text-body-md text-on-surface-variant text-center px-lg">
                No vendors match this filter. Try a different category or zip code.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
                {displayVendors.map((vendor) => (
                  <VendorCard key={vendor.uid} vendor={vendor} onClick={() => setSelectedVendor(vendor)} />
                ))}
              </div>
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

      {/* ── Vendor detail modal ── */}
      {selectedVendor && (
        <VendorDetailModal
          vendor={selectedVendor}
          onClose={() => setSelectedVendor(null)}
        />
      )}

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
