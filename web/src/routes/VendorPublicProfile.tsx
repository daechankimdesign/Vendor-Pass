import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ShieldCheck, Clock, MapPin, Wrench, ArrowRight } from "lucide-react";
import { getVendorProfile } from "../lib/firestore";
import type { VendorPublicProfile } from "../lib/firestore";
import { getCategoryLabel } from "../lib/categories";
import { DOC_TYPE_ORDER, DOC_TYPE_SCHEMAS } from "../lib/docTypes";

function TierSection({ tier }: { tier: VendorPublicProfile["overallTier"] }) {
  if (tier === "verified") {
    return (
      <div className="flex items-center gap-sm p-md rounded-xl bg-primary-fixed">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <ShieldCheck size={20} className="text-white" aria-hidden />
        </div>
        <div>
          <p className="text-body-md font-semibold text-on-primary-fixed">Verified by VendorPass</p>
          <p className="text-body-sm text-on-primary-fixed-variant">All compliance documents reviewed and approved.</p>
        </div>
      </div>
    );
  }
  if (tier === "self_verified") {
    return (
      <div className="flex items-center gap-sm p-md rounded-xl bg-surface-container">
        <div className="w-10 h-10 rounded-full bg-tier-2-bg border border-outline-variant flex items-center justify-center flex-shrink-0">
          <Clock size={20} className="text-on-surface-variant" aria-hidden />
        </div>
        <div>
          <p className="text-body-md font-semibold text-on-surface">Self-Verified</p>
          <p className="text-body-sm text-on-surface-variant">Documents submitted by vendor, pending admin review.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-sm p-md rounded-xl bg-surface-container">
      <div className="w-10 h-10 rounded-full bg-outline-variant flex items-center justify-center flex-shrink-0">
        <Wrench size={20} className="text-on-surface-variant" aria-hidden />
      </div>
      <div>
        <p className="text-body-md font-semibold text-on-surface">Unverified</p>
        <p className="text-body-sm text-on-surface-variant">No compliance documents on file yet.</p>
      </div>
    </div>
  );
}

export default function VendorPublicProfile() {
  const { uid } = useParams<{ uid: string }>();
  const [profile, setProfile] = useState<VendorPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!uid) { setNotFound(true); setLoading(false); return; }
    getVendorProfile(uid)
      .then((p) => {
        if (!p) setNotFound(true);
        else setProfile(p);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [uid]);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Nav */}
      <header className="bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-10">
        <div className="page-container flex items-center justify-between h-14">
          <Link to="/" className="text-h2 text-on-surface font-bold">VendorPass.</Link>
          <div className="flex items-center gap-sm">
            <Link to="/login" className="btn-tertiary text-body-sm">Sign in</Link>
            <Link to="/signup" className="btn-primary">Add Your Business</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 page-container py-xl max-w-2xl mx-auto w-full">
        {loading && (
          <div className="space-y-md animate-pulse">
            <div className="h-8 bg-surface-container rounded w-2/3" />
            <div className="h-4 bg-surface-container rounded w-1/3" />
            <div className="h-24 bg-surface-container rounded" />
          </div>
        )}

        {!loading && notFound && (
          <div className="text-center py-xl">
            <p className="text-h1 text-on-surface mb-sm">Profile not found</p>
            <p className="text-body-md text-on-surface-variant mb-lg">This vendor profile may have been removed or the link is incorrect.</p>
            <Link to="/" className="btn-primary">Browse Vendors</Link>
          </div>
        )}

        {!loading && profile && (
          <div className="space-y-lg">
            {/* Header */}
            <div>
              <h1 className="text-on-surface font-bold" style={{ fontSize: "28px", lineHeight: "36px" }}>
                {profile.businessName}
              </h1>
              <p className="text-body-md text-on-surface-variant mt-xs">
                {profile.categories.map(getCategoryLabel).join(" · ")}
              </p>
            </div>

            {/* Tier badge */}
            <TierSection tier={profile.overallTier} />

            {/* Service area */}
            <div className="border border-outline-variant rounded-xl p-md">
              <div className="flex items-center gap-xs mb-sm">
                <MapPin size={14} className="text-on-surface-variant" aria-hidden />
                <p className="text-label-caps uppercase text-on-surface-variant tracking-widest">Service Area</p>
              </div>
              <div className="flex flex-wrap gap-xs">
                {(profile.serviceZipCodes?.length ? profile.serviceZipCodes : [profile.businessZipCode]).map((zip) => (
                  <span key={zip} className="bg-surface-container text-on-surface text-body-sm px-sm py-xs rounded-full">
                    {zip}
                  </span>
                ))}
              </div>
            </div>

            {/* Compliance checklist */}
            <div className="border border-outline-variant rounded-xl p-md">
              <p className="text-label-caps uppercase text-on-surface-variant mb-md tracking-widest">Compliance Documents</p>
              <div className="space-y-sm">
                {DOC_TYPE_ORDER.map((docType) => {
                  const verified = profile.overallTier === "verified";
                  const selfVerified = profile.overallTier === "self_verified";
                  return (
                    <div key={docType} className="flex items-center justify-between gap-md py-xs border-b border-outline-variant last:border-0">
                      <span className="text-body-md text-on-surface">{DOC_TYPE_SCHEMAS[docType].label}</span>
                      {verified ? (
                        <span className="inline-flex items-center gap-xs text-body-sm font-semibold text-on-primary bg-primary-container px-sm py-xs rounded">
                          <ShieldCheck size={12} aria-hidden /> Verified
                        </span>
                      ) : selfVerified ? (
                        <span className="inline-flex items-center gap-xs text-body-sm text-on-surface bg-tier-2-bg px-sm py-xs rounded">
                          <Clock size={12} aria-hidden /> Submitted
                        </span>
                      ) : (
                        <span className="text-body-sm text-on-surface-variant border border-outline-variant px-sm py-xs rounded">
                          Not uploaded
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <div className="bg-primary-fixed rounded-2xl p-lg text-center">
              <p className="text-h2 text-on-primary-fixed font-bold mb-xs">
                Request a quote from {profile.businessName}
              </p>
              <p className="text-body-md text-on-primary-fixed-variant mb-md">
                Create a free VendorPass account to send a quote request directly to {profile.businessName}.
              </p>
              <Link
                to={`/signup?ref=vendor&uid=${uid}`}
                className="btn-primary inline-flex items-center gap-xs"
              >
                Sign up to request a quote <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-outline-variant bg-surface-container-lowest">
        <div className="page-container py-md flex items-center justify-between gap-sm flex-wrap">
          <p className="text-body-sm text-on-surface-variant">© {new Date().getFullYear()} VendorPass</p>
          <Link to="/terms" className="text-body-sm text-on-surface-variant hover:text-on-surface">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
