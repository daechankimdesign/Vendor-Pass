import { useState } from "react";
import { Timestamp } from "firebase/firestore";
import type { DocType, VendorDocument } from "../lib/docTypes";
import { DOC_TYPE_SCHEMAS } from "../lib/docTypes";
import { confirmVendorDocument } from "../lib/firestore";

interface Props {
  vendorUid: string;
  docType: DocType;
  document: VendorDocument;
  onSaved: () => void;
}

export default function ExtractionForm({ vendorUid, docType, document, onSaved }: Props) {
  const schema = DOC_TYPE_SCHEMAS[docType];

  const [fields, setFields] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of schema.fields) {
      initial[f.key] = document.extractedFields?.[f.key]?.value ?? "";
    }
    return initial;
  });

  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredEmpty = schema.fields.filter(
    (f) => f.required && !fields[f.key]?.trim()
  );
  const canSave = confirmed && requiredEmpty.length === 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const extractedFields: Record<string, { value: string | null; confidence: number }> = {};
      for (const f of schema.fields) {
        extractedFields[f.key] = {
          value: fields[f.key]?.trim() || null,
          // Keep original confidence if unchanged, else 1.0 for manual entry
          confidence:
            fields[f.key]?.trim() === (document.extractedFields?.[f.key]?.value ?? "")
              ? (document.extractedFields?.[f.key]?.confidence ?? 1.0)
              : 1.0,
        };
      }

      // Parse expiration date for docTypes that have one
      let expirationDate: Timestamp | null = null;
      const expirationKey = docType === "coi" ? "policy_expiration_date" : "expiration_date";
      if (schema.hasExpiration) {
        const raw = fields[expirationKey]?.trim();
        if (raw) {
          const parsed = Date.parse(raw);
          if (!isNaN(parsed)) {
            expirationDate = Timestamp.fromDate(new Date(parsed));
          }
        }
      }

      await confirmVendorDocument(vendorUid, docType, extractedFields, expirationDate);
      onSaved();
    } catch (err) {
      setError("Failed to save. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-md">
      {document.extractionStatus === "partial" && (
        <div className="bg-error-container border border-error text-on-error-container rounded p-sm text-body-sm">
          Some fields could not be extracted automatically. Please fill in the empty fields below.
        </div>
      )}
      {document.extractionStatus === "failed" && (
        <div className="bg-error-container border border-error text-on-error-container rounded p-sm text-body-sm">
          Automatic extraction failed. Please fill in all fields manually.
        </div>
      )}

      <div className="space-y-sm">
        {schema.fields.map((field) => {
          const isEmpty = !fields[field.key]?.trim();
          const isRequiredEmpty = field.required && isEmpty;

          return (
            <div key={field.key}>
              <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
                {field.label}
                {field.required && <span className="text-error ml-xs">*</span>}
              </label>
              <input
                className={`input ${field.mono ? "font-mono" : ""} ${
                  isRequiredEmpty ? "input-error" : ""
                }`}
                value={fields[field.key]}
                onChange={(e) =>
                  setFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                placeholder={isEmpty ? "Required — enter value" : ""}
              />
              {isRequiredEmpty && (
                <p className="mt-xs text-body-sm text-error">This field is required.</p>
              )}
            </div>
          );
        })}
      </div>

      <label className="flex items-start gap-sm cursor-pointer">
        <input
          type="checkbox"
          className="mt-xs flex-shrink-0 accent-primary-container"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span className="text-body-md text-on-surface">
          I confirm this extracted data is accurate.
        </span>
      </label>

      {error && <p className="text-body-sm text-error">{error}</p>}

      <button
        className="btn-primary"
        onClick={handleSave}
        disabled={!canSave || saving}
      >
        {saving ? "Saving…" : "Save & Confirm"}
      </button>
    </div>
  );
}
