export type DocType = "businessLicense" | "w9" | "coi";
export type VerificationTier = "unverified" | "self_verified" | "verified";

export interface ExtractedField {
  value: string | null;
  confidence: number;
}

export interface VendorDocument {
  docType: DocType;
  storagePath: string;
  extractedFields: Record<string, ExtractedField>;
  extractionStatus: "processing" | "success" | "partial" | "failed";
  tier: VerificationTier;
  vendorConfirmed: boolean;
  adminReviewed: boolean;
  expirationDate: { seconds: number; nanoseconds: number } | null;
  uploadedAt: { seconds: number; nanoseconds: number };
  lastUpdatedAt: { seconds: number; nanoseconds: number };
}

export interface DocTypeSchema {
  label: string;
  fields: FieldSchema[];
  hasExpiration: boolean;
}

export interface FieldSchema {
  key: string;
  label: string;
  required: boolean;
  /** Render using the data-mono typography token (license numbers, TINs, policy numbers) */
  mono: boolean;
  type?: "text" | "date";
}

export const DOC_TYPE_SCHEMAS: Record<DocType, DocTypeSchema> = {
  businessLicense: {
    label: "Business License",
    hasExpiration: true,
    fields: [
      { key: "business_legal_name", label: "Business Legal Name", required: true, mono: false },
      { key: "license_number", label: "License Number", required: true, mono: true },
      { key: "issuing_authority", label: "Issuing Authority", required: true, mono: false },
      { key: "issue_date", label: "Issue Date", required: true, mono: false, type: "date" },
      { key: "expiration_date", label: "Expiration Date", required: true, mono: false, type: "date" },
    ],
  },
  w9: {
    label: "W-9",
    hasExpiration: false,
    fields: [
      { key: "legal_name", label: "Legal Name", required: true, mono: false },
      { key: "business_name", label: "Business Name (if different)", required: false, mono: false },
      { key: "tin_ein", label: "TIN / EIN", required: true, mono: true },
      { key: "address", label: "Address", required: true, mono: false },
      { key: "signature_date", label: "Signature Date", required: true, mono: false, type: "date" },
    ],
  },
  coi: {
    label: "Certificate of Insurance",
    hasExpiration: true,
    fields: [
      { key: "insured_name", label: "Insured Name", required: true, mono: false },
      { key: "carrier", label: "Carrier", required: true, mono: false },
      { key: "policy_number", label: "Policy Number", required: true, mono: true },
      {
        key: "general_liability_limit",
        label: "General Liability Limit",
        required: true,
        mono: false,
      },
      {
        key: "policy_expiration_date",
        label: "Policy Expiration Date",
        required: true,
        mono: false,
        type: "date",
      },
      { key: "additional_insured", label: "Additional Insured", required: false, mono: false },
    ],
  },
};

export const DOC_TYPE_ORDER: DocType[] = ["businessLicense", "w9", "coi"];

/** Returns the minimum tier across all supplied documents. Missing doc = unverified. */
export function computeOverallTier(
  docs: Partial<Record<DocType, VendorDocument>>
): VerificationTier {
  const tierRank: Record<VerificationTier, number> = {
    unverified: 0,
    self_verified: 1,
    verified: 2,
  };

  let min: VerificationTier = "unverified";
  let minRank = Infinity;

  for (const docType of DOC_TYPE_ORDER) {
    const doc = docs[docType];
    if (!doc) return "unverified"; // missing doc forces unverified overall
    const rank = tierRank[doc.tier];
    if (rank < minRank) {
      minRank = rank;
      min = doc.tier;
    }
  }

  return min;
}
