import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onSnapshot } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import {
  vendorDocumentsCol,
  vendorDoc,
  getVendorInvites,
  acceptInvite,
  declineInvite,
  updateVendorProfile,
  updateVendorContact,
  getVendorContact,
  parseZipCodes,
} from "../lib/firestore";
import type { VendorPublicProfile, VendorPrivateContact, Invite } from "../lib/firestore";
import { DOC_TYPE_ORDER, DOC_TYPE_SCHEMAS } from "../lib/docTypes";
import type { VendorDocument, DocType } from "../lib/docTypes";
import TierBadge from "../components/TierBadge";
import DocumentUploader from "../components/DocumentUploader";
import LiabilityFooter from "../components/LiabilityFooter";
import { SERVICE_CATEGORIES, getCategoryLabel } from "../lib/categories";
import type { ServiceCategory } from "../lib/categories";

export default function VendorDashboard() {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();
  const uid = user?.uid ?? "";

  const [docs, setDocs] = useState<Partial<Record<DocType, VendorDocument>>>({});
  const [profile, setProfile] = useState<VendorPublicProfile | null>(null);
  const [contact, setContact] = useState<VendorPrivateContact | null>(null);
  const [invites, setInvites] = useState<Array<Invite & { id: string }>>([]);
  const [editingDoc, setEditingDoc] = useState<DocType | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  // Live doc statuses
  useEffect(() => {
    if (!uid) return;
    const unsubscribe = onSnapshot(vendorDocumentsCol(uid), (snap) => {
      const next: Partial<Record<DocType, VendorDocument>> = {};
      snap.forEach((d) => { next[d.id as DocType] = d.data() as VendorDocument; });
      setDocs(next);
    });
    return unsubscribe;
  }, [uid]);

  // Profile + invites
  useEffect(() => {
    if (!uid) return;
    const unsubProfile = onSnapshot(vendorDoc(uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as VendorPublicProfile);
    });
    getVendorContact(uid).then(setContact);
    getVendorInvites(uid).then(setInvites);
    return unsubProfile;
  }, [uid]);

  async function handleAccept(inviteId: string) {
    await acceptInvite(inviteId, uid);
    setInvites((prev) => prev.map((i) => i.id === inviteId ? { ...i, status: "accepted" } : i));
  }

  async function handleDecline(inviteId: string) {
    await declineInvite(inviteId);
    setInvites((prev) => prev.map((i) => i.id === inviteId ? { ...i, status: "declined" } : i));
  }

  async function handleSignOut() {
    await logOut();
    navigate("/login", { replace: true });
  }

  const pendingInvites = invites.filter((i) => i.status === "pending");

  return (
    <div className="min-h-screen bg-surface">
      {/* Nav */}
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="page-container flex items-center justify-between h-14">
          <span className="text-h2 text-on-surface">Compliance Roster.</span>
          <button className="btn-tertiary text-body-sm" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="page-container py-lg max-w-3xl space-y-lg">
        {/* Documents section */}
        <section>
          <h2 className="text-h1 text-on-surface mb-md">Compliance Documents</h2>
          <div className="space-y-sm">
            {DOC_TYPE_ORDER.map((docType) => {
              const doc = docs[docType];
              return (
                <div key={docType} className="card">
                  <div className="flex items-center justify-between gap-md">
                    <div className="flex items-center gap-sm">
                      <span className="text-body-md text-on-surface font-semibold">
                        {DOC_TYPE_SCHEMAS[docType].label}
                      </span>
                      {doc ? (
                        <TierBadge tier={doc.tier} />
                      ) : (
                        <span className="text-body-sm text-on-surface-variant">Not uploaded</span>
                      )}
                    </div>
                    <button
                      className="btn-tertiary text-body-sm"
                      onClick={() => setEditingDoc(editingDoc === docType ? null : docType)}
                    >
                      {editingDoc === docType ? "Cancel" : doc ? "Re-upload" : "Upload"}
                    </button>
                  </div>

                  {editingDoc === docType && (
                    <div className="mt-md pt-md border-t border-tier-1-border">
                      <DocumentUploader
                        vendorUid={uid}
                        docType={docType}
                        onComplete={() => setEditingDoc(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <section>
            <h2 className="text-h1 text-on-surface mb-md">Project Invites</h2>
            <div className="space-y-sm">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="card flex items-center justify-between gap-md">
                  <div>
                    <p className="text-body-md text-on-surface">Project invite</p>
                    <p className="text-body-sm text-on-surface-variant">
                      Sent to {invite.vendorEmail}
                    </p>
                  </div>
                  <div className="flex gap-sm">
                    <button
                      className="btn-primary"
                      onClick={() => handleAccept(invite.id)}
                    >
                      Accept
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleDecline(invite.id)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Profile summary */}
        <section>
          <div className="flex items-center justify-between mb-md">
            <h2 className="text-h1 text-on-surface">Profile</h2>
            <button
              className="btn-tertiary text-body-sm"
              onClick={() => setEditingProfile(!editingProfile)}
            >
              {editingProfile ? "Cancel" : "Edit"}
            </button>
          </div>

          {editingProfile && profile && contact !== null ? (
            <ProfileEditForm
              uid={uid}
              profile={profile}
              contact={contact}
              onSaved={() => setEditingProfile(false)}
            />
          ) : profile ? (
            <div className="card space-y-sm">
              <Row label="Business name" value={profile.businessName} />
              <Row label="Business zip" value={profile.businessZipCode} />
              <Row label="Service zips" value={profile.serviceZipCodes.join(", ") || "—"} />
              <Row
                label="Categories"
                value={profile.categories.map(getCategoryLabel).join(", ") || "—"}
              />
              <Row
                label="Discoverable"
                value={profile.discoverable ? "Yes — visible in search" : "No — hidden from search"}
              />
              {contact && <Row label="Phone" value={contact.phone || "—"} />}
            </div>
          ) : null}
        </section>

        <LiabilityFooter />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-md">
      <span className="text-label-caps uppercase text-on-surface-variant w-32 flex-shrink-0">
        {label}
      </span>
      <span className="text-body-md text-on-surface">{value}</span>
    </div>
  );
}

function ProfileEditForm({
  uid,
  profile,
  contact,
  onSaved,
}: {
  uid: string;
  profile: VendorPublicProfile;
  contact: VendorPrivateContact;
  onSaved: () => void;
}) {
  const [businessName, setBusinessName] = useState(profile.businessName);
  const [phone, setPhone] = useState(contact.phone);
  const [businessZip, setBusinessZip] = useState(profile.businessZipCode);
  const [serviceZipsRaw, setServiceZipsRaw] = useState(profile.serviceZipCodes.join(", "));
  const [categories, setCategories] = useState<ServiceCategory[]>(profile.categories);
  const [discoverable, setDiscoverable] = useState(profile.discoverable);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleCategory(cat: ServiceCategory) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) { setError("Business name is required."); return; }
    if (!/^\d{5}$/.test(businessZip)) { setError("Invalid business zip."); return; }
    if (categories.length === 0) { setError("Select at least one category."); return; }
    const serviceZipCodes = parseZipCodes(serviceZipsRaw);
    setSaving(true);
    setError(null);
    try {
      await updateVendorProfile(uid, {
        businessName: businessName.trim(),
        businessZipCode: businessZip,
        serviceZipCodes: serviceZipCodes.length ? serviceZipCodes : [businessZip],
        categories,
        discoverable,
      });
      await updateVendorContact(uid, { phone: phone.trim() });
      onSaved();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="card space-y-md">
      <Field label="Business name" required>
        <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
      </Field>
      <Field label="Phone">
        <input type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Business zip" required>
        <input className="input" maxLength={5} value={businessZip} onChange={(e) => setBusinessZip(e.target.value)} />
      </Field>
      <Field label="Service zip codes">
        <input className="input" value={serviceZipsRaw} onChange={(e) => setServiceZipsRaw(e.target.value)} placeholder="90210, 90211" />
      </Field>
      <div>
        <p className="text-label-caps uppercase text-on-surface-variant mb-sm">
          Categories <span className="text-error">*</span>
        </p>
        <div className="grid grid-cols-2 gap-xs">
          {SERVICE_CATEGORIES.map((cat) => (
            <label key={cat} className={`flex items-center gap-sm p-sm rounded border cursor-pointer text-body-md transition-colors ${categories.includes(cat) ? "border-primary-container bg-surface-container-low" : "border-tier-1-border hover:bg-surface-container-low"}`}>
              <input type="checkbox" checked={categories.includes(cat)} onChange={() => toggleCategory(cat)} className="accent-primary-container" />
              {getCategoryLabel(cat)}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-sm cursor-pointer">
        <input type="checkbox" checked={discoverable} onChange={(e) => setDiscoverable(e.target.checked)} className="accent-primary-container" />
        <span className="text-body-md text-on-surface">Visible in search</span>
      </label>
      {error && <p className="text-body-sm text-error">{error}</p>}
      <div className="flex gap-sm">
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
        {label}{required && <span className="text-error ml-xs">*</span>}
      </label>
      {children}
    </div>
  );
}
