import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
  updatePmProfile,
} from "../lib/firestore";
import type { Project, VendorPublicProfile, PmRelationship } from "../lib/firestore";
import type { VendorDocument, DocType } from "../lib/docTypes";
import { DOC_TYPE_ORDER, computeOverallTier } from "../lib/docTypes";
import { SearchPane } from "./Search";
import TierBadge from "../components/TierBadge";
import InviteVendorModal from "../components/InviteVendorModal";
import LiabilityFooter from "../components/LiabilityFooter";

type Tab = "search" | "projects" | "roster" | "profile";

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

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "search", label: "Search Vendors", icon: "🔍" },
  { id: "projects", label: "Projects", icon: "🏗️" },
  { id: "roster", label: "Roster", icon: "👥" },
  { id: "profile", label: "Profile", icon: "⚙️" },
];

function Sidebar({
  tab,
  setTab,
  displayName,
  onSignOut,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  displayName: string;
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

      {/* PM info */}
      <div className="px-lg py-md border-b border-outline-variant">
        <p className="text-body-md text-on-surface font-semibold truncate">
          {displayName || "Property Manager"}
        </p>
        <p className="text-body-sm text-on-surface-variant mt-xs">Property Manager</p>
      </div>

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

// ── Projects tab ──────────────────────────────────────────────────────────────

function ProjectsTab({ pmUid }: { pmUid: string }) {
  const [projects, setProjects] = useState<Array<Project & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const active = projects.filter((p) => p.status === "active");
  const closed = projects.filter((p) => p.status === "closed");

  return (
    <div className="space-y-lg">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 gap-md">
          <StatCard label="Active" value={active.length} accent="text-primary" />
          <StatCard label="Closed" value={closed.length} accent="text-on-surface-variant" />
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {showCreate && (
        <ProjectForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
      )}

      {loading ? (
        <p className="text-body-md text-on-surface-variant">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="flex items-center justify-center h-32 border border-dashed border-outline-variant rounded text-body-md text-on-surface-variant">
          No projects yet.
        </div>
      ) : (
        <div className="border border-outline-variant rounded overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-container">
              <tr>
                <Th>Project</Th>
                <Th>Address</Th>
                <Th>Zip</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {projects.map((p) =>
                editingId === p.id ? (
                  <tr key={p.id}>
                    <td colSpan={6} className="px-md py-md bg-surface-container-low">
                      <ProjectForm
                        initial={p}
                        onSubmit={(data) => handleUpdate(p.id, data)}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className="bg-surface hover:bg-surface-container-low transition-colors">
                    <td className="px-md py-sm text-body-md text-on-surface font-semibold">
                      {p.name}
                    </td>
                    <td className="px-md py-sm text-body-sm text-on-surface-variant">
                      {p.address || "—"}
                    </td>
                    <td className="px-md py-sm text-body-sm text-on-surface-variant">
                      {p.zipCode}
                    </td>
                    <td className="px-md py-sm">
                      <span
                        className={`inline-block text-body-sm px-sm py-xs rounded font-semibold ${
                          p.status === "active"
                            ? "bg-tier-2-bg text-on-surface"
                            : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {p.status === "active" ? "Active" : "Closed"}
                      </span>
                    </td>
                    <td className="px-md py-sm text-body-sm text-on-surface-variant">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="px-md py-sm">
                      <button
                        className="btn-tertiary text-body-sm"
                        onClick={() => setEditingId(p.id)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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
      <div className="flex gap-sm">
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
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-md">
          <StatCard label="Verified" value={verified} accent="text-primary" />
          <StatCard label="Self-Verified" value={selfVerified} accent="text-on-surface" />
          <StatCard label="Unverified" value={unverified} accent="text-on-surface-variant" />
        </div>
        <button className="btn-secondary" onClick={() => setInviteOpen(true)}>
          Invite by Email
        </button>
      </div>

      {loading ? (
        <p className="text-body-md text-on-surface-variant">Loading roster…</p>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center h-32 border border-dashed border-outline-variant rounded text-body-md text-on-surface-variant">
          No vendors yet. Invite vendors from Search or by email.
        </div>
      ) : (
        <div className="border border-outline-variant rounded overflow-hidden">
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
                        onClick={() =>
                          handleTogglePause(row.uid, row.relationship?.workOrdersPaused ?? false)
                        }
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
      )}

      {inviteOpen && inviteProjectId && (
        <InviteVendorModal
          projectId={inviteProjectId}
          onClose={() => setInviteOpen(false)}
        />
      )}
      {inviteOpen && !inviteProjectId && (
        <div className="card">
          <p className="text-body-md text-on-surface-variant">
            Create a project first before inviting vendors by email.
          </p>
          <button className="btn-secondary mt-sm" onClick={() => setInviteOpen(false)}>
            Close
          </button>
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
          This information is shown to vendors when you invite them to a project.
        </p>
        <form onSubmit={handleSubmit} className="space-y-md">
          <FormField label="Full name" required>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </FormField>
          <FormField label="Company / Organization">
            <input
              className="input"
              placeholder="e.g. Acme Property Group"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </FormField>
          <FormField label="Title">
            <input
              className="input"
              placeholder="e.g. Property Manager"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormField>
          <FormField label="Phone">
            <input
              className="input"
              type="tel"
              placeholder="e.g. (310) 555-0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
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
        <p className="text-body-sm text-on-surface-variant mt-xs">
          Email cannot be changed here.
        </p>
      </div>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card text-center">
      <p className={`text-display font-bold ${accent}`}>{value}</p>
      <p className="text-label-caps uppercase text-on-surface-variant mt-xs">{label}</p>
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

export default function PmDashboard() {
  const { profile, logOut } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) ?? "search";

  function setTab(t: Tab) {
    setParams({ tab: t });
  }

  async function handleSignOut() {
    await logOut();
    navigate("/login", { replace: true });
  }

  const TAB_TITLES: Record<Tab, string> = {
    search: "Search Vendors",
    projects: "Projects",
    roster: "Roster",
    profile: "Profile",
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar
        tab={tab}
        setTab={setTab}
        displayName={profile?.displayName ?? ""}
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
        <main className="flex-1 px-xl py-lg max-w-6xl w-full">
          {tab === "search" && <SearchPane />}

          {tab === "projects" && profile && (
            <ProjectsTab pmUid={profile.uid} />
          )}

          {tab === "roster" && profile && (
            <RosterTab pmUid={profile.uid} />
          )}

          {tab === "profile" && profile && (
            <ProfileTab pmUid={profile.uid} />
          )}

          <LiabilityFooter />
        </main>
      </div>
    </div>
  );
}
