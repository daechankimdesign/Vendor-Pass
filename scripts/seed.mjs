/**
 * Seed script — creates test vendors and PMs in Firebase.
 * Usage:
 *   node scripts/seed.mjs path/to/serviceAccountKey.json
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const keyPath = process.argv[2];
if (!keyPath) {
  console.error("Usage: node scripts/seed.mjs path/to/serviceAccountKey.json");
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });

const auth = getAuth();
const db = getFirestore();

const DOC_TYPE_ALIASES = {
  businessLicense: "businessLicense",
  w9: "w9",
  coi: "coi",
};

// ── Seed data ────────────────────────────────────────────────────────────────

const VENDORS = [
  {
    email: "apex.plumbing@test.com",
    password: "Test1234!",
    profile: {
      businessName: "Apex Plumbing Solutions",
      businessZipCode: "90210",
      serviceZipCodes: ["90210", "90211", "90212", "90024", "90025"],
      categories: ["plumbing"],
      discoverable: true,
      overallTier: "verified",
      role: "vendor",
      onboardingComplete: true,
    },
    contact: { contactEmail: "apex.plumbing@test.com", phone: "310-555-0101" },
    docs: {
      businessLicense: { tier: "verified", adminReviewed: true, extractedFields: { licenseNumber: "BL-2024-88421", expiresAt: "2026-03-15" } },
      w9: { tier: "verified", adminReviewed: true, extractedFields: { businessName: "Apex Plumbing Solutions LLC", ein: "XX-XXXXXXX" } },
      coi: { tier: "verified", adminReviewed: true, extractedFields: { insurer: "Hartford Insurance", coverageLimit: "$2,000,000", expiresAt: "2025-12-31" } },
    },
  },
  {
    email: "greenleaf.landscaping@test.com",
    password: "Test1234!",
    profile: {
      businessName: "GreenLeaf Landscaping",
      businessZipCode: "90024",
      serviceZipCodes: ["90024", "90025", "90064", "90210", "90034"],
      categories: ["landscaping"],
      discoverable: true,
      overallTier: "self_verified",
      role: "vendor",
      onboardingComplete: true,
    },
    contact: { contactEmail: "greenleaf.landscaping@test.com", phone: "310-555-0202" },
    docs: {
      businessLicense: { tier: "self_verified", adminReviewed: false, extractedFields: { licenseNumber: "BL-2023-44110", expiresAt: "2025-08-20" } },
      w9: { tier: "self_verified", adminReviewed: false, extractedFields: { businessName: "GreenLeaf Landscaping Inc", ein: "XX-XXXXXXX" } },
      coi: { tier: "self_verified", adminReviewed: false, extractedFields: { insurer: "State Farm", coverageLimit: "$1,000,000", expiresAt: "2025-09-30" } },
    },
  },
  {
    email: "brightside.electrical@test.com",
    password: "Test1234!",
    profile: {
      businessName: "Brightside Electrical",
      businessZipCode: "90034",
      serviceZipCodes: ["90034", "90035", "90036", "90210", "90064"],
      categories: ["electrical"],
      discoverable: true,
      overallTier: "verified",
      role: "vendor",
      onboardingComplete: true,
    },
    contact: { contactEmail: "brightside.electrical@test.com", phone: "323-555-0303" },
    docs: {
      businessLicense: { tier: "verified", adminReviewed: true, extractedFields: { licenseNumber: "ELEC-2024-77703", expiresAt: "2026-06-01" } },
      w9: { tier: "verified", adminReviewed: true, extractedFields: { businessName: "Brightside Electrical LLC", ein: "XX-XXXXXXX" } },
      coi: { tier: "verified", adminReviewed: true, extractedFields: { insurer: "Travelers Insurance", coverageLimit: "$2,000,000", expiresAt: "2026-01-15" } },
    },
  },
  {
    email: "cooltemp.hvac@test.com",
    password: "Test1234!",
    profile: {
      businessName: "CoolTemp HVAC Services",
      businessZipCode: "90025",
      serviceZipCodes: ["90025", "90024", "90064", "90210", "90049"],
      categories: ["hvac"],
      discoverable: true,
      overallTier: "unverified",
      role: "vendor",
      onboardingComplete: true,
    },
    contact: { contactEmail: "cooltemp.hvac@test.com", phone: "310-555-0404" },
    docs: {},
  },
  {
    email: "freshcoat.painting@test.com",
    password: "Test1234!",
    profile: {
      businessName: "FreshCoat Painting Co.",
      businessZipCode: "90064",
      serviceZipCodes: ["90064", "90034", "90025", "90035", "90210"],
      categories: ["painting"],
      discoverable: true,
      overallTier: "self_verified",
      role: "vendor",
      onboardingComplete: true,
    },
    contact: { contactEmail: "freshcoat.painting@test.com", phone: "310-555-0505" },
    docs: {
      businessLicense: { tier: "self_verified", adminReviewed: false, extractedFields: { licenseNumber: "PAINT-2024-33201", expiresAt: "2025-11-30" } },
      w9: { tier: "self_verified", adminReviewed: false, extractedFields: { businessName: "FreshCoat Painting Co LLC", ein: "XX-XXXXXXX" } },
      coi: { tier: "self_verified", adminReviewed: false, extractedFields: { insurer: "Nationwide", coverageLimit: "$1,000,000", expiresAt: "2025-10-31" } },
    },
  },
  {
    email: "handyfix.pro@test.com",
    password: "Test1234!",
    profile: {
      businessName: "HandyFix Pro",
      businessZipCode: "90035",
      serviceZipCodes: ["90035", "90034", "90036", "90064", "90025"],
      categories: ["general_handyman", "painting"],
      discoverable: true,
      overallTier: "verified",
      role: "vendor",
      onboardingComplete: true,
    },
    contact: { contactEmail: "handyfix.pro@test.com", phone: "323-555-0606" },
    docs: {
      businessLicense: { tier: "verified", adminReviewed: true, extractedFields: { licenseNumber: "GC-2024-55987", expiresAt: "2026-04-30" } },
      w9: { tier: "verified", adminReviewed: true, extractedFields: { businessName: "HandyFix Pro Inc", ein: "XX-XXXXXXX" } },
      coi: { tier: "verified", adminReviewed: true, extractedFields: { insurer: "Liberty Mutual", coverageLimit: "$1,000,000", expiresAt: "2026-02-28" } },
    },
  },
];

const PMS = [
  {
    email: "sarah.pm@test.com",
    password: "Test1234!",
    profile: { displayName: "Sarah Chen", role: "property_manager" },
  },
  {
    email: "marcus.pm@test.com",
    password: "Test1234!",
    profile: { displayName: "Marcus Rivera", role: "property_manager" },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function upsertUser(email, password, displayName) {
  try {
    const existing = await auth.getUserByEmail(email);
    console.log(`  ↩  user exists: ${email} (${existing.uid})`);
    return existing.uid;
  } catch {
    const user = await auth.createUser({ email, password, displayName, emailVerified: true });
    console.log(`  ✔  created user: ${email} (${user.uid})`);
    return user.uid;
  }
}

function extractedField(value) {
  return { value: value ?? null, confidence: value ? 1 : 0 };
}

function normalizeDocData(docType, docData, businessName) {
  const source = docData.extractedFields ?? {};
  const expiresAt = source.expiresAt ?? null;
  const expirationDate =
    docType === "w9" || !expiresAt ? null : Timestamp.fromDate(new Date(expiresAt));

  const extractedFields = {
    businessLicense: {
      business_legal_name: extractedField(source.businessName ?? businessName),
      license_number: extractedField(source.licenseNumber),
      issuing_authority: extractedField(source.issuingAuthority ?? "Seeded sample"),
      issue_date: extractedField(source.issueDate ?? null),
      expiration_date: extractedField(expiresAt),
    },
    w9: {
      legal_name: extractedField(source.legalName ?? source.businessName ?? businessName),
      business_name: extractedField(source.businessName ?? businessName),
      tin_ein: extractedField(source.ein),
      address: extractedField(source.address ?? "Seeded sample"),
      signature_date: extractedField(source.signatureDate ?? "2025-01-01"),
    },
    coi: {
      insured_name: extractedField(source.insuredName ?? businessName),
      carrier: extractedField(source.insurer),
      policy_number: extractedField(source.policyNumber ?? "SEED-POLICY"),
      general_liability_limit: extractedField(source.coverageLimit),
      policy_expiration_date: extractedField(expiresAt),
      additional_insured: extractedField(source.additionalInsured ?? null),
    },
  }[docType];

  return {
    docType,
    extractedFields,
    extractionStatus: "success",
    tier: docData.tier,
    vendorConfirmed: true,
    adminReviewed: Boolean(docData.adminReviewed),
    expirationDate,
    uploadedAt: Timestamp.now(),
    lastUpdatedAt: Timestamp.now(),
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("\n── Seeding vendors ─────────────────────────────────────────");
  for (const v of VENDORS) {
    const uid = await upsertUser(v.email, v.password, v.profile.businessName);
    const createdAt = Timestamp.now();
    const publicProfile = {
      businessName: v.profile.businessName,
      businessZipCode: v.profile.businessZipCode,
      serviceZipCodes: v.profile.serviceZipCodes,
      categories: v.profile.categories,
      discoverable: v.profile.discoverable,
      overallTier: v.profile.overallTier,
      createdAt,
    };

    await db.doc(`users/${uid}`).set({
      email: v.email,
      role: "vendor",
      displayName: v.profile.businessName,
      createdAt,
    }, { merge: true });
    await db.doc(`vendors/${uid}`).set(publicProfile, { merge: true });
    await db.doc(`vendors/${uid}/private/contact`).set(v.contact, { merge: true });

    for (const [legacyDocType, docData] of Object.entries(v.docs)) {
      const docType = DOC_TYPE_ALIASES[legacyDocType];
      const normalized = normalizeDocData(docType, docData, v.profile.businessName);
      await db.doc(`vendors/${uid}/documents/${docType}`).set({
        ...normalized,
        storagePath: `vendor-docs/${uid}/${docType}/sample.pdf`,
      }, { merge: true });
    }
    console.log(`     docs: ${Object.keys(v.docs).join(", ") || "none"}`);
  }

  console.log("\n── Seeding property managers ────────────────────────────────");
  for (const pm of PMS) {
    const uid = await upsertUser(pm.email, pm.password, pm.profile.displayName);
    await db.doc(`users/${uid}`).set({
      email: pm.email,
      displayName: pm.profile.displayName,
      role: pm.profile.role,
      createdAt: Timestamp.now(),
    }, { merge: true });
    console.log(`     role: property_manager`);
  }

  console.log("\n── Done ─────────────────────────────────────────────────────\n");
}

seed().catch((e) => { console.error(e); process.exit(1); });
