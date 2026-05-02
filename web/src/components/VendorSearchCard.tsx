import TierBadge from "./TierBadge";
import { getCategoryLabel } from "../lib/categories";
import type { VendorPublicProfile } from "../lib/firestore";

interface Props {
  vendor: VendorPublicProfile & { uid: string };
  onInvite: (vendorUid: string) => void;
}

export default function VendorSearchCard({ vendor, onInvite }: Props) {
  return (
    <div className="card flex items-start justify-between gap-md">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-sm flex-wrap">
          <span className="text-h2 text-on-surface">{vendor.businessName || "—"}</span>
          <TierBadge tier={vendor.overallTier} />
        </div>

        <div className="mt-xs flex flex-wrap gap-xs">
          {vendor.categories.map((cat) => (
            <span
              key={cat}
              className="inline-block bg-surface-container text-on-surface-variant text-body-sm px-sm py-xs rounded"
            >
              {getCategoryLabel(cat)}
            </span>
          ))}
        </div>

        <p className="mt-sm text-body-sm text-on-surface-variant">
          {vendor.businessZipCode}
        </p>
      </div>

      <button
        className="btn-primary flex-shrink-0"
        onClick={() => onInvite(vendor.uid)}
      >
        Invite to Project
      </button>
    </div>
  );
}
