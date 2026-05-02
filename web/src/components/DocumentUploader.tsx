import { useEffect, useState } from "react";
import { ref, uploadBytesResumable } from "firebase/storage";
import { onSnapshot } from "firebase/firestore";
import { storage } from "../firebase";
import { vendorDocumentDoc } from "../lib/firestore";
import type { DocType, VendorDocument } from "../lib/docTypes";
import { DOC_TYPE_SCHEMAS } from "../lib/docTypes";
import TierBadge from "./TierBadge";
import ExtractionForm from "./ExtractionForm";

interface Props {
  vendorUid: string;
  docType: DocType;
  onComplete?: () => void;
}

const ACCEPTED_TYPES = "image/*,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

export default function DocumentUploader({ vendorUid, docType, onComplete }: Props) {
  const schema = DOC_TYPE_SCHEMAS[docType];
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [document, setDocument] = useState<VendorDocument | null>(null);

  // Always listen — picks up any existing doc and Cloud Function extraction results
  useEffect(() => {
    const unsubscribe = onSnapshot(vendorDocumentDoc(vendorUid, docType), (snap) => {
      setDocument(snap.exists() ? (snap.data() as VendorDocument) : null);
    });
    return unsubscribe;
  }, [vendorUid, docType]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setUploadError("File size must be under 10MB.");
      return;
    }

    setUploadError(null);
    setUploading(true);
    setUploadProgress(0);

    const ext = file.name.split(".").pop() ?? "bin";
    const storagePath = `vendor-docs/${vendorUid}/${docType}/${Date.now()}.${ext}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type });

    uploadTask.on(
      "state_changed",
      (snap) => {
        setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      (err) => {
        setUploadError("Upload failed. Please try again.");
        console.error("Upload error:", err);
        setUploading(false);
        setUploadProgress(null);
      },
      () => {
        setUploading(false);
        setUploadProgress(null);
        // Firestore listener will pick up the Cloud Function's extraction result
      }
    );
  }

  // Show confirmed state
  if (document?.vendorConfirmed) {
    return (
      <div className="space-y-sm">
        <div className="flex items-center gap-sm">
          <TierBadge tier={document.tier} />
          <span className="text-body-md text-on-surface">Confirmed</span>
        </div>
        <label className="btn-tertiary text-body-sm cursor-pointer">
          Re-upload
          <input
            type="file"
            className="sr-only"
            accept={ACCEPTED_TYPES}
            capture="environment"
            onChange={handleFileChange}
          />
        </label>
      </div>
    );
  }

  // Show extraction form once extraction is done
  if (
    document &&
    (document.extractionStatus === "success" ||
      document.extractionStatus === "partial" ||
      document.extractionStatus === "failed")
  ) {
    return (
      <ExtractionForm
        vendorUid={vendorUid}
        docType={docType}
        document={document}
        onSaved={() => onComplete?.()}
      />
    );
  }

  // Show processing state
  if (uploading || document?.extractionStatus === "processing") {
    return (
      <div className="space-y-sm">
        {uploading && uploadProgress !== null ? (
          <>
            <p className="text-body-sm text-on-surface-variant">Uploading… {uploadProgress}%</p>
            <div className="w-full bg-surface-container rounded-sm h-1">
              <div
                className="bg-primary-container h-1 rounded-sm transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-body-sm text-on-surface-variant">
            Extracting data from document…
          </p>
        )}
      </div>
    );
  }

  // Default: file upload UI
  return (
    <div className="space-y-sm">
      <p className="text-body-sm text-on-surface-variant">
        Upload your {schema.label} (PDF or image, max 10MB).
      </p>

      {uploadError && <p className="text-body-sm text-error">{uploadError}</p>}

      <label className="inline-flex items-center gap-sm btn-secondary cursor-pointer">
        <UploadIcon />
        Choose file
        <input
          type="file"
          className="sr-only"
          accept={ACCEPTED_TYPES}
          capture="environment"
          onChange={handleFileChange}
        />
      </label>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2v9M5 5l3-3 3 3M3 13h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
