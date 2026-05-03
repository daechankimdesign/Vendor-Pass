import { ShieldCheck } from "lucide-react";
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
      <ShieldCheck size={12} aria-hidden className="flex-shrink-0" />
      {displayLabel}
    </span>
  );
}
