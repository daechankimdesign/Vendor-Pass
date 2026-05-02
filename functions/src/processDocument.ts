import * as admin from "firebase-admin";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { defineString } from "firebase-functions/params";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";

const db = admin.firestore();
const documentAiClient = new DocumentProcessorServiceClient();

// Document AI processor IDs — set via Firebase environment params before deploy:
//   firebase functions:params:set BUSINESS_LICENSE_PROCESSOR_ID="projects/.../processors/..."
const businessLicenseProcessorId = defineString("BUSINESS_LICENSE_PROCESSOR_ID", {
  default: "",
});
const w9ProcessorId = defineString("W9_PROCESSOR_ID", { default: "" });
const coiProcessorId = defineString("COI_PROCESSOR_ID", { default: "" });

type DocType = "businessLicense" | "w9" | "coi";

const REQUIRED_FIELDS: Record<DocType, string[]> = {
  businessLicense: [
    "business_legal_name",
    "license_number",
    "issuing_authority",
    "issue_date",
    "expiration_date",
  ],
  w9: ["legal_name", "business_name", "tin_ein", "address", "signature_date"],
  coi: [
    "insured_name",
    "carrier",
    "policy_number",
    "general_liability_limit",
    "policy_expiration_date",
    "additional_insured",
  ],
};

// Storage path format: vendor-docs/{vendorUid}/{docType}/{filename}
export const processDocument = onObjectFinalized({ region: "us-east1" }, async (event) => {
  const filePath = event.data.name;
  if (!filePath) return;

  const pathMatch = filePath.match(/^vendor-docs\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!pathMatch) {
    console.log(`Skipping non-vendor-doc file: ${filePath}`);
    return;
  }

  const [, vendorUid, docType] = pathMatch;
  if (!isValidDocType(docType)) {
    console.error(`Unknown docType: ${docType}`);
    return;
  }

  const processorIds: Record<DocType, string> = {
    businessLicense: businessLicenseProcessorId.value(),
    w9: w9ProcessorId.value(),
    coi: coiProcessorId.value(),
  };
  const processorId = processorIds[docType];

  const docRef = db
    .collection("vendors")
    .doc(vendorUid)
    .collection("documents")
    .doc(docType);

  await docRef.set(
    {
      docType,
      storagePath: filePath,
      extractionStatus: "processing",
      tier: "unverified",
      vendorConfirmed: false,
      adminReviewed: false,
      expirationDate: null,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (!processorId) {
    console.warn(
      `No processor ID configured for docType=${docType}. Storing stub extraction.`
    );
    await docRef.set(
      {
        extractedFields: buildEmptyFields(docType),
        extractionStatus: "failed",
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  try {
    const bucket = admin.storage().bucket(event.data.bucket);
    const [fileBuffer] = await bucket.file(filePath).download();
    const mimeType = event.data.contentType ?? "application/octet-stream";

    const [result] = await documentAiClient.processDocument({
      name: processorId,
      rawDocument: {
        content: fileBuffer.toString("base64"),
        mimeType,
      },
    });

    const document = result.document;
    const extractedFields: Record<string, { value: string | null; confidence: number }> = {};
    let expirationDate: admin.firestore.Timestamp | null = null;
    let allFieldsFound = true;

    for (const field of REQUIRED_FIELDS[docType]) {
      const entity = document?.entities?.find(
        (e) => e.type?.toLowerCase().replace(/ /g, "_") === field
      );
      if (entity) {
        extractedFields[field] = {
          value: entity.mentionText ?? null,
          confidence: entity.confidence ?? 0,
        };
      } else {
        extractedFields[field] = { value: null, confidence: 0 };
        allFieldsFound = false;
      }
    }

    const expirationFieldName =
      docType === "coi" ? "policy_expiration_date" : "expiration_date";
    const expirationValue = extractedFields[expirationFieldName]?.value;
    if (expirationValue && docType !== "w9") {
      const parsed = Date.parse(expirationValue);
      if (!isNaN(parsed)) {
        expirationDate = admin.firestore.Timestamp.fromDate(new Date(parsed));
      }
    }

    await docRef.set(
      {
        extractedFields,
        extractionStatus: allFieldsFound ? "success" : "partial",
        expirationDate,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(
      `Extracted ${docType} for vendor ${vendorUid}: status=${allFieldsFound ? "success" : "partial"}`
    );
  } catch (err) {
    console.error(`Document AI extraction failed for ${filePath}:`, err);
    await docRef.set(
      {
        extractedFields: buildEmptyFields(docType),
        extractionStatus: "failed",
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
});

function isValidDocType(value: string): value is DocType {
  return ["businessLicense", "w9", "coi"].includes(value);
}

function buildEmptyFields(
  docType: DocType
): Record<string, { value: null; confidence: number }> {
  return Object.fromEntries(
    REQUIRED_FIELDS[docType].map((field) => [field, { value: null, confidence: 0 }])
  );
}
