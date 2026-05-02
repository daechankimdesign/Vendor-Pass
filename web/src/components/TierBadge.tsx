import type { VerificationTier } from "../lib/docTypes";

interface Props {
  tier: VerificationTier | null | undefined;
  label?: string;
}

const TIER_LABELS: Record<VerificationTier, string> = {
  unverified: "Unverified",
  self_verified: "Self-Verified",
  verified: "Verified",
};

/**
 * Compliance badge — 4px radius rectangle per design.md. NEVER a pill.
 * - null/undefined (missing doc): renders nothing
 * - unverified: transparent bg, 1px #DFE1E6 border, neutral text
 * - self_verified: #F4F5F7 solid fill, no border, dark gray text
 * - verified: #0052CC fill, white text, shield checkmark (Tier 3 only)
 */
export default function TierBadge({ tier, label }: Props) {
  if (!tier) return null;

  const displayLabel = label ?? TIER_LABELS[tier];

  if (tier === "unverified") {
    return (
      <span className="inline-flex items-center px-sm py-xs text-body-sm text-on-surface-variant border border-tier-1-border rounded bg-transparent whitespace-nowrap">
        {displayLabel}
      </span>
    );
  }

  if (tier === "self_verified") {
    return (
      <span className="inline-flex items-center px-sm py-xs text-body-sm text-on-surface bg-tier-2-bg rounded whitespace-nowrap">
        {displayLabel}
      </span>
    );
  }

  // verified — Tier 3: solid primary-container, white text, shield icon
  return (
    <span className="inline-flex items-center gap-xs px-sm py-xs text-body-sm text-on-primary bg-primary-container rounded whitespace-nowrap">
      <ShieldCheckIcon />
      {displayLabel}
    </span>
  );
}

function ShieldCheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <path
        d="M6 1L1.5 3v3c0 2.5 1.9 4.3 4.5 5 2.6-.7 4.5-2.5 4.5-5V3L6 1z"
        stroke="currentColor"
        strokeWidth="1"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path
        d="M4 6l1.3 1.3L8 4.5"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
