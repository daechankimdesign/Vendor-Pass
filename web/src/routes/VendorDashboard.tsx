import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Menu, ChevronDown, MessageSquare, Paperclip, Upload, X,
  FileText, Building2, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { onSnapshot, getDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  vendorDocumentsCol,
  vendorDoc,
  pmRelationshipsCol,
  userDoc,
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
  updateVendorProjectStatus,
  dropProject,
  parseZipCodes,
} from "../lib/firestore";
import type {
  VendorPublicProfile,
  VendorPrivateContact,
  Invite,
  Project,
  PmRelationship,
  VendorProjectStatus,
  CustomDocument,
} from "../lib/firestore";
import { DOC_TYPE_ORDER, DOC_TYPE_SCHEMAS } from "../lib/docTypes";
import type { VendorDocument, DocType } from "../lib/docTypes";
import TierBadge from "../components/TierBadge";
import DocumentUploader from "../components/DocumentUploader";
import ExtractionForm from "../components/ExtractionForm";
import LiabilityFooter from "../components/LiabilityFooter";
import MessagesTab from "../components/MessagesTab";
import { SERVICE_CATEGORIES, getCategoryLabel } from "../lib/categories";
import type { ServiceCategory } from "../lib/categories";

type Tab = "documents" | "projects" | "clients" | "messages";

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

const NAV: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "documents", label: "Profile & Documents", Icon: FileText },
  { id: "projects", label: "Projects", Icon: Building2 },
  { id: "clients", label: "Clients", Icon: Users },
  { id: "messages", label: "Messages", Icon: MessageSquare },
];

function Sidebar({
  tab,
  setTab,
  profile,
  pendingCount,
  onSignOut,
  mobileOpen,
  onMobileClose,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  profile: VendorPublicProfile | null;
  pendingCount: number;
  onSignOut: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed sm:static top-0 left-0 h-screen sm:min-h-screen z-50
          w-64 flex-shrink-0 bg-surface-container-lowest border-r border-outline-variant
          flex flex-col overflow-y-auto
          transition-transform duration-200 ease-in-out sm:transition-none sm:translate-x-0
          ${mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
        `}
      >
        {/* Logo + mobile close */}
        <div className="px-lg py-md border-b border-outline-variant flex items-center justify-between">
          <Link to="/" className="text-h2 text-on-surface font-bold">
            VendorPass.
          </Link>
          <button
            className="sm:hidden p-xs text-on-surface-variant hover:text-on-surface"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X size={20} aria-hidden />
          </button>
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
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); onMobileClose(); }}
              className={`w-full flex items-center gap-sm px-md py-sm rounded text-body-md transition-colors text-left ${
                tab === id
                  ? "bg-primary-fixed text-on-primary-fixed font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              <Icon size={16} aria-hidden />
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
    </>
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

  const verifiedCount = DOC_TYPE_ORDER.filter((dt) => docs[dt]?.tier === "verified").length;
  const selfVerifiedCount = DOC_TYPE_ORDER.filter((dt) => docs[dt]?.tier === "self_verified").length;
  const missingCount = DOC_TYPE_ORDER.filter((dt) => !docs[dt]).length;

  return (
    <div className="space-y-lg">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-sm sm:gap-md">
        <StatCard label="Verified" value={verifiedCount} accent="text-primary" />
        <StatCard label="Self-Verified" value={selfVerifiedCount} accent="text-on-surface" />
        <StatCard label="Not Uploaded" value={missingCount} accent="text-on-surface-variant" />
      </div>

      {/* ── Mobile card list ── */}
      <div className="sm:hidden space-y-sm">
        {DOC_TYPE_ORDER.map((docType) => {
          const doc = docs[docType];
          const schema = DOC_TYPE_SCHEMAS[docType];
          const expired = isExpired(doc?.expirationDate);
          const isProcessing = doc?.extractionStatus === "processing";
          const needsConfirmation = doc && !isProcessing && !doc.vendorConfirmed;
          const isExpanded = expandedDoc === docType;

          return (
            <div key={docType} className="border border-outline-variant rounded bg-surface">
              <div className="p-md flex items-start justify-between gap-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-body-md text-on-surface font-semibold">{schema.label}</p>
                  <div className="mt-xs flex flex-wrap gap-xs items-center">
                    {doc ? (
                      <>
                        <TierBadge tier={doc.tier} />
                        {isProcessing && (
                          <span className="text-body-sm text-on-surface-variant">Extracting…</span>
                        )}
                        {needsConfirmation && (
                          <span className="text-body-sm text-primary font-semibold">Review required</span>
                        )}
                        {schema.hasExpiration && doc.expirationDate && (
                          <span className={`text-body-sm ${expired ? "text-error font-semibold" : "text-on-surface-variant"}`}>
                            {expired ? "Expired · " : "Exp. "}
                            {formatDate(doc.expirationDate)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-body-sm text-on-surface-variant">Not uploaded</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {isProcessing ? (
                    <span className="text-body-sm text-on-surface-variant">Processing…</span>
                  ) : needsConfirmation ? (
                    <button
                      className="btn-primary text-body-sm"
                      onClick={() => setExpandedDoc(isExpanded ? null : docType)}
                    >
                      {isExpanded ? "Cancel" : "Review"}
                    </button>
                  ) : (
                    <button
                      className="btn-tertiary text-body-sm"
                      onClick={() => setExpandedDoc(isExpanded ? null : docType)}
                    >
                      {isExpanded ? "Cancel" : doc ? "Re-upload" : "Upload"}
                    </button>
                  )}
                </div>
              </div>
              {isExpanded && needsConfirmation && (
                <div className="px-md pb-md pt-sm border-t border-outline-variant bg-surface-container-low">
                  <p className="text-label-caps uppercase text-on-surface-variant mb-md">
                    Review Extracted Data — {schema.label}
                  </p>
                  <ExtractionForm
                    vendorUid={uid}
                    docType={docType}
                    document={doc!}
                    onSaved={() => setExpandedDoc(null)}
                  />
                </div>
              )}
              {isExpanded && !needsConfirmation && (
                <div className="px-md pb-md pt-sm border-t border-outline-variant bg-surface-container-low">
                  <DocumentUploader
                    vendorUid={uid}
                    docType={docType}
                    onComplete={() => setExpandedDoc(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden sm:block border border-outline-variant rounded overflow-hidden">
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
                          <span className={`text-body-sm font-semibold ${expired ? "text-error" : "text-on-surface"}`}>
                            {expired && (
                              <span className="block text-xs uppercase tracking-wide text-error mb-xs">Expired</span>
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

                  {isExpanded && needsConfirmation && (
                    <tr key={`${docType}-form`}>
                      <td colSpan={4} className="px-lg py-lg bg-surface-container-low border-t border-outline-variant">
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

                  {isExpanded && !needsConfirmation && (
                    <tr key={`${docType}-uploader`}>
                      <td colSpan={4} className="px-md py-md bg-surface-container-low border-t border-outline-variant">
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

      {showForm && <AddCustomDocumentForm uid={uid} onSaved={() => setShowForm(false)} />}

      {customDocs.length === 0 && !showForm ? (
        <div className="flex items-center justify-center h-24 border border-dashed border-outline-variant rounded text-body-md text-on-surface-variant">
          No additional documents yet.
        </div>
      ) : (
        customDocs.length > 0 && (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden space-y-sm">
              {customDocs.map((d) => (
                <CustomDocCard key={d.id} vendorUid={uid} doc={d} />
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block border border-outline-variant rounded overflow-hidden">
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
          </>
        )
      )}
    </section>
  );
}

function useCustomDocUrl(storagePath: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!storagePath) return;
    getDownloadURL(storageRef(storage, storagePath))
      .then(setUrl)
      .catch(() => setUrl(null));
  }, [storagePath]);
  return url;
}

function CustomDocCard({
  vendorUid,
  doc,
}: {
  vendorUid: string;
  doc: CustomDocument & { id: string };
}) {
  const downloadUrl = useCustomDocUrl(doc.storagePath);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${doc.name}"?`)) return;
    setDeleting(true);
    await deleteCustomDocument(vendorUid, doc.id);
  }

  return (
    <div className="border border-outline-variant rounded bg-surface p-md space-y-xs">
      <div className="flex items-start justify-between gap-sm">
        <p className="text-body-md text-on-surface font-semibold">{doc.name}</p>
        <button
          className="text-body-sm text-error hover:underline disabled:opacity-40 flex-shrink-0"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
      {doc.notes && <p className="text-body-sm text-on-surface-variant">{doc.notes}</p>}
      <div className="flex items-center justify-between gap-sm">
        <span className="text-body-sm text-on-surface-variant">
          Added {formatDate(doc.uploadedAt as { seconds: number })}
        </span>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-body-sm text-primary hover:underline truncate max-w-[160px]"
          >
            {doc.fileName}
          </a>
        ) : (
          <span className="text-body-sm text-on-surface-variant truncate max-w-[160px]">
            {doc.fileName}
          </span>
        )}
      </div>
    </div>
  );
}

function CustomDocRow({
  vendorUid,
  doc,
}: {
  vendorUid: string;
  doc: CustomDocument & { id: string };
}) {
  const downloadUrl = useCustomDocUrl(doc.storagePath);
  const [deleting, setDeleting] = useState(false);

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
    <form onSubmit={handleSubmit} className="card space-y-md border border-outline-variant">
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
          <Upload size={16} aria-hidden />
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
  onDrop,
  onStatusChange,
  onOpenChat,
}: {
  invites: Array<Invite & { id: string }>;
  projects: Array<Project & { id: string; inviteId: string; vendorStatus: VendorProjectStatus }>;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onDrop: (projectId: string, inviteId: string) => Promise<void>;
  onStatusChange: (projectId: string, status: VendorProjectStatus) => Promise<void>;
  onOpenChat: (projectId: string) => void;
}) {
  const pending = invites.filter((i) => i.status === "pending");

  return (
    <div className="space-y-lg">
      {/* Pending quote requests */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-h2 text-on-surface mb-md">
            Quote Requests
            <span className="ml-sm text-xs bg-error text-white rounded-full px-sm py-xs font-bold">
              {pending.length}
            </span>
          </h2>
          <div className="space-y-md">
            {pending.map((invite) => (
              <div key={invite.id} className="card space-y-md">
                <div>
                  <p className="text-label-caps uppercase text-on-surface-variant mb-xs">Project</p>
                  <p className="text-h2 text-on-surface">{invite.projectName || "Unnamed Project"}</p>
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

                <div>
                  <p className="text-label-caps uppercase text-on-surface-variant mb-xs">Requested by</p>
                  <p className="text-body-md text-on-surface font-semibold">
                    {invite.pmDisplayName || "A property manager"}
                  </p>
                  {invite.pmCompanyName && (
                    <p className="text-body-sm text-on-surface-variant">{invite.pmCompanyName}</p>
                  )}
                  <div className="mt-sm flex flex-wrap gap-md">
                    {invite.pmEmail && (
                      <a href={`mailto:${invite.pmEmail}`} className="text-body-sm text-primary hover:underline">
                        {invite.pmEmail}
                      </a>
                    )}
                    {invite.pmPhone && (
                      <a href={`tel:${invite.pmPhone}`} className="text-body-sm text-on-surface-variant hover:text-on-surface">
                        {invite.pmPhone}
                      </a>
                    )}
                  </div>
                </div>

                {invite.note && (
                  <>
                    <div className="border-t border-outline-variant" />
                    <div>
                      <p className="text-label-caps uppercase text-on-surface-variant mb-xs">Note</p>
                      <p className="text-body-md text-on-surface whitespace-pre-wrap">{invite.note}</p>
                    </div>
                  </>
                )}

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

                <div className="flex gap-sm pt-xs flex-wrap">
                  <button className="btn-primary" onClick={() => onAccept(invite.id)}>Accept</button>
                  <button className="btn-secondary" onClick={() => onDecline(invite.id)}>Decline</button>
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
          <div className="flex items-center justify-center h-32 border border-dashed border-outline-variant rounded text-body-md text-on-surface-variant text-center px-md">
            No projects yet. Projects appear after accepting a quote request.
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden space-y-sm">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDrop={onDrop}
                  onStatusChange={onStatusChange}
                  onOpenChat={onOpenChat}
                />
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block border border-outline-variant rounded overflow-hidden">
              <table className="w-full">
                <thead className="bg-surface-container">
                  <tr>
                    <Th>Project</Th>
                    <Th>Address</Th>
                    <Th>Project Status</Th>
                    <Th>My Status</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {projects.map((project) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      onDrop={onDrop}
                      onStatusChange={onStatusChange}
                      onOpenChat={onOpenChat}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

const VENDOR_STATUS_OPTIONS: { value: VendorProjectStatus; label: string; classes: string }[] = [
  { value: "active", label: "Active", classes: "bg-green-100 text-green-800" },
  { value: "on_hold", label: "On Hold", classes: "bg-yellow-100 text-yellow-800" },
  { value: "completed", label: "Completed", classes: "bg-surface-container text-on-surface-variant" },
];

function ChevronIcon({ open }: { open: boolean }) {
  return <ChevronDown size={16} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />;
}

// Mobile project card
function ProjectCard({
  project,
  onDrop,
  onStatusChange,
  onOpenChat,
}: {
  project: Project & { id: string; inviteId: string; vendorStatus: VendorProjectStatus };
  onDrop: (projectId: string, inviteId: string) => Promise<void>;
  onStatusChange: (projectId: string, status: VendorProjectStatus) => Promise<void>;
  onOpenChat: (projectId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const statusOption = VENDOR_STATUS_OPTIONS.find((o) => o.value === project.vendorStatus)
    ?? VENDOR_STATUS_OPTIONS[0];

  async function handleDrop() {
    setDropping(true);
    await onDrop(project.id, project.inviteId);
    setDropping(false);
    setShowConfirm(false);
  }

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setUpdatingStatus(true);
    await onStatusChange(project.id, e.target.value as VendorProjectStatus);
    setUpdatingStatus(false);
  }

  return (
    <div className="border border-outline-variant rounded bg-surface">
      {/* Card header */}
      <button
        className="w-full p-md flex items-center justify-between gap-sm text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-body-md text-on-surface font-semibold truncate">{project.name}</p>
          {project.address && (
            <p className="text-body-sm text-on-surface-variant truncate">{project.address}</p>
          )}
        </div>
        <ChevronIcon open={expanded} />
      </button>

      {/* Status row */}
      <div className="px-md pb-md flex items-center gap-sm flex-wrap" onClick={(e) => e.stopPropagation()}>
        {/* Project status pill */}
        <span className={`inline-block text-body-sm px-sm py-xs rounded font-semibold ${
          project.status === "active" ? "bg-green-100 text-green-800" : "bg-surface-container text-on-surface-variant"
        }`}>
          {project.status === "active" ? "Active" : "Closed"}
        </span>

        {/* My status select */}
        <select
          value={project.vendorStatus}
          onChange={handleStatusChange}
          disabled={updatingStatus}
          className={`text-body-sm px-sm py-xs rounded font-semibold border-0 cursor-pointer ${statusOption.classes} disabled:opacity-60`}
        >
          {VENDOR_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button
          className="text-on-surface-variant hover:text-primary p-xs rounded transition-colors"
          onClick={() => onOpenChat(project.id)}
          title="Open chat"
          aria-label="Open project chat"
        >
          <MessageSquare size={18} aria-hidden />
        </button>
        <button
          className="ml-auto text-body-sm text-error hover:underline"
          onClick={() => setShowConfirm(true)}
        >
          Drop
        </button>
      </div>

      {/* Drop confirmation */}
      {showConfirm && (
        <div className="px-md pb-md pt-sm border-t border-outline-variant bg-error-container">
          <p className="text-body-md text-on-surface font-semibold mb-xs">Drop "{project.name}"?</p>
          <p className="text-body-sm text-on-surface-variant mb-md">
            You will be removed from this project. This cannot be undone.
          </p>
          <div className="flex gap-sm flex-wrap">
            <button
              className="btn-primary bg-error hover:bg-error text-white"
              onClick={handleDrop}
              disabled={dropping}
            >
              {dropping ? "Dropping…" : "Yes, drop project"}
            </button>
            <button className="btn-secondary" onClick={() => setShowConfirm(false)} disabled={dropping}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Desktop project row
function ProjectRow({
  project,
  onDrop,
  onStatusChange,
  onOpenChat,
}: {
  project: Project & { id: string; inviteId: string; vendorStatus: VendorProjectStatus };
  onDrop: (projectId: string, inviteId: string) => Promise<void>;
  onStatusChange: (projectId: string, status: VendorProjectStatus) => Promise<void>;
  onOpenChat: (projectId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const statusOption = VENDOR_STATUS_OPTIONS.find((o) => o.value === project.vendorStatus)
    ?? VENDOR_STATUS_OPTIONS[0];

  async function handleDrop() {
    setDropping(true);
    await onDrop(project.id, project.inviteId);
    setDropping(false);
    setShowConfirm(false);
  }

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setUpdatingStatus(true);
    await onStatusChange(project.id, e.target.value as VendorProjectStatus);
    setUpdatingStatus(false);
  }

  return (
    <>
      <tr
        className="bg-surface hover:bg-surface-container-low transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-md py-sm">
          <div className="flex items-center gap-sm">
            <ChevronIcon open={expanded} />
            <span className="text-body-md text-on-surface font-semibold">{project.name}</span>
          </div>
        </td>
        <td className="px-md py-sm text-body-sm text-on-surface-variant">{project.address}</td>
        <td className="px-md py-sm">
          <span className={`inline-block text-body-sm px-sm py-xs rounded font-semibold ${
            project.status === "active" ? "bg-green-100 text-green-800" : "bg-surface-container text-on-surface-variant"
          }`}>
            {project.status === "active" ? "Active" : "Closed"}
          </span>
        </td>
        <td className="px-md py-sm" onClick={(e) => e.stopPropagation()}>
          <select
            value={project.vendorStatus}
            onChange={handleStatusChange}
            disabled={updatingStatus}
            className={`text-body-sm px-sm py-xs rounded font-semibold border-0 cursor-pointer ${statusOption.classes} disabled:opacity-60`}
          >
            {VENDOR_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </td>
        <td className="px-md py-sm text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-sm">
            <button
              className="text-on-surface-variant hover:text-primary p-xs rounded transition-colors"
              onClick={() => onOpenChat(project.id)}
              title="Open chat"
              aria-label="Open project chat"
            >
              <MessageSquare size={18} aria-hidden />
            </button>
            <button className="text-body-sm text-error hover:underline" onClick={() => setShowConfirm(true)}>
              Drop
            </button>
          </div>
        </td>
      </tr>

      {showConfirm && (
        <tr key={`${project.id}-confirm`}>
          <td colSpan={5} className="px-lg py-md bg-error-container border-t border-outline-variant">
            <p className="text-body-md text-on-surface font-semibold mb-sm">Drop "{project.name}"?</p>
            <p className="text-body-sm text-on-surface-variant mb-md">
              You will be removed from this project. This cannot be undone.
            </p>
            <div className="flex gap-sm">
              <button
                className="btn-primary bg-error hover:bg-error text-white"
                onClick={handleDrop}
                disabled={dropping}
              >
                {dropping ? "Dropping…" : "Yes, drop project"}
              </button>
              <button className="btn-secondary" onClick={() => setShowConfirm(false)} disabled={dropping}>
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
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
        <div className="flex items-center justify-center h-32 border border-dashed border-outline-variant rounded text-body-md text-on-surface-variant text-center px-md">
          No clients yet. They'll appear after you accept a project invite.
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-sm">
            {clients.map((client) => (
              <div key={client.pmUid} className="border border-outline-variant rounded bg-surface p-md space-y-xs">
                <div className="flex items-start justify-between gap-sm">
                  <p className="text-body-md text-on-surface font-semibold">{client.displayName}</p>
                  <span className={`inline-block text-body-sm px-sm py-xs rounded font-semibold flex-shrink-0 ${
                    client.relationship.workOrdersPaused
                      ? "bg-error-container text-error"
                      : "bg-tier-2-bg text-on-surface"
                  }`}>
                    {client.relationship.workOrdersPaused ? "Paused" : "Active"}
                  </span>
                </div>
                <a href={`mailto:${client.email}`} className="block text-body-sm text-primary hover:underline">
                  {client.email}
                </a>
                <p className="text-body-sm text-on-surface-variant">
                  Connected {formatDate(client.relationship.firstLinkedAt)}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block border border-outline-variant rounded overflow-hidden">
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
                  <tr key={client.pmUid} className="bg-surface hover:bg-surface-container-low transition-colors">
                    <td className="px-md py-sm text-body-md text-on-surface font-semibold">{client.displayName}</td>
                    <td className="px-md py-sm text-body-sm text-on-surface-variant">{client.email}</td>
                    <td className="px-md py-sm text-body-sm text-on-surface-variant">
                      {formatDate(client.relationship.firstLinkedAt)}
                    </td>
                    <td className="px-md py-sm">
                      <span className={`inline-block text-body-sm px-sm py-xs rounded font-semibold ${
                        client.relationship.workOrdersPaused
                          ? "bg-error-container text-error"
                          : "bg-tier-2-bg text-on-surface"
                      }`}>
                        {client.relationship.workOrdersPaused ? "Paused" : "Active"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
        <button className="btn-tertiary text-body-sm" onClick={() => setEditing(!editing)}>
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
          <ProfileRow label="Service zips" value={profile.serviceZipCodes.join(", ") || "—"} />
          <ProfileRow label="Categories" value={profile.categories.map(getCategoryLabel).join(", ") || "—"} />
          <ProfileRow
            label="Discoverable"
            value={profile.discoverable ? "Yes — visible in search" : "No — hidden from search"}
          />
          {contact && <ProfileRow label="Phone" value={contact.phone || "—"} />}
        </div>
      )}
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-md flex-wrap sm:flex-nowrap">
      <span className="text-label-caps uppercase text-on-surface-variant w-full sm:w-36 flex-shrink-0">
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
      <FormField label="Business name" required>
        <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
      </FormField>
      <FormField label="Phone">
        <input type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </FormField>
      <FormField label="Business zip" required>
        <input className="input" maxLength={5} value={businessZip} onChange={(e) => setBusinessZip(e.target.value)} />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-xs">
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

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card text-center p-sm sm:p-md">
      <p className={`text-display font-bold ${accent}`}>{value}</p>
      <p className="text-label-caps uppercase text-on-surface-variant mt-xs text-xs sm:text-sm">
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

// ── Hamburger icon ────────────────────────────────────────────────────────────

function HamburgerIcon({ pendingCount }: { pendingCount: number }) {
  return (
    <div className="relative">
      <Menu size={22} aria-hidden />
      {pendingCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 text-xs bg-error text-white rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
          {pendingCount}
        </span>
      )}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export default function VendorDashboard() {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();
  const uid = user?.uid ?? "";

  const [tab, setTab] = useState<Tab>("documents");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatInitId, setChatInitId] = useState<string | null>(null);
  const [docs, setDocs] = useState<Partial<Record<DocType, VendorDocument>>>({});
  const [customDocs, setCustomDocs] = useState<Array<CustomDocument & { id: string }>>([]);
  const [profile, setProfile] = useState<VendorPublicProfile | null>(null);
  const [contact, setContact] = useState<VendorPrivateContact | null>(null);
  const [invites, setInvites] = useState<Array<Invite & { id: string }>>([]);
  const [projects, setProjects] = useState<Array<Project & { id: string; inviteId: string; vendorStatus: VendorProjectStatus }>>([]);
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
      snap.forEach((d) => { next[d.id as DocType] = d.data() as VendorDocument; });
      setDocs(next);
    });
  }, [uid]);

  // Live custom documents
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(customDocumentsCol(uid), (snap) => {
      setCustomDocs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CustomDocument) })));
    });
  }, [uid]);

  // Live profile
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(vendorDoc(uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as VendorPublicProfile);
    });
  }, [uid]);

  // Contact, invites, projects
  useEffect(() => {
    if (!uid) return;
    getVendorContact(uid).then(setContact);
    getVendorInvites(uid).then(setInvites);
    getVendorProjects(uid).then(setProjects);
  }, [uid]);

  // Live clients via pmRelationships snapshot
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(pmRelationshipsCol(uid), async (snap) => {
      const entries = snap.docs.map((d) => [d.id, d.data() as PmRelationship] as const);
      const resolved = await Promise.all(
        entries.map(async ([pmUid, relationship]) => {
          const userSnap = await getDoc(userDoc(pmUid));
          const data = userSnap.exists()
            ? (userSnap.data() as { displayName: string; email: string })
            : null;
          return {
            pmUid,
            displayName: data?.displayName ?? "Unknown",
            email: data?.email ?? "",
            relationship,
          };
        })
      );
      setClients(resolved as typeof clients);
    });
  }, [uid]);

  async function handleAccept(inviteId: string) {
    await acceptInvite(inviteId, uid);
    setInvites((prev) => prev.map((i) => (i.id === inviteId ? { ...i, status: "accepted" } : i)));
    getVendorProjects(uid).then(setProjects);
  }

  async function handleDecline(inviteId: string) {
    await declineInvite(inviteId);
    setInvites((prev) => prev.map((i) => (i.id === inviteId ? { ...i, status: "declined" } : i)));
  }

  async function handleDropProject(projectId: string, inviteId: string) {
    await dropProject(projectId, uid, inviteId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setInvites((prev) => prev.map((i) => (i.id === inviteId ? { ...i, status: "dropped" } : i)));
  }

  async function handleUpdateProjectStatus(projectId: string, status: VendorProjectStatus) {
    await updateVendorProjectStatus(projectId, uid, status);
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, vendorStatus: status } : p)));
  }

  async function handleSignOut() {
    await logOut();
    navigate("/login", { replace: true });
  }

  const pendingCount = invites.filter((i) => i.status === "pending").length;

  const TAB_TITLES: Record<Tab, string> = {
    documents: "Profile & Documents",
    projects: "My Projects",
    clients: "Property Managers",
    messages: "Messages",
  };

  return (
    <div className={`flex bg-surface ${tab === "messages" ? "h-screen overflow-hidden" : "min-h-screen"}`}>
      <Sidebar
        tab={tab}
        setTab={setTab}
        profile={profile}
        pendingCount={pendingCount}
        onSignOut={handleSignOut}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Page header */}
        <header className="border-b border-outline-variant bg-surface-container-lowest px-md sm:px-xl py-md flex items-center gap-md">
          {/* Hamburger — mobile only */}
          <button
            className="sm:hidden p-xs text-on-surface-variant hover:text-on-surface flex-shrink-0"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <HamburgerIcon pendingCount={pendingCount} />
          </button>

          <div className="min-w-0">
            <p className="text-body-sm text-on-surface-variant truncate hidden sm:block">
              VendorPass → {TAB_TITLES[tab]}
            </p>
            <h1 className="text-h1 text-on-surface truncate">{TAB_TITLES[tab]}</h1>
          </div>
        </header>

        {/* Tab content */}
        <main className={`flex-1 min-h-0 ${tab === "messages" ? "overflow-hidden flex flex-col" : "px-md sm:px-xl py-md sm:py-lg max-w-5xl w-full"}`}>
          {tab === "documents" && (
            <div className="space-y-xl">
              {profile && (
                <>
                  <ProfilePane uid={uid} profile={profile} contact={contact} />
                  <hr className="border-outline-variant" />
                </>
              )}
              <DocumentsPane uid={uid} docs={docs} customDocs={customDocs} />
            </div>
          )}

          {tab === "projects" && (
            <ProjectsPane
              invites={invites}
              projects={projects}
              onAccept={handleAccept}
              onDecline={handleDecline}
              onDrop={handleDropProject}
              onStatusChange={handleUpdateProjectStatus}
              onOpenChat={(projectId) => { setChatInitId(projectId); setTab("messages"); }}
            />
          )}

          {tab === "clients" && <ClientsPane clients={clients} />}

          {tab === "messages" && (
            <MessagesTab
              currentUid={uid}
              currentName={profile?.businessName ?? "Vendor"}
              currentRole="vendor"
              initialProjectId={chatInitId}
            />
          )}

          {tab !== "messages" && <LiabilityFooter />}
        </main>
      </div>
    </div>
  );
}

function extractFilename(url: string, fallback: string): string {
  try {
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
      <a href={url} target="_blank" rel="noopener noreferrer" className="block group" aria-label={filename}>
        <img
          src={url}
          alt={filename}
          className="max-h-48 w-full object-cover rounded border border-outline-variant group-hover:opacity-90 transition-opacity"
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
      <Paperclip size={13} aria-hidden />
      {filename}
    </a>
  );
}
