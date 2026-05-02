import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  updateVendorProfile,
  updateVendorContact,
  parseZipCodes,
} from "../lib/firestore";
import { SERVICE_CATEGORIES, getCategoryLabel } from "../lib/categories";
import type { ServiceCategory } from "../lib/categories";
import { DOC_TYPE_ORDER, DOC_TYPE_SCHEMAS } from "../lib/docTypes";
import type { DocType } from "../lib/docTypes";
import DocumentUploader from "../components/DocumentUploader";
import LiabilityFooter from "../components/LiabilityFooter";

type Step = "profile" | DocType;
const STEPS: Step[] = ["profile", ...DOC_TYPE_ORDER];

export default function Onboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("profile");

  // Profile form state
  const [businessName, setBusinessName] = useState(profile?.displayName ?? "");
  // profile.uid is guaranteed by RequireAuth + email verification
  const [phone, setPhone] = useState("");
  const [businessZip, setBusinessZip] = useState("");
  const [serviceZipsRaw, setServiceZipsRaw] = useState("");
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [discoverable, setDiscoverable] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const uid: string = user?.uid ?? "";
  if (!uid) return null;

  const currentDocIdx = STEPS.indexOf(step) - 1; // -1 for profile step
  const totalDocSteps = DOC_TYPE_ORDER.length;

  function toggleCategory(cat: ServiceCategory) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) {
      setProfileError("Business name is required.");
      return;
    }
    if (!/^\d{5}$/.test(businessZip)) {
      setProfileError("Enter a valid 5-digit business zip code.");
      return;
    }
    if (categories.length === 0) {
      setProfileError("Select at least one service category.");
      return;
    }

    const serviceZipCodes = parseZipCodes(serviceZipsRaw);
    if (serviceZipsRaw.trim() && serviceZipCodes.length === 0) {
      setProfileError("Service zip codes must be valid 5-digit zips, comma-separated.");
      return;
    }

    setProfileError(null);
    setSavingProfile(true);
    try {
      await updateVendorProfile(uid, {
        businessName: businessName.trim(),
        businessZipCode: businessZip,
        serviceZipCodes: serviceZipCodes.length ? serviceZipCodes : [businessZip],
        categories,
        discoverable,
      });
      await updateVendorContact(uid, { phone: phone.trim() });
      setStep("businessLicense");
    } catch (err) {
      setProfileError("Failed to save profile. Please try again.");
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  }

  function handleDocComplete(docType: DocType) {
    const nextIdx = DOC_TYPE_ORDER.indexOf(docType) + 1;
    if (nextIdx < DOC_TYPE_ORDER.length) {
      setStep(DOC_TYPE_ORDER[nextIdx]);
    } else {
      navigate("/vendor", { replace: true });
    }
  }

  function handleSkipDoc(docType: DocType) {
    handleDocComplete(docType);
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="page-container py-xl max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center gap-xs mb-lg">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-sm transition-colors ${
                STEPS.indexOf(step) >= i ? "bg-primary-container" : "bg-outline-variant"
              }`}
            />
          ))}
        </div>

        {step === "profile" && (
          <form onSubmit={handleProfileSave} className="space-y-md">
            <h1 className="text-display text-on-surface">Set up your profile</h1>

            <div>
              <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
                Business name <span className="text-error">*</span>
              </label>
              <input
                className="input"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
                Phone
              </label>
              <input
                type="tel"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
                Business zip code <span className="text-error">*</span>
              </label>
              <input
                className="input"
                maxLength={5}
                value={businessZip}
                onChange={(e) => setBusinessZip(e.target.value)}
                placeholder="e.g. 90210"
              />
            </div>

            <div>
              <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
                Service zip codes
              </label>
              <input
                className="input"
                value={serviceZipsRaw}
                onChange={(e) => setServiceZipsRaw(e.target.value)}
                placeholder="90210, 90211, 90212"
              />
              <p className="mt-xs text-body-sm text-on-surface-variant">
                Comma-separated 5-digit zips. Leave blank to use your business zip only.
              </p>
            </div>

            <div>
              <p className="text-label-caps uppercase text-on-surface-variant mb-sm">
                Service categories <span className="text-error">*</span>
              </p>
              <div className="grid grid-cols-2 gap-xs">
                {SERVICE_CATEGORIES.map((cat) => (
                  <label
                    key={cat}
                    className={`flex items-center gap-sm p-sm rounded border cursor-pointer text-body-md transition-colors ${
                      categories.includes(cat)
                        ? "border-primary-container bg-surface-container-low text-on-surface"
                        : "border-tier-1-border text-on-surface-variant hover:bg-surface-container-low"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={categories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="accent-primary-container"
                    />
                    {getCategoryLabel(cat)}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={discoverable}
                  onChange={(e) => setDiscoverable(e.target.checked)}
                  className="accent-primary-container"
                />
                <span className="text-body-md text-on-surface">
                  Show my business in property manager searches
                </span>
              </label>
              <p className="mt-xs ml-[calc(1rem+8px)] text-body-sm text-on-surface-variant">
                You can change this anytime from your dashboard.
              </p>
            </div>

            {profileError && <p className="text-body-sm text-error">{profileError}</p>}

            <button type="submit" className="btn-primary w-full" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save profile & continue"}
            </button>
          </form>
        )}

        {step !== "profile" && DOC_TYPE_ORDER.includes(step as DocType) && (
          <div className="space-y-md">
            <div>
              <p className="text-label-caps uppercase text-on-surface-variant mb-xs">
                Document {currentDocIdx + 1} of {totalDocSteps}
              </p>
              <h1 className="text-display text-on-surface">
                {DOC_TYPE_SCHEMAS[step as DocType].label}
              </h1>
            </div>

            <DocumentUploader
              vendorUid={uid}
              docType={step as DocType}
              onComplete={() => handleDocComplete(step as DocType)}
            />

            <button
              className="btn-tertiary text-body-sm"
              onClick={() => handleSkipDoc(step as DocType)}
            >
              Skip for now
            </button>
          </div>
        )}

        <LiabilityFooter />
      </div>
    </div>
  );
}
