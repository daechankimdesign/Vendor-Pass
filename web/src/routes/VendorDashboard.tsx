import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onSnapshot } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  vendorDocumentsCol,
  vendorDoc,
  customDocumentsCol,
  addCustomDocument,
  deleteCustomDocument,
  getVendorInvites,
  acceptInvite,
  declineInvite,
  updateVendorProfile,
  updateVendorContact,
  getVendorContact,
  getVendorProjects,
  getVendorClients,
  parseZipCodes,
} from "../lib/firestore";
import type {
  VendorPublicProfile,
  VendorPrivateContact,
  Invite,
  Project,
  CustomDocument,
} from "../lib/firestore";
import { DOC_TYPE_ORDER, DOC_TYPE_SCHEMAS } from "../lib/docTypes";
import type { VendorDocument, DocType } from "../lib/docTypes";
import TierBadge from "../components/TierBadge";
import DocumentUploader from "../components/DocumentUploader";
import ExtractionForm from "../components/ExtractionForm";
import LiabilityFooter from "../components/LiabilityFooter";
import { SERVICE_CATEGORIES, getCategoryLabel } from "../lib/categories";
import type { ServiceCategory } from "../lib/categories";

type Tab = "documents" | "projects" | "clients" | "profile";

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isExpired(ts: { seconds: number } | null | undefined): boolean {
  if (!ts) return false;
  return ts.seconds * 1000 < Date.now();
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "documents", label: "Documents", icon: "📄" },
  { id: "projects", label: "Projects", icon: "🏗️" },
  { id: "clients", label: "Clients", icon: "👥" },
  { id: "profile", label: "Profile", icon: "⚙️" },
];

function Sidebar({
  tab,
  setTab,
  profile,
  pendingCount,
  onSignOut,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  profile: VendorPublicProfile | null;
  pendingCount: number;
  onSignOut: () => void;
}) {
  return (
    <aside className="w-60 flex-shrink-0 bg-surface-container-lowest border-r border-outline-variant flex flex-col min-h-screen">
      {/* Logo */}
      <div className="px-lg py-md border-b border-outline-variant">
        <Link to="/" className="text-h2 text-on-surface font-bold block">
          VendorPass.
        </Link>
      </div>

      {/* Business info */}
      {profile && (
        <div className="px-lg py-md border-b border-outline-variant">
          <p className="text-body-md text-on-surface font-semibold truncate">
            {profile.businessName || "Your Business"}
          </p>
          <div className="mt-xs">
            <TierBadge tier={profile.overallTier} />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-sm py-md space-y-xs">
        {NAV.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`w-full flex items-center gap-sm px-md py-sm rounded text-body-md transition-colors text-left ${
              tab === id
                ? "bg-primary-container text-on-surface font-semibold"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            <span>{icon}</span>
            <span className="flex-1">{label}</span>
            {id === "projects" && pendingCount > 0 && (
              <span className="text-xs bg-error text-white rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-lg py-md border-t border-outline-variant">
        <button
          className="text-body-sm text-on-surface-variant hover:text-on-surface"
          onClick={onSignOut}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────────

function DocumentsPane({
  uid,
  docs,
  customDocs,
}: {
  uid: string;
  docs: Partial<Record<DocType, VendorDocument>>;
  customDocs: Array<CustomDocument & { id: string }>;
}) {
  const [expandedDoc, setExpandedDoc] = useState<DocType | null>(null);

  const verifiedCount = DOC_TYPE_ORDER.filter(
    (dt) => docs[dt]?.tier === "verified"
  ).length;
  const selfVerifiedCount = DOC_TYPE_ORDER.filter(
    (dt) => docs[dt]?.tier === "self_verified"
  ).length;
  const missingCount = DOC_TYPE_ORDER.filter((dt) => !docs[dt]).length;

  return (
    <div className="space-y-lg">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-md">
        <StatCard label="Verified" value={verifiedCount} accent="text-primary" />
        <StatCard label="Self-Verified" value={selfVerifiedCount} accent="text-on-surface" />
        <StatCard label="Not Uploaded" value={missingCount} accent="text-on-surface-variant" />
      </div>

      {/* Document table */}
      <div className="border border-outline-variant rounded overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-container">
            <tr>
              <Th>Document</Th>
              <Th>Status</Th>
              <Th>Expiration</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {DOC_TYPE_ORDER.map((docType) => {
              const doc = docs[docType];
              const schema = DOC_TYPE_SCHEMAS[docType];
              const expired = isExpired(doc?.expirationDate);
              const isProcessing = doc?.extractionStatus === "processing";
              const needsConfirmation = doc && !isProcessing && !doc.vendorConfirmed;
              const isExpanded = expandedDoc === docType;

              return (
                <>
                  <tr key={docType} className="bg-surface hover:bg-surface-container-low transition-colors">
                    <td className="px-md py-sm text-body-md text-on-surface font-semibold">
                      {schema.label}
                    </td>
                    <td className="px-md py-sm">
                      {doc ? (
                        <div className="space-y-xs">
                          <TierBadge tier={doc.tier} />
                          {isProcessing && (
                            <p className="text-body-sm text-on-surface-variant">Extracting…</p>
                          )}
                          {needsConfirmation && (
                            <p className="text-body-sm text-primary font-semibold">Review required</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-body-sm text-on-surface-variant">Not uploaded</span>
                      )}
                    </td>
                    <td className="px-md py-sm">
                      {schema.hasExpiration ? (
                        doc?.expirationDate ? (
                          <span
                            className={`text-body-sm font-semibold ${
                              expired ? "text-error" : "text-on-surface"
                            }`}
                          >
                            {expired && (
                              <span className="block text-xs uppercase tracking-wide text-error mb-xs">
                                Expired
                              </span>
                            )}
                            {formatDate(doc.expirationDate)}
                          </span>
                        ) : (
                          <span className="text-body-sm text-on-surface-variant">—</span>
                        )
                      ) : (
                        <span className="text-body-sm text-on-surface-variant">N/A</span>
                      )}
                    </td>
                    <td className="px-md py-sm">
                      {isProcessing ? (
                        <span className="text-body-sm text-on-surface-variant">Processing…</span>
                      ) : needsConfirmation ? (
                        <button
                          className="btn-primary text-body-sm"
                          onClick={() => setExpandedDoc(isExpanded ? null : docType)}
                        >
                          {isExpanded ? "Cancel" : "Review & Confirm"}
                        </button>
                      ) : (
                        <button
                          className="btn-tertiary text-body-sm"
                          onClick={() => setExpandedDoc(isExpanded ? null : docType)}
                        >
                          {isExpanded ? "Cancel" : doc ? "Re-upload" : "Upload"}
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Extraction review form */}
                  {isExpanded && needsConfirmation && (
                    <tr key={`${docType}-form`}>
                      <td
                        colSpan={4}
                        className="px-lg py-lg bg-surface-container-low border-t border-outline-variant"
                      >
                        <p className="text-label-caps uppercase text-on-surface-variant mb-md">
                          Review Extracted Data — {schema.label}
                        </p>
                        <ExtractionForm
                          vendorUid={uid}
                          docType={docType}
                          document={doc!}
                          onSaved={() => setExpandedDoc(null)}
                        />
                      </td>
                    </tr>
                  )}

                  {/* Upload / re-upload */}
                  {isExpanded && !needsConfirmation && (
                    <tr key={`${docType}-uploader`}>
                      <td
                        colSpan={4}
                        className="px-md py-md bg-surface-container-low border-t border-outline-variant"
                      >
                        <DocumentUploader
                          vendorUid={uid}
                          docType={docType}
                          onComplete={() => setExpandedDoc(null)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Additional / custom documents */}
      <AdditionalDocsSection uid={uid} customDocs={customDocs} />
    </div>
  );
}

// ── Additional documents section ──────────────────────────────────────────────

function AdditionalDocsSection({
  uid,
  customDocs,
}: {
  uid: string;
  customDocs: Array<CustomDocument & { id: string }>;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <section className="space-y-md">
      <div className="flex items-center justify-between">
        <h2 className="text-h2 text-on-surface">Additional Documents</h2>
        <button
          className="btn-secondary text-body-sm"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancel" : "+ Add Document"}
        </button>
      </div>

      {showForm && (
        <AddCustomDocumentForm
          uid={uid}
          onSaved={() => setShowForm(false)}
        />
      )}

      {customDocs.length === 0 && !showForm ? (
        <div className="flex items-center justify-center h-24 border border-dashed border-outline-variant rounded text-body-md text-on-surface-variant">
          No additional documents yet.
        </div>
      ) : (
        customDocs.length > 0 && (
          <div className="border border-outline-variant rounded overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-container">
                <tr>
                  <Th>Name</Th>
                  <Th>Notes</Th>
                  <Th>Added</Th>
                  <Th>File</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {customDocs.map((d) => (
                  <CustomDocRow key={d.id} vendorUid={uid} doc={d} />
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  );
}

function CustomDocRow({
  vendorUid,
  doc,
}: {
  vendorUid: string;
  doc: CustomDocument & { id: string };
}) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!doc.storagePath) return;
    getDownloadURL(storageRef(storage, doc.storagePath))
      .then(setDownloadUrl)
      .catch(() => setDownloadUrl(null));
  }, [doc.storagePath]);

  async function handleDelete() {
    if (!confirm(`Delete "${doc.name}"?`)) return;
    setDeleting(true);
    await deleteCustomDocument(vendorUid, doc.id);
  }

  return (
    <tr className="bg-surface hover:bg-surface-container-low transition-colors">
      <td className="px-md py-sm text-body-md text-on-surface font-semibold">{doc.name}</td>
      <td className="px-md py-sm text-body-sm text-on-surface-variant max-w-xs truncate">
        {doc.notes || "—"}
      </td>
      <td className="px-md py-sm text-body-sm text-on-surface-variant">
        {formatDate(doc.uploadedAt as { seconds: number })}
      </td>
      <td className="px-md py-sm">
        {downloadUrl ? (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-body-sm text-primary hover:underline"
          >
            {doc.fileName}
          </a>
        ) : (
          <span className="text-body-sm text-on-surface-variant">{doc.fileName}</span>
        )}
      </td>
      <td className="px-md py-sm text-right">
        <button
          className="text-body-sm text-error hover:underline disabled:opacity-40"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </td>
    </tr>
  );
}

function AddCustomDocumentForm({
  uid,
  onSaved,
}: {
  uid: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Document name is required."); return; }
    if (!file) { setError("Please attach a file."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("File must be under 10MB."); return; }

    setError(null);
    setSaving(true);
    setProgress(0);

    const ext = file.name.split(".").pop() ?? "bin";
    const path = `vendor-docs/${uid}/custom/${Date.now()}.${ext}`;
    const sRef = storageRef(storage, path);
    const task = uploadBytesResumable(sRef, file, { contentType: file.type });

    task.on(
      "state_changed",
      (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => {
        setError("Upload failed. Please try again.");
        console.error(err);
        setSaving(false);
        setProgress(null);
      },
      async () => {
        await addCustomDocument(uid, {
          name: name.trim(),
          notes: notes.trim(),
          storagePath: path,
          fileName: file.name,
        });
        setSaving(false);
        setProgress(null);
        onSaved();
      }
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card space-y-md border border-outline-variant"
    >
      <FormField label="Document name" required>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Liability Waiver, Insurance Rider"
        />
      </FormField>

      <FormField label="Notes">
        <input
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional description"
        />
      </FormField>

      <FormField label="File" required>
        <label className="inline-flex items-center gap-sm btn-secondary cursor-pointer text-body-sm">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2v9M5 5l3-3 3 3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {file ? file.name : "Choose file"}
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </FormField>

      {progress !== null && (
        <div className="space-y-xs">
          <p className="text-body-sm text-on-surface-variant">Uploading… {progress}%</p>
          <div className="w-full bg-surface-container rounded-sm h-1">
            <div className="bg-primary-container h-1 rounded-sm transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && <p className="text-body-sm text-error">{error}</p>}

      <div className="flex gap-sm">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Uploading…" : "Save Document"}
        </button>
      </div>
    </form>
  );
}

// ── Projects tab ──────────────────────────────────────────────────────────────

function ProjectsPane({
  invites,
  projects,
  onAccept,
  onDecline,
}: {
  invites: Array<Invite & { id: string }>;
  projects: Array<Project & { id: string }>;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const pending = invites.filter((i) => i.status === "pending");

  return (
    <div className="space-y-lg">
      {/* Pending invites */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-h2 text-on-surface mb-md">
            Pending Invites
            <span className="ml-sm text-xs bg-error text-white rounded-full px-sm py-xs font-bold">
              {pending.length}
            </span>
          </h2>
          <div className="space-y-md">
            {pending.map((invite) => (
              <div key={invite.id} className="card space-y-md">
                {/* Project info */}
                <div>
                  <p className="text-label-caps uppercase text-on-surface-variant mb-xs">Project</p>
                  <p className="text-h2 text-on-surface">
                    {invite.projectName || "Unnamed Project"}
                  </p>
                  {(invite.projectAddress || invite.projectZip) && (
                    <p className="text-body-sm text-on-surface-variant mt-xs">
                      {[invite.projectAddress, invite.projectZip].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {invite.projectDescription && (
                    <p className="text-body-sm text-on-surface-variant mt-xs italic">
                      "{invite.projectDescription}"
                    </p>
                  )}
                </div>

                <div className="border-t border-outline-variant" />

                {/* PM contact info */}
                <div>
                  <p className="text-label-caps uppercase text-on-surface-variant mb-xs">From</p>
                  <p className="text-body-md text-on-surface font-semibold">
                    {invite.pmDisplayName || "A property manager"}
                  </p>
                  {invite.pmCompanyName && (
                    <p className="text-body-sm text-on-surface-variant">{invite.pmCompanyName}</p>
                  )}
                  <div className="mt-sm flex flex-wrap gap-md">
                    {invite.pmEmail && (
                      <a
                        href={`mailto:${invite.pmEmail}`}
                        className="text-body-sm text-primary hover:underline"
                      >
                        {invite.pmEmail}
                      </a>
                    )}
                    {invite.pmPhone && (
                      <a
                        href={`tel:${invite.pmPhone}`}
                        className="text-body-sm text-on-surface-variant hover:text-on-surface"
                      >
                        {invite.pmPhone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Note from PM */}
                {invite.note && (
                  <>
                    <div className="border-t border-outline-variant" />
                    <div>
                      <p className="text-label-caps uppercase text-on-surface-variant mb-xs">Note</p>
                      <p className="text-body-md text-on-surface whitespace-pre-wrap">{invite.note}</p>
                    </div>
                  </>
                )}

                {/* Attachments */}
                {invite.attachmentUrls && invite.attachmentUrls.length > 0 && (
                  <>
                    <div className="border-t border-outline-variant" />
                    <div>
                      <p className="text-label-caps uppercase text-on-surface-variant mb-sm">Attachments</p>
                      <div className="space-y-sm">
                        {invite.attachmentUrls.map((url, i) => (
                          <AttachmentPreview key={i} url={url} index={i} />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-sm pt-xs">
                  <button className="btn-primary" onClick={() => onAccept(invite.id)}>
                    Accept
                  </button>
                  <button className="btn-secondary" onClick={() => onDecline(invite.id)}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active projects */}
      <section>
        <h2 className="text-h2 text-on-surface mb-md">My Projects</h2>
        {projects.length === 0 ? (
          <div className="flex items-center justify-center h-32 border border-dashed border-outline-variant rounded text-body-md text-on-surface-variant">
            No projects yet. Projects appear after accepting an invite.
          </div>
        ) : (
          <div className="border border-outline-variant rounded overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-container">
                <tr>
                  <Th>Project</Th>
                  <Th>Address</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {projects.map((project) => (
                  <tr
                    key={project.id}
                    className="bg-surface hover:bg-surface-container-low transition-colors"
                  >
                    <td className="px-md py-sm text-body-md text-on-surface font-semibold">
                      {project.name}
                    </td>
                    <td className="px-md py-sm text-body-sm text-on-surface-variant">
                      {project.address}
                    </td>
                    <td className="px-md py-sm">
                      <span
                        className={`inline-block text-body-sm px-sm py-xs rounded font-semibold ${
                          project.status === "active"
                            ? "bg-tier-2-bg text-on-surface"
                            : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {project.status === "active" ? "Active" : "Closed"}
                      </span>
                    </td>
                    <td className="px-md py-sm text-body-sm text-on-surface-variant">
                      {formatDate(project.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Clients tab ───────────────────────────────────────────────────────────────

function ClientsPane({
  clients,
}: {
  clients: Array<{
    pmUid: string;
    displayName: string;
    email: string;
    relationship: { firstLinkedAt: { seconds: number }; workOrdersPaused: boolean };
  }>;
}) {
  return (
    <div>
      <h2 className="text-h2 text-on-surface mb-md">Property Managers</h2>
      {clients.length === 0 ? (
        <div className="flex items-center justify-center h-32 border border-dashed border-outline-variant rounded text-body-md text-on-surface-variant">
          No clients yet. They'll appear after you accept a project invite.
        </div>
      ) : (
        <div className="border border-outline-variant rounded overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-container">
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Connected Since</Th>
                <Th>Work Orders</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {clients.map((client) => (
                <tr
                  key={client.pmUid}
                  className="bg-surface hover:bg-surface-container-low transition-colors"
                >
                  <td className="px-md py-sm text-body-md text-on-surface font-semibold">
                    {client.displayName}
                  </td>
                  <td className="px-md py-sm text-body-sm text-on-surface-variant">
                    {client.email}
                  </td>
                  <td className="px-md py-sm text-body-sm text-on-surface-variant">
                    {formatDate(client.relationship.firstLinkedAt)}
                  </td>
                  <td className="px-md py-sm">
                    <span
                      className={`inline-block text-body-sm px-sm py-xs rounded font-semibold ${
                        client.relationship.workOrdersPaused
                          ? "bg-error-container text-error"
                          : "bg-tier-2-bg text-on-surface"
                      }`}
                    >
                      {client.relationship.workOrdersPaused ? "Paused" : "Active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────

function ProfilePane({
  uid,
  profile,
  contact,
}: {
  uid: string;
  profile: VendorPublicProfile;
  contact: VendorPrivateContact | null;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-md">
        <h2 className="text-h2 text-on-surface">Business Profile</h2>
        <button
          className="btn-tertiary text-body-sm"
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {editing ? (
        <ProfileEditForm
          uid={uid}
          profile={profile}
          contact={contact ?? { contactEmail: "", phone: "" }}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <div className="card space-y-sm">
          <ProfileRow label="Business name" value={profile.businessName} />
          <ProfileRow label="Business zip" value={profile.businessZipCode} />
          <ProfileRow
            label="Service zips"
            value={profile.serviceZipCodes.join(", ") || "—"}
          />
          <ProfileRow
            label="Categories"
            value={
              profile.categories.map(getCategoryLabel).join(", ") || "—"
            }
          />
          <ProfileRow
            label="Discoverable"
            value={
              profile.discoverable
                ? "Yes — visible in search"
                : "No — hidden from search"
            }
          />
          {contact && (
            <ProfileRow label="Phone" value={contact.phone || "—"} />
          )}
        </div>
      )}
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-md">
      <span className="text-label-caps uppercase text-on-surface-variant w-36 flex-shrink-0">
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
  const [serviceZipsRaw, setServiceZipsRaw] = useState(
    profile.serviceZipCodes.join(", ")
  );
  const [categories, setCategories] = useState<ServiceCategory[]>(
    profile.categories
  );
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
      <FormField label="Business name" required>
        <input
          className="input"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
        />
      </FormField>
      <FormField label="Phone">
        <input
          type="tel"
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </FormField>
      <FormField label="Business zip" required>
        <input
          className="input"
          maxLength={5}
          value={businessZip}
          onChange={(e) => setBusinessZip(e.target.value)}
        />
      </FormField>
      <FormField label="Service zip codes">
        <input
          className="input"
          value={serviceZipsRaw}
          onChange={(e) => setServiceZipsRaw(e.target.value)}
          placeholder="90210, 90211"
        />
      </FormField>
      <div>
        <p className="text-label-caps uppercase text-on-surface-variant mb-sm">
          Categories <span className="text-error">*</span>
        </p>
        <div className="grid grid-cols-2 gap-xs">
          {SERVICE_CATEGORIES.map((cat) => (
            <label
              key={cat}
              className={`flex items-center gap-sm p-sm rounded border cursor-pointer text-body-md transition-colors ${
                categories.includes(cat)
                  ? "border-primary-container bg-surface-container-low"
                  : "border-tier-1-border hover:bg-surface-container-low"
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
      <label className="flex items-center gap-sm cursor-pointer">
        <input
          type="checkbox"
          checked={discoverable}
          onChange={(e) => setDiscoverable(e.target.checked)}
          className="accent-primary-container"
        />
        <span className="text-body-md text-on-surface">Visible in search</span>
      </label>
      {error && <p className="text-body-sm text-error">{error}</p>}
      <div className="flex gap-sm">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="card text-center">
      <p className={`text-display font-bold ${accent}`}>{value}</p>
      <p className="text-label-caps uppercase text-on-surface-variant mt-xs">
        {label}
      </p>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-md py-sm text-label-caps uppercase text-on-surface-variant text-left font-semibold">
      {children}
    </th>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
        {label}
        {required && <span className="text-error ml-xs">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export default function VendorDashboard() {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();
  const uid = user?.uid ?? "";

  const [tab, setTab] = useState<Tab>("documents");
  const [docs, setDocs] = useState<Partial<Record<DocType, VendorDocument>>>({});
  const [customDocs, setCustomDocs] = useState<Array<CustomDocument & { id: string }>>([]);
  const [profile, setProfile] = useState<VendorPublicProfile | null>(null);
  const [contact, setContact] = useState<VendorPrivateContact | null>(null);
  const [invites, setInvites] = useState<Array<Invite & { id: string }>>([]);
  const [projects, setProjects] = useState<Array<Project & { id: string }>>([]);
  const [clients, setClients] = useState<
    Array<{
      pmUid: string;
      displayName: string;
      email: string;
      relationship: { firstLinkedAt: { seconds: number }; workOrdersPaused: boolean };
    }>
  >([]);

  // Live doc statuses
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(vendorDocumentsCol(uid), (snap) => {
      const next: Partial<Record<DocType, VendorDocument>> = {};
      snap.forEach((d) => {
        next[d.id as DocType] = d.data() as VendorDocument;
      });
      setDocs(next);
    });
  }, [uid]);

  // Live custom documents
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(customDocumentsCol(uid), (snap) => {
      setCustomDocs(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as CustomDocument) }))
      );
    });
  }, [uid]);

  // Live profile
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(vendorDoc(uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as VendorPublicProfile);
    });
  }, [uid]);

  // Contact, invites, projects, clients
  useEffect(() => {
    if (!uid) return;
    getVendorContact(uid).then(setContact);
    getVendorInvites(uid).then(setInvites);
    getVendorProjects(uid).then(setProjects);
    getVendorClients(uid).then(
      (c) =>
        setClients(
          c as Array<{
            pmUid: string;
            displayName: string;
            email: string;
            relationship: { firstLinkedAt: { seconds: number }; workOrdersPaused: boolean };
          }>
        )
    );
  }, [uid]);

  async function handleAccept(inviteId: string) {
    await acceptInvite(inviteId, uid);
    setInvites((prev) =>
      prev.map((i) => (i.id === inviteId ? { ...i, status: "accepted" } : i))
    );
    getVendorProjects(uid).then(setProjects);
    getVendorClients(uid).then(
      (c) =>
        setClients(
          c as Array<{
            pmUid: string;
            displayName: string;
            email: string;
            relationship: { firstLinkedAt: { seconds: number }; workOrdersPaused: boolean };
          }>
        )
    );
  }

  async function handleDecline(inviteId: string) {
    await declineInvite(inviteId);
    setInvites((prev) =>
      prev.map((i) => (i.id === inviteId ? { ...i, status: "declined" } : i))
    );
  }

  async function handleSignOut() {
    await logOut();
    navigate("/login", { replace: true });
  }

  const pendingCount = invites.filter((i) => i.status === "pending").length;

  const TAB_TITLES: Record<Tab, string> = {
    documents: "Compliance Documents",
    projects: "My Projects",
    clients: "Property Managers",
    profile: "Business Profile",
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar
        tab={tab}
        setTab={setTab}
        profile={profile}
        pendingCount={pendingCount}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Page header */}
        <header className="border-b border-outline-variant bg-surface-container-lowest px-xl py-md flex items-center justify-between">
          <div>
            <p className="text-body-sm text-on-surface-variant">
              VendorPass → {TAB_TITLES[tab]}
            </p>
            <h1 className="text-h1 text-on-surface">{TAB_TITLES[tab]}</h1>
          </div>
        </header>

        {/* Tab content */}
        <main className="flex-1 px-xl py-lg max-w-5xl w-full">
          {tab === "documents" && <DocumentsPane uid={uid} docs={docs} customDocs={customDocs} />}

          {tab === "projects" && (
            <ProjectsPane
              invites={invites}
              projects={projects}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          )}

          {tab === "clients" && <ClientsPane clients={clients} />}

          {tab === "profile" && profile && (
            <ProfilePane uid={uid} profile={profile} contact={contact} />
          )}

          <LiabilityFooter />
        </main>
      </div>
    </div>
  );
}

function extractFilename(url: string, fallback: string): string {
  try {
    // Firebase Storage URLs: …/o/path%2Fencoded%2Ffilename.ext?alt=media…
    const oSegment = url.split("/o/")[1];
    if (oSegment) {
      const decoded = decodeURIComponent(oSegment.split("?")[0]);
      const base = decoded.split("/").pop() ?? "";
      return base.replace(/^\d+_/, "") || fallback;
    }
  } catch { /* fall through */ }
  return fallback;
}

const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|svg)$/i;

function AttachmentPreview({ url, index }: { url: string; index: number }) {
  const filename = extractFilename(url, `File ${index + 1}`);
  const isImage = IMAGE_EXTS.test(filename);

  if (isImage) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
        aria-label={filename}
      >
        <img
          src={url}
          alt={filename}
          className="max-h-48 rounded border border-outline-variant object-cover group-hover:opacity-90 transition-opacity"
        />
        <p className="text-body-sm text-on-surface-variant mt-xs">{filename}</p>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-xs text-body-sm text-primary hover:underline"
    >
      <PaperclipIcon />
      {filename}
    </a>
  );
}

function PaperclipIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M11 5.5L6 10.5A3 3 0 012 6.5L7.5 1A1.75 1.75 0 0110 3.5L4.5 9A.5.5 0 014 8.5l5-5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
