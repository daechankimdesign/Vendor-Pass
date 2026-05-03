import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Menu, ChevronRight, ChevronDown, MessageSquare, X,
  Building2, Users, Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  getPmProjects,
  getVendorUidsForPm,
  getVendorProfile,
  getVendorDocuments,
  toggleWorkOrdersPaused,
  pmRelationshipDoc,
  createProject,
  updateProject,
  deleteProject,
  getProjectVendorDetails,
  removeVendorFromProject,
  updatePmProfile,
  getPmInvites,
} from "../lib/firestore";
import type { Project, VendorPublicProfile, PmRelationship, Invite, ProjectVendorDetail } from "../lib/firestore";
import type { VendorDocument, DocType } from "../lib/docTypes";
import { DOC_TYPE_ORDER, DOC_TYPE_SCHEMAS, computeOverallTier } from "../lib/docTypes";
import TierBadge from "../components/TierBadge";
import InviteVendorModal from "../components/InviteVendorModal";
import MessagesTab from "../components/MessagesTab";
import LiabilityFooter from "../components/LiabilityFooter";

type Tab = "projects" | "roster" | "profile" | "messages";

interface RosterRow {
  uid: string;
  profile: VendorPublicProfile;
  docs: Partial<Record<DocType, VendorDocument>>;
  relationship: PmRelationship | null;
  activeProjectCount: number;
}

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

const NAV: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "projects", label: "Projects", Icon: Building2 },
  { id: "roster", label: "Roster", Icon: Users },
  { id: "messages", label: "Messages", Icon: MessageSquare },
  { id: "profile", label: "Profile", Icon: Settings },
];

function Sidebar({
  tab,
  setTab,
  displayName,
  onSignOut,
  mobileOpen,
  onMobileClose,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  displayName: string;
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

        {/* PM info */}
        <div className="px-lg py-md border-b border-outline-variant">
          <p className="text-body-md text-on-surface font-semibold truncate">
            {displayName || "Property Manager"}
          </p>
          <p className="text-body-sm text-on-surface-variant mt-xs">Property Manager</p>
        </div>

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


// ── Projects tab ──────────────────────────────────────────────────────────────

function ProjectsTab({ pmUid, onOpenChat }: { pmUid: string; onOpenChat: (projectId: string) => void }) {
  const [projects, setProjects] = useState<Array<Project & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [vendorMap, setVendorMap] = useState<Record<string, ProjectVendorDetail[]>>({});
  const [loadingVendors, setLoadingVendors] = useState<string | null>(null);

  useEffect(() => {
    getPmProjects(pmUid).then((p) => {
      setProjects(p.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds));
      setLoading(false);
    });
  }, [pmUid]);

  async function handleCreate(data: Omit<Project, "pmUid" | "createdAt">) {
    const id = await createProject(pmUid, data);
    const newProject = {
      id,
      pmUid,
      ...data,
      createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as never,
    };
    setProjects((prev) => [newProject, ...prev]);
    setShowCreate(false);
  }

  async function handleUpdate(id: string, data: Omit<Project, "pmUid" | "createdAt">) {
    await updateProject(id, data);
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  async function handleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!vendorMap[id]) {
      setLoadingVendors(id);
      const vendors = await getProjectVendorDetails(id);
      setVendorMap((prev) => ({ ...prev, [id]: vendors }));
      setLoadingVendors(null);
    }
  }

  async function handleRemoveVendor(projectId: string, vendorUid: string, inviteId: string) {
    if (!confirm("Remove this contractor from the project?")) return;
    await removeVendorFromProject(projectId, vendorUid, inviteId);
    setVendorMap((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).filter((v) => v.uid !== vendorUid),
    }));
  }

  const active = projects.filter((p) => p.status === "active");
  const closed = projects.filter((p) => p.status === "closed");

  return (
    <div className="space-y-lg">
      {/* Stats + new project button */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-md">
        <div className="grid grid-cols-2 gap-md flex-1">
          <StatCard label="Active" value={active.length} accent="text-primary" />
          <StatCard label="Closed" value={closed.length} accent="text-on-surface-variant" />
        </div>
        <button className="btn-primary sm:flex-shrink-0" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {showCreate && (
        <ProjectForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
      )}

      {loading ? (
        <p className="text-body-md text-on-surface-variant">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="flex items-center justify-center h-32 border border-dashed border-outline-variant rounded text-body-md text-on-surface-variant text-center px-md">
          No projects yet.
        </div>
      ) : (
        <div className="border border-outline-variant rounded overflow-hidden divide-y divide-outline-variant">
          {projects.map((p) => {
            const isExpanded = expandedId === p.id;
            const vendors = vendorMap[p.id] ?? [];
            const hasVendors = vendors.length > 0;

            if (editingId === p.id) {
              return (
                <div key={p.id} className="px-md py-md bg-surface-container-low">
                  <ProjectForm
                    initial={p}
                    onSubmit={(data) => handleUpdate(p.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              );
            }

            return (
              <div key={p.id}>
                {/* ── Mobile project card ── */}
                <div className="sm:hidden bg-surface px-md py-md">
                  <div className="flex items-start gap-sm">
                    <button
                      onClick={() => handleExpand(p.id)}
                      className="mt-0.5 text-on-surface-variant hover:text-on-surface flex-shrink-0"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      <ChevronDownIcon open={isExpanded} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-md text-on-surface font-semibold">{p.name}</p>
                      {p.address && (
                        <p className="text-body-sm text-on-surface-variant truncate mt-xs">{p.address}</p>
                      )}
                      <div className="flex items-center gap-sm mt-xs flex-wrap">
                        <span className={`inline-block text-body-sm px-sm py-xs rounded font-semibold ${
                          p.status === "active"
                            ? "bg-tier-2-bg text-on-surface"
                            : "bg-surface-container text-on-surface-variant"
                        }`}>
                          {p.status === "active" ? "Active" : "Closed"}
                        </span>
                        <span className="text-body-sm text-on-surface-variant">{formatDate(p.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-md mt-sm">
                        <button
                          className="text-on-surface-variant hover:text-primary p-xs rounded transition-colors"
                          onClick={(e) => { e.stopPropagation(); onOpenChat(p.id); }}
                          title="Open chat"
                          aria-label="Open project chat"
                        >
                          <MessageSquare size={18} aria-hidden />
                        </button>
                        <button
                          className="btn-tertiary text-body-sm"
                          onClick={() => { setEditingId(p.id); setExpandedId(null); }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-body-sm text-error hover:underline disabled:opacity-30"
                          onClick={() => handleDelete(p.id)}
                          disabled={isExpanded && hasVendors}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Desktop project row ── */}
                <div className="hidden sm:flex bg-surface hover:bg-surface-container-low transition-colors px-md py-sm items-center gap-md">
                  <button
                    onClick={() => handleExpand(p.id)}
                    className="text-on-surface-variant hover:text-on-surface flex-shrink-0"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    <ChevronIcon open={isExpanded} />
                  </button>

                  <div className="flex-1 min-w-0 grid grid-cols-5 gap-md items-center">
                    <p className="text-body-md text-on-surface font-semibold truncate col-span-2">
                      {p.name}
                    </p>
                    <p className="text-body-sm text-on-surface-variant truncate">
                      {p.address || "—"}
                    </p>
                    <span className={`inline-block text-body-sm px-sm py-xs rounded font-semibold w-fit ${
                      p.status === "active"
                        ? "bg-tier-2-bg text-on-surface"
                        : "bg-surface-container text-on-surface-variant"
                    }`}>
                      {p.status === "active" ? "Active" : "Closed"}
                    </span>
                    <p className="text-body-sm text-on-surface-variant">{formatDate(p.createdAt)}</p>
                  </div>

                  <div className="flex items-center gap-xs flex-shrink-0">
                    <button
                      className="text-on-surface-variant hover:text-primary p-xs rounded transition-colors"
                      onClick={(e) => { e.stopPropagation(); onOpenChat(p.id); }}
                      title="Open chat"
                      aria-label="Open project chat"
                    >
                      <MessageSquare size={18} aria-hidden />
                    </button>
                    <button
                      className="btn-tertiary text-body-sm"
                      onClick={() => { setEditingId(p.id); setExpandedId(null); }}
                    >
                      Edit
                    </button>
                    <button
                      className="text-body-sm text-error hover:underline disabled:opacity-30 disabled:cursor-not-allowed px-xs py-xs"
                      onClick={() => handleDelete(p.id)}
                      disabled={isExpanded && hasVendors}
                      title={hasVendors ? "Remove all contractors before deleting" : "Delete project"}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Expanded vendor + chat panel */}
                {isExpanded && (
                  <div className="bg-surface-container-low border-t border-outline-variant px-md sm:px-xl py-md">
                    {loadingVendors === p.id ? (
                      <p className="text-body-sm text-on-surface-variant">Loading contractors…</p>
                    ) : vendors.length === 0 ? (
                      <p className="text-body-sm text-on-surface-variant italic">
                        No contractors assigned to this project.
                      </p>
                    ) : (
                      <div className="space-y-xs">
                        <p className="text-label-caps uppercase text-on-surface-variant mb-sm">
                          Contractors ({vendors.length})
                        </p>
                        {vendors.map((v) => (
                          <div
                            key={v.uid}
                            className="flex items-center justify-between gap-md py-sm border-b border-outline-variant last:border-0"
                          >
                            <div className="min-w-0">
                              <p className="text-body-md text-on-surface font-semibold">{v.businessName}</p>
                              <div className="flex flex-wrap gap-md mt-xs">
                                {v.contactEmail && (
                                  <a href={`mailto:${v.contactEmail}`} className="text-body-sm text-primary hover:underline">
                                    {v.contactEmail}
                                  </a>
                                )}
                                {v.phone && (
                                  <a href={`tel:${v.phone}`} className="text-body-sm text-on-surface-variant hover:text-on-surface">
                                    {v.phone}
                                  </a>
                                )}
                              </div>
                            </div>
                            <button
                              className="text-body-sm text-error hover:underline flex-shrink-0"
                              onClick={() => handleRemoveVendor(p.id, v.uid, v.inviteId)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return <ChevronRight size={16} aria-hidden className={`transition-transform ${open ? "rotate-90" : ""}`} />;
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return <ChevronDown size={16} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />;
}



function ProjectForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Project & { id: string };
  onSubmit: (data: Omit<Project, "pmUid" | "createdAt">) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [zip, setZip] = useState(initial?.zipCode ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<"active" | "closed">(initial?.status ?? "active");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Project name is required."); return; }
    if (!/^\d{5}$/.test(zip)) { setError("Enter a valid 5-digit zip."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        address: address.trim(),
        zipCode: zip,
        description: description.trim(),
        status,
        startDate: null,
        endDate: null,
      });
    } catch {
      setError("Failed to save project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-md">
      <h3 className="text-h2 text-on-surface">{initial ? "Edit Project" : "New Project"}</h3>
      <FormField label="Project name" required>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <FormField label="Address">
        <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
      </FormField>
      <FormField label="Zip code" required>
        <input className="input" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="90210" />
      </FormField>
      <FormField label="Description">
        <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormField>
      {initial && (
        <FormField label="Status">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as "active" | "closed")}>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </FormField>
      )}
      {error && <p className="text-body-sm text-error">{error}</p>}
      <div className="flex gap-sm flex-wrap">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save Changes" : "Create Project"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Sent invites section ───────────────────────────────────────────────────────

function SentInvitesSection({ pmUid }: { pmUid: string }) {
  const [invites, setInvites] = useState<Array<Invite & { id: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPmInvites(pmUid)
      .then((all) =>
        setInvites(
          all
            .filter((i) => i.status === "pending" || i.status === "pending_signup")
            .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds)
        )
      )
      .finally(() => setLoading(false));
  }, [pmUid]);

  if (loading) return null;
  if (invites.length === 0) return null;

  return (
    <section className="mb-lg">
      <h2 className="text-h2 text-on-surface mb-md flex items-center gap-sm">
        Sent Quote Requests
        <span className="text-xs bg-primary-fixed text-on-primary-fixed rounded-full px-sm py-xs font-bold">
          {invites.length}
        </span>
      </h2>
      <div className="space-y-sm">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="border border-outline-variant rounded p-md bg-surface-container-lowest flex flex-wrap items-start justify-between gap-md"
          >
            <div className="min-w-0 flex-1">
              <p className="text-body-md text-on-surface font-semibold truncate">
                {invite.projectName || "Unnamed Project"}
              </p>
              <p className="text-body-sm text-on-surface-variant mt-xs">
                Sent to{" "}
                <span className="font-medium text-on-surface">{invite.vendorEmail || "vendor"}</span>
                {invite.projectZip && ` · ${invite.projectZip}`}
              </p>
            </div>
            <span className="flex-shrink-0 inline-flex items-center text-body-sm font-semibold px-sm py-xs rounded bg-tier-2-bg text-on-surface">
              Awaiting response
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Roster tab ─────────────────────────────────────────────────────────────────

function RosterTab({ pmUid }: { pmUid: string }) {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteProjectId, setInviteProjectId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const projects = await getPmProjects(pmUid);
      const vendorUids = await getVendorUidsForPm(pmUid);

      const rowData = await Promise.all(
        vendorUids.map(async (uid) => {
          const [profile, docs] = await Promise.all([
            getVendorProfile(uid),
            getVendorDocuments(uid),
          ]);
          if (!profile) return null;

          const activeProjects = projects.filter((p) => p.status === "active");
          const activeCount = (
            await Promise.all(
              activeProjects.map(async (p) => {
                const { getDocs } = await import("firebase/firestore");
                const { projectVendorsCol } = await import("../lib/firestore");
                const snap = await getDocs(projectVendorsCol(p.id));
                return snap.docs.some((d) => d.id === uid);
              })
            )
          ).filter(Boolean).length;

          let relationship: PmRelationship | null = null;
          try {
            const { getDoc } = await import("firebase/firestore");
            const relSnap = await getDoc(pmRelationshipDoc(uid, pmUid));
            if (relSnap.exists()) relationship = relSnap.data() as PmRelationship;
          } catch { /* no relationship */ }

          return { uid, profile, docs, relationship, activeProjectCount: activeCount } satisfies RosterRow;
        })
      );

      setRows(rowData.filter((r): r is RosterRow => r !== null));
      setLoading(false);
    }
    load();
  }, [pmUid]);

  useEffect(() => {
    getPmProjects(pmUid).then((projects) => {
      const active = projects.find((p) => p.status === "active");
      if (active) setInviteProjectId(active.id);
    });
  }, [pmUid]);

  async function handleTogglePause(vendorUid: string, current: boolean) {
    await toggleWorkOrdersPaused(vendorUid, pmUid, !current);
    setRows((prev) =>
      prev.map((r) =>
        r.uid === vendorUid && r.relationship
          ? { ...r, relationship: { ...r.relationship, workOrdersPaused: !current } }
          : r
      )
    );
  }

  const verified = rows.filter((r) => computeOverallTier(r.docs) === "verified").length;
  const selfVerified = rows.filter((r) => computeOverallTier(r.docs) === "self_verified").length;
  const unverified = rows.filter((r) => computeOverallTier(r.docs) === "unverified").length;

  return (
    <div className="space-y-lg">
      <SentInvitesSection pmUid={pmUid} />

      {/* Stats + invite button */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-md">
        <div className="grid grid-cols-3 gap-sm sm:gap-md flex-1">
          <StatCard label="Verified" value={verified} accent="text-primary" />
          <StatCard label="Self-Verified" value={selfVerified} accent="text-on-surface" />
          <StatCard label="Unverified" value={unverified} accent="text-on-surface-variant" />
        </div>
        <button className="btn-secondary sm:flex-shrink-0" onClick={() => setInviteOpen(true)}>
          Request Quote by Email
        </button>
      </div>

      {loading ? (
        <p className="text-body-md text-on-surface-variant">Loading roster…</p>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center h-32 border border-dashed border-outline-variant rounded text-body-md text-on-surface-variant text-center px-md">
          No vendors yet. Request quotes from Search or by email.
        </div>
      ) : (
        <>
          {/* ── Mobile vendor cards ── */}
          <div className="sm:hidden space-y-sm">
            {rows.map((row) => {
              const overallTier = computeOverallTier(row.docs);
              return (
                <div key={row.uid} className="border border-outline-variant rounded bg-surface p-md space-y-sm">
                  {/* Name + overall tier */}
                  <div className="flex items-start justify-between gap-sm">
                    <Link
                      to={`/vendors/${row.uid}`}
                      className="text-body-md text-on-surface font-semibold hover:underline"
                    >
                      {row.profile.businessName}
                    </Link>
                    <TierBadge tier={overallTier} />
                  </div>

                  {/* Per-doc tiers */}
                  <div className="flex flex-wrap gap-sm">
                    {DOC_TYPE_ORDER.map((dt) => (
                      <div key={dt} className="flex items-center gap-xs">
                        <span className="text-body-sm text-on-surface-variant">
                          {DOC_TYPE_SCHEMAS[dt].label.replace("Certificate of Insurance", "COI")}:
                        </span>
                        <TierBadge tier={row.docs[dt]?.tier ?? null} />
                      </div>
                    ))}
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center justify-between gap-sm pt-xs border-t border-outline-variant">
                    <button
                      className={`text-body-sm font-semibold px-sm py-xs rounded ${
                        row.relationship?.workOrdersPaused
                          ? "bg-error-container text-error"
                          : "bg-tier-2-bg text-on-surface"
                      }`}
                      onClick={() => handleTogglePause(row.uid, row.relationship?.workOrdersPaused ?? false)}
                    >
                      {row.relationship?.workOrdersPaused ? "Paused" : "Active"}
                    </button>
                    <Link to={`/vendors/${row.uid}`} className="btn-tertiary text-body-sm">
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Desktop table ── */}
          <div className="hidden sm:block border border-outline-variant rounded overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-container">
                <tr>
                  <Th>Vendor</Th>
                  <Th>License</Th>
                  <Th>W-9</Th>
                  <Th>COI</Th>
                  <Th>Overall</Th>
                  <Th>Projects</Th>
                  <Th>Work Orders</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {rows.map((row) => {
                  const overallTier = computeOverallTier(row.docs);
                  return (
                    <tr key={row.uid} className="bg-surface hover:bg-surface-container-low transition-colors">
                      <td className="px-md py-sm text-body-md text-on-surface font-semibold">
                        <Link to={`/vendors/${row.uid}`} className="hover:underline">
                          {row.profile.businessName}
                        </Link>
                      </td>
                      {DOC_TYPE_ORDER.map((dt) => (
                        <td key={dt} className="px-md py-sm">
                          <TierBadge tier={row.docs[dt]?.tier ?? null} />
                        </td>
                      ))}
                      <td className="px-md py-sm">
                        <TierBadge tier={overallTier} />
                      </td>
                      <td className="px-md py-sm text-body-sm text-on-surface-variant">
                        {row.activeProjectCount}
                      </td>
                      <td className="px-md py-sm">
                        <button
                          className={`text-body-sm font-semibold px-sm py-xs rounded ${
                            row.relationship?.workOrdersPaused
                              ? "bg-error-container text-error"
                              : "bg-tier-2-bg text-on-surface"
                          }`}
                          onClick={() => handleTogglePause(row.uid, row.relationship?.workOrdersPaused ?? false)}
                        >
                          {row.relationship?.workOrdersPaused ? "Paused" : "Active"}
                        </button>
                      </td>
                      <td className="px-md py-sm">
                        <Link to={`/vendors/${row.uid}`} className="btn-tertiary text-body-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {inviteOpen && inviteProjectId && (
        <InviteVendorModal projectId={inviteProjectId} onClose={() => setInviteOpen(false)} />
      )}
      {inviteOpen && !inviteProjectId && (
        <div className="card">
          <p className="text-body-md text-on-surface-variant">
            Create a project first before inviting vendors by email.
          </p>
          <button className="btn-secondary mt-sm" onClick={() => setInviteOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────

function ProfileTab({ pmUid }: { pmUid: string }) {
  const { profile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [companyName, setCompanyName] = useState(profile?.companyName ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [title, setTitle] = useState(profile?.title ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updatePmProfile(pmUid, {
        displayName: displayName.trim(),
        companyName: companyName.trim(),
        phone: phone.trim(),
        title: title.trim(),
      });
      setSaved(true);
    } catch {
      setError("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-lg">
      <div className="card space-y-md">
        <h2 className="text-h2 text-on-surface">Your Profile</h2>
        <p className="text-body-sm text-on-surface-variant">
          This information is shown to vendors when you send them a quote request.
        </p>
        <form onSubmit={handleSubmit} className="space-y-md">
          <FormField label="Full name" required>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </FormField>
          <FormField label="Company / Organization">
            <input className="input" placeholder="e.g. Acme Property Group" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </FormField>
          <FormField label="Title">
            <input className="input" placeholder="e.g. Property Manager" value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Phone">
            <input className="input" type="tel" placeholder="e.g. (310) 555-0100" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormField>
          {error && <p className="text-body-sm text-error">{error}</p>}
          {saved && <p className="text-body-sm text-primary">Profile saved.</p>}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </div>

      <div className="card">
        <p className="text-label-caps uppercase text-on-surface-variant mb-xs">Email</p>
        <p className="text-body-md text-on-surface">{profile?.email}</p>
        <p className="text-body-sm text-on-surface-variant mt-xs">Email cannot be changed here.</p>
      </div>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card text-center p-sm sm:p-md">
      <p className={`text-display font-bold ${accent}`}>{value}</p>
      <p className="text-label-caps uppercase text-on-surface-variant mt-xs text-xs sm:text-sm">{label}</p>
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

export default function PmDashboard() {
  const { profile, logOut } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const rawTab = params.get("tab");
  const tab: Tab = (rawTab === "projects" || rawTab === "roster" || rawTab === "profile" || rawTab === "messages")
    ? rawTab
    : "projects";

  function setTab(t: Tab) {
    setParams({ tab: t });
  }

  async function handleSignOut() {
    await logOut();
    navigate("/login", { replace: true });
  }

  const TAB_TITLES: Record<Tab, string> = {
    projects: "Projects",
    roster: "Roster",
    messages: "Messages",
    profile: "Profile",
  };

  return (
    <div className={`flex bg-surface ${tab === "messages" ? "h-screen overflow-hidden" : "min-h-screen"}`}>
      <Sidebar
        tab={tab}
        setTab={setTab}
        displayName={profile?.displayName ?? ""}
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
            <Menu size={22} aria-hidden />
          </button>

          <div className="min-w-0">
            <p className="text-body-sm text-on-surface-variant hidden sm:block">
              VendorPass → {TAB_TITLES[tab]}
            </p>
            <h1 className="text-h1 text-on-surface truncate">{TAB_TITLES[tab]}</h1>
          </div>
        </header>

        {/* Tab content */}
        <main className={`flex-1 min-h-0 ${tab === "messages" ? "overflow-hidden flex flex-col" : "px-md sm:px-xl py-md sm:py-lg max-w-6xl w-full"}`}>
          {tab === "projects" && profile && (
            <ProjectsTab
              pmUid={profile.uid}
              onOpenChat={(projectId) => setParams({ tab: "messages", chatProject: projectId })}
            />
          )}

          {tab === "roster" && profile && (
            <RosterTab pmUid={profile.uid} />
          )}

          {tab === "profile" && profile && (
            <ProfileTab pmUid={profile.uid} />
          )}

          {tab === "messages" && profile && (
            <MessagesTab
              currentUid={profile.uid}
              currentName={profile.displayName || "Property Manager"}
              currentRole="property_manager"
              initialProjectId={params.get("chatProject")}
            />
          )}

          {tab !== "messages" && <LiabilityFooter />}
        </main>
      </div>
    </div>
  );
}
