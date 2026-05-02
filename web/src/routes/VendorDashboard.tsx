import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  getVendorProjects,
  getVendorClients,
  parseZipCodes,
} from "../lib/firestore";
import type {
  VendorPublicProfile,
  VendorPrivateContact,
  Invite,
  Project,
} from "../lib/firestore";
import { DOC_TYPE_ORDER, DOC_TYPE_SCHEMAS } from "../lib/docTypes";
import type { VendorDocument, DocType } from "../lib/docTypes";
import TierBadge from "../components/TierBadge";
import DocumentUploader from "../components/DocumentUploader";
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
}: {
  uid: string;
  docs: Partial<Record<DocType, VendorDocument>>;
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
              return (
                <>
                  <tr key={docType} className="bg-surface hover:bg-surface-container-low transition-colors">
                    <td className="px-md py-sm text-body-md text-on-surface font-semibold">
                      {schema.label}
                    </td>
                    <td className="px-md py-sm">
                      {doc ? (
                        <TierBadge tier={doc.tier} />
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
                      <button
                        className="btn-tertiary text-body-sm"
                        onClick={() =>
                          setExpandedDoc(expandedDoc === docType ? null : docType)
                        }
                      >
                        {expandedDoc === docType
                          ? "Cancel"
                          : doc
                          ? "Re-upload"
                          : "Upload"}
                      </button>
                    </td>
                  </tr>
                  {expandedDoc === docType && (
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
    </div>
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
          <div className="space-y-sm">
            {pending.map((invite) => (
              <div
                key={invite.id}
                className="card flex items-center justify-between gap-md"
              >
                <div>
                  <p className="text-body-md text-on-surface font-semibold">
                    Project invitation
                  </p>
                  <p className="text-body-sm text-on-surface-variant">
                    From {invite.vendorEmail}
                  </p>
                </div>
                <div className="flex gap-sm">
                  <button
                    className="btn-primary"
                    onClick={() => onAccept(invite.id)}
                  >
                    Accept
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => onDecline(invite.id)}
                  >
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

function Th({ children }: { children: React.ReactNode }) {
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
          {tab === "documents" && <DocumentsPane uid={uid} docs={docs} />}

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
