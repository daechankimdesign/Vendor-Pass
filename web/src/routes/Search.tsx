import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchVendors } from "../lib/firestore";
import type { VendorPublicProfile } from "../lib/firestore";
import { SERVICE_CATEGORIES, getCategoryLabel } from "../lib/categories";
import type { ServiceCategory } from "../lib/categories";
import type { VerificationTier } from "../lib/docTypes";
import VendorSearchCard from "../components/VendorSearchCard";
import ProjectPickerModal from "../components/ProjectPickerModal";
type TierFilter = VerificationTier;

const ALL_TIERS: TierFilter[] = ["verified", "self_verified", "unverified"];

const TIER_RANK: Record<VerificationTier, number> = {
  verified: 0,
  self_verified: 1,
  unverified: 2,
};

interface SearchPaneProps {
  defaultZip?: string;
}

export default function Search() {
  const [params] = useSearchParams();
  return <SearchPane defaultZip={params.get("zip") ?? undefined} />;
}

export function SearchPane({ defaultZip }: SearchPaneProps) {
  const [category, setCategory] = useState<ServiceCategory | "">("");
  const [zip, setZip] = useState(defaultZip ?? "");
  const [tiers, setTiers] = useState<Set<TierFilter>>(new Set(ALL_TIERS));
  const [results, setResults] = useState<Array<VendorPublicProfile & { uid: string }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<{ uid: string; email?: string } | null>(null);

  function toggleTier(tier: TierFilter) {
    setTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) { next.delete(tier); } else { next.add(tier); }
      return next;
    });
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !/^\d{5}$/.test(zip)) return;

    setLoading(true);
    setSearched(true);
    try {
      const raw = await searchVendors(category as ServiceCategory, zip);
      setResults(raw);
    } finally {
      setLoading(false);
    }
  }

  // Client-side tier filter + sort: verified first, then self_verified, then unverified
  const filtered = results
    ? results
        .filter((v) => tiers.has(v.overallTier ?? "unverified"))
        .sort((a, b) => {
          const ra = TIER_RANK[a.overallTier ?? "unverified"];
          const rb = TIER_RANK[b.overallTier ?? "unverified"];
          if (ra !== rb) return ra - rb;
          return (a.businessName ?? "").localeCompare(b.businessName ?? "");
        })
    : null;

  const categoryMissing = searched && !category;
  const zipInvalid = searched && !/^\d{5}$/.test(zip);

  return (
    <div className="flex gap-lg min-h-0">
      {/* Filter sidebar — fixed width, sticky */}
      <aside className="w-56 flex-shrink-0">
        <form onSubmit={handleSearch} className="space-y-lg sticky top-lg">
          <div>
            <label className="block text-label-caps uppercase text-on-surface-variant mb-sm">
              Category <span className="text-error">*</span>
            </label>
            <select
              className={`input ${categoryMissing ? "input-error" : ""}`}
              value={category}
              onChange={(e) => setCategory(e.target.value as ServiceCategory | "")}
            >
              <option value="">Select…</option>
              {SERVICE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {getCategoryLabel(cat)}
                </option>
              ))}
            </select>
            {categoryMissing && (
              <p className="mt-xs text-body-sm text-error">Category is required.</p>
            )}
          </div>

          <div>
            <label className="block text-label-caps uppercase text-on-surface-variant mb-sm">
              Project zip
            </label>
            <input
              className={`input ${zipInvalid ? "input-error" : ""}`}
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="e.g. 90210"
              maxLength={5}
            />
            {zipInvalid && (
              <p className="mt-xs text-body-sm text-error">Enter a 5-digit zip.</p>
            )}
          </div>

          <div>
            <p className="text-label-caps uppercase text-on-surface-variant mb-sm">
              Compliance Tier
            </p>
            <div className="space-y-xs">
              {ALL_TIERS.map((tier) => (
                <label key={tier} className="flex items-center gap-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tiers.has(tier)}
                    onChange={() => toggleTier(tier)}
                    className="accent-primary-container"
                  />
                  <span className="text-body-md text-on-surface capitalize">
                    {tier === "self_verified" ? "Self-Verified" : tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </form>
      </aside>

      {/* Results */}
      <div className="flex-1 min-w-0">
        {!searched && (
          <div className="flex items-center justify-center h-48 text-body-md text-on-surface-variant">
            Select a category and zip to search.
          </div>
        )}

        {searched && loading && (
          <div className="flex items-center justify-center h-48 text-body-md text-on-surface-variant">
            Searching…
          </div>
        )}

        {searched && !loading && filtered !== null && (
          <>
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-body-md text-on-surface-variant text-center px-lg">
                No vendors match these filters in zip {zip}.{" "}
                Try a nearby zip or broaden your tier filter.
              </div>
            ) : (
              <div className="space-y-sm">
                <p className="text-body-sm text-on-surface-variant mb-md">
                  {filtered.length} vendor{filtered.length !== 1 ? "s" : ""} found
                </p>
                {filtered.map((vendor) => (
                  <VendorSearchCard
                    key={vendor.uid}
                    vendor={vendor}
                    onInvite={(uid) => setInviteTarget({ uid })}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Invite modal */}
      {inviteTarget && (
        <ProjectPickerModal
          vendorUid={inviteTarget.uid}
          vendorEmail={inviteTarget.email}
          onClose={() => setInviteTarget(null)}
          onInvited={() => setInviteTarget(null)}
        />
      )}
    </div>
  );
}
