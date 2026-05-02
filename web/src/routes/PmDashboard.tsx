import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getPmProjects,
  getVendorUidsForPm,
  getVendorProfile,
  getVendorDocuments,
  toggleWorkOrdersPaused,
  pmRelationshipDoc,
  createProject,
} from "../lib/firestore";
import type { Project, VendorPublicProfile, PmRelationship } from "../lib/firestore";
import type { VendorDocument, DocType } from "../lib/docTypes";
import { DOC_TYPE_ORDER, computeOverallTier } from "../lib/docTypes";
import { SearchPane } from "./Search";
import ProjectCard from "../components/ProjectCard";
import TierBadge from "../components/TierBadge";
import InviteVendorModal from "../components/InviteVendorModal";
import LiabilityFooter from "../components/LiabilityFooter";

type Tab = "search" | "projects" | "roster";

interface RosterRow {
  uid: string;
  profile: VendorPublicProfile;
  docs: Partial<Record<DocType, VendorDocument>>;
  relationship: PmRelationship | null;
  activeProjectCount: number;
}

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

  return (
    <div className="min-h-screen bg-surface">
      {/* Nav */}
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="page-container flex items-center justify-between h-14">
          <span className="text-h2 text-on-surface">Compliance Roster.</span>
          <div className="flex items-center gap-md">
            <span className="text-body-sm text-on-surface-variant hidden sm:block">
              {profile?.displayName}
            </span>
            <button className="btn-tertiary text-body-sm" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="page-container flex gap-md">
          {(["search", "projects", "roster"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`py-sm px-md text-body-md border-b-2 transition-colors -mb-px ${
                tab === t
                  ? "border-primary-container text-on-surface"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="page-container py-lg">
        {tab === "search" && (
          <SearchPane />
        )}
        {tab === "projects" && profile && (
          <ProjectsTab pmUid={profile.uid} />
        )}
        {tab === "roster" && profile && (
          <RosterTab pmUid={profile.uid} />
        )}

        <LiabilityFooter />
      </div>
    </div>
  );
}

// ── Projects Tab ─────────────────────────────────────────────────────────────

function ProjectsTab({ pmUid }: { pmUid: string }) {
  const [projects, setProjects] = useState<Array<Project & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    getPmProjects(pmUid).then((p) => {
      setProjects(p.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds));
      setLoading(false);
    });
  }, [pmUid]);

  async function handleCreate(data: Omit<Project, "pmUid" | "createdAt">) {
    const id = await createProject(pmUid, data);
    const newProject = { id, pmUid, ...data, createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as never };
    setProjects((prev) => [newProject, ...prev]);
    setShowCreate(false);
  }

  return (
    <div className="space-y-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-h1 text-on-surface">Projects</h2>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {showCreate && <CreateProjectForm onSubmit={handleCreate} />}

      {loading ? (
        <p className="text-body-md text-on-surface-variant">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">
          No projects yet.{" "}
          <button className="btn-tertiary" onClick={() => setShowCreate(true)}>
            Create your first project.
          </button>
        </p>
      ) : (
        <div className="space-y-sm">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  );
}

function CreateProjectForm({ onSubmit }: { onSubmit: (data: Omit<Project, "pmUid" | "createdAt">) => Promise<void> }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Project name is required."); return; }
    if (!/^\d{5}$/.test(zip)) { setError("Enter a valid 5-digit zip."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), address: address.trim(), zipCode: zip, status: "active", startDate: null, endDate: null, description: description.trim() });
    } catch { setError("Failed to create project."); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-md">
      <h3 className="text-h2 text-on-surface">New Project</h3>
      <Field label="Project name" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Address"><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
      <Field label="Zip code" required><input className="input" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="90210" /></Field>
      <Field label="Description"><textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      {error && <p className="text-body-sm text-error">{error}</p>}
      <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Creating…" : "Create Project"}</button>
    </form>
  );
}

// ── Roster Tab ────────────────────────────────────────────────────────────────

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

          const activeProjects = projects.filter(
            (p) => p.status === "active"
          );
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

  // Roster needs a projectId to invite — use first active project or prompt
  useEffect(() => {
    getPmProjects(pmUid).then((projects) => {
      const active = projects.find((p) => p.status === "active");
      if (active) setInviteProjectId(active.id);
    });
  }, [pmUid]);

  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between">
        <h2 className="text-h1 text-on-surface">Roster</h2>
        <button className="btn-secondary" onClick={() => setInviteOpen(true)}>
          Invite Vendor by Email
        </button>
      </div>

      {loading ? (
        <p className="text-body-md text-on-surface-variant">Loading roster…</p>
      ) : rows.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">
          No vendors yet. Invite vendors from the Search tab or by email.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">Vendor</th>
                <th className="th">License</th>
                <th className="th">W-9</th>
                <th className="th">COI</th>
                <th className="th">Overall</th>
                <th className="th">Projects</th>
                <th className="th">Work orders</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const overallTier = computeOverallTier(row.docs);
                return (
                  <tr key={row.uid} className="tr-hover">
                    <td className="td">
                      <Link to={`/vendors/${row.uid}`} className="text-primary hover:underline">
                        {row.profile.businessName}
                      </Link>
                    </td>
                    {DOC_TYPE_ORDER.map((dt) => (
                      <td key={dt} className="td">
                        <TierBadge tier={row.docs[dt]?.tier ?? null} />
                      </td>
                    ))}
                    <td className="td"><TierBadge tier={overallTier} /></td>
                    <td className="td text-on-surface-variant">{row.activeProjectCount}</td>
                    <td className="td">
                      <button
                        className={`text-body-sm ${
                          row.relationship?.workOrdersPaused
                            ? "text-error"
                            : "text-on-surface-variant"
                        } hover:underline`}
                        onClick={() =>
                          handleTogglePause(row.uid, row.relationship?.workOrdersPaused ?? false)
                        }
                      >
                        {row.relationship?.workOrdersPaused ? "Paused" : "Active"}
                      </button>
                    </td>
                    <td className="td">
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
