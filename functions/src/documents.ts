import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";

const db = admin.firestore();

type DocType = "businessLicense" | "w9" | "coi";
type VerificationTier = "unverified" | "self_verified" | "verified";

const DOC_TYPE_ORDER: DocType[] = ["businessLicense", "w9", "coi"];
const DOC_TYPES = new Set<string>(DOC_TYPE_ORDER);

interface ExtractedField {
  value: string | null;
  confidence: number;
}

interface ConfirmDocumentPayload {
  docType: DocType;
  fields: Record<string, ExtractedField>;
  expirationDate: number | string | null;
}

interface AdminPromotePayload {
  vendorUid: string;
  docType: DocType;
}

export const confirmVendorDocument = onCall(
  { invoker: "public" },
  async (request: CallableRequest<ConfirmDocumentPayload>) => {
    const vendorUid = requireAuth(request);
    const docType = requireDocType(request.data?.docType);
    const fields = sanitizeFields(request.data?.fields);
    const expirationDate = parseExpirationDate(request.data?.expirationDate);

    const docRef = db
      .collection("vendors")
      .doc(vendorUid)
      .collection("documents")
      .doc(docType);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) {
        throw new HttpsError("not-found", "Document has not been uploaded yet.");
      }

      tx.set(
        docRef,
        {
          extractedFields: fields,
          expirationDate,
          vendorConfirmed: true,
          tier: "self_verified",
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    const overallTier = await computeOverallTier(vendorUid);
    await db.collection("vendors").doc(vendorUid).update({ overallTier });

    return { overallTier };
  }
);

export const adminPromoteDocument = onCall(
  { invoker: "public" },
  async (request: CallableRequest<AdminPromotePayload>) => {
    const adminUid = requireAuth(request);
    await requireAdmin(adminUid);

    const vendorUid = requireVendorUid(request.data?.vendorUid);
    const docType = requireDocType(request.data?.docType);

    const docRef = db
      .collection("vendors")
      .doc(vendorUid)
      .collection("documents")
      .doc(docType);

    await docRef.set(
      {
        tier: "verified",
        adminReviewed: true,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const overallTier = await computeOverallTier(vendorUid);
    await db.collection("vendors").doc(vendorUid).update({ overallTier });

    return { overallTier };
  }
);

function requireAuth(request: CallableRequest<unknown>): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  return request.auth.uid;
}

async function requireAdmin(uid: string): Promise<void> {
  const snap = await db.collection("users").doc(uid).get();
  if (snap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
}

function requireVendorUid(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", "vendorUid is required.");
  }
  return value;
}

function requireDocType(value: unknown): DocType {
  if (typeof value !== "string" || !DOC_TYPES.has(value)) {
    throw new HttpsError("invalid-argument", "Invalid document type.");
  }
  return value as DocType;
}

function sanitizeFields(value: unknown): Record<string, ExtractedField> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "fields must be an object.");
  }

  const result: Record<string, ExtractedField> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new HttpsError("invalid-argument", `Invalid field payload: ${key}`);
    }
    const candidate = raw as Partial<ExtractedField>;
    const normalizedValue =
      typeof candidate.value === "string" && candidate.value.trim()
        ? candidate.value.trim()
        : null;
    const confidence =
      typeof candidate.confidence === "number" &&
      candidate.confidence >= 0 &&
      candidate.confidence <= 1
        ? candidate.confidence
        : 0;

    result[key] = {
      value: normalizedValue,
      confidence,
    };
  }
  return result;
}

function parseExpirationDate(value: unknown): admin.firestore.Timestamp | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Date.parse(value)
        : NaN;

  if (Number.isNaN(parsed)) {
    throw new HttpsError("invalid-argument", "Invalid expirationDate.");
  }
  return admin.firestore.Timestamp.fromDate(new Date(parsed));
}

async function computeOverallTier(vendorUid: string): Promise<VerificationTier> {
  const snap = await db
    .collection("vendors")
    .doc(vendorUid)
    .collection("documents")
    .get();
  const tiers: Partial<Record<DocType, VerificationTier>> = {};
  snap.forEach((doc) => {
    if (DOC_TYPES.has(doc.id)) {
      tiers[doc.id as DocType] = doc.data().tier as VerificationTier;
    }
  });

  const rank: Record<VerificationTier, number> = {
    unverified: 0,
    self_verified: 1,
    verified: 2,
  };
  let minTier: VerificationTier = "verified";

  for (const docType of DOC_TYPE_ORDER) {
    const tier = tiers[docType];
    if (!tier || !(tier in rank)) return "unverified";
    if (rank[tier] < rank[minTier]) {
      minTier = tier;
    }
  }

  return minTier;
}
