import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  projectDoc,
  projectVendorsCol,
  getVendorProfile,
  getVendorDocuments,
  updateProject,
} from "../lib/firestore";
import type { Project, VendorPublicProfile } from "../lib/firestore";
import type { VendorDocument, DocType } from "../lib/docTypes";
import { DOC_TYPE_ORDER, computeOverallTier } from "../lib/docTypes";
import { getDocs, onSnapshot } from "firebase/firestore";
import TierBadge from "../components/TierBadge";
import InviteVendorModal from "../components/InviteVendorModal";
import LiabilityFooter from "../components/LiabilityFooter";

interface ProjectVendorRow {
  uid: string;
  profile: VendorPublicProfile;
  docs: Partial<Record<DocType, VendorDocument>>;
}

function formatDate(ts: { seconds: number } | null): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [vendors, setVendors] = useState<ProjectVendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(projectDoc(id), async (snap) => {
      if (!snap.exists()) { navigate("/dashboard?tab=projects", { replace: true }); return; }
      const p = snap.data() as Project;
      setProject(p);

      // Load attached vendors
      const vendorSnap = await getDocs(projectVendorsCol(id));
      const rows = await Promise.all(
        vendorSnap.docs.map(async (d) => {
          const [prof, docs] = await Promise.all([
            getVendorProfile(d.id),
            getVendorDocuments(d.id),
          ]);
          if (!prof) return null;
          return { uid: d.id, profile: prof, docs } satisfies ProjectVendorRow;
        })
      );
      setVendors(rows.filter((r): r is ProjectVendorRow => r !== null));
      setLoading(false);
    });
    return unsubscribe;
  }, [id, navigate]);

  async function handleClose() {
    if (!id || !window.confirm("Close this project?")) return;
    setClosing(true);
    await updateProject(id, { status: "closed" });
    setClosing(false);
  }

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="page-container py-lg">
          <p className="text-body-md text-on-surface-variant">Loading…</p>
        </div>
      </div>
    );
  }

  const isPmOwner = profile?.uid === project.pmUid;
  const isActive = project.status === "active";

  return (
    <div className="min-h-screen bg-surface">
      {/* Nav */}
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="page-container flex items-center justify-between h-14">
          <Link to="/dashboard?tab=projects" className="btn-tertiary text-body-sm">
            ← Projects
          </Link>
          {isPmOwner && isActive && (
            <div className="flex gap-sm">
              <button className="btn-secondary" onClick={() => setEditing(!editing)}>
                {editing ? "Cancel" : "Edit"}
              </button>
              <button className="btn-secondary" onClick={handleClose} disabled={closing}>
                {closing ? "Closing…" : "Close Project"}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="page-container py-lg max-w-3xl space-y-lg">
        {/* Project header */}
        {editing ? (
          <EditProjectForm
            project={project}
            projectId={id!}
            onSaved={() => setEditing(false)}
          />
        ) : (
          <header className="space-y-xs">
            <div className="flex items-center gap-sm flex-wrap">
              <h1 className="text-display text-on-surface">{project.name}</h1>
              <span
                className={`status-badge text-body-sm ${
                  isActive
                    ? "bg-primary-container text-on-primary"
                    : "bg-secondary-container text-on-secondary-container"
                }`}
              >
                {isActive ? "Active" : "Closed"}
              </span>
            </div>
            <p className="text-body-md text-on-surface-variant">
              {project.address}
              {project.zipCode ? ` · ${project.zipCode}` : ""}
            </p>
            {(project.startDate || project.endDate) && (
              <p className="text-body-sm text-on-surface-variant">
                {formatDate(project.startDate)} – {formatDate(project.endDate)}
              </p>
            )}
            {project.description && (
              <p className="text-body-md text-on-surface mt-sm">{project.description}</p>
            )}
          </header>
        )}

        {/* Action buttons */}
        {isPmOwner && isActive && (
          <div className="flex gap-sm flex-wrap">
            <Link
              to={`/search?zip=${project.zipCode}`}
              className="btn-primary"
            >
              Find Vendors for This Project
            </Link>
            <button className="btn-secondary" onClick={() => setInviteOpen(true)}>
              Invite by Email
            </button>
          </div>
        )}

        {/* Vendors table */}
        <section>
          <h2 className="text-h1 text-on-surface mb-md">Vendors</h2>
          {vendors.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              No vendors assigned yet.
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
                    <th className="th">Overall Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((row) => (
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
                      <td className="td">
                        <TierBadge tier={computeOverallTier(row.docs)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <LiabilityFooter />
      </div>

      {inviteOpen && id && (
        <InviteVendorModal
          projectId={id}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  );
}

function EditProjectForm({
  project,
  projectId,
  onSaved,
}: {
  project: Project;
  projectId: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [address, setAddress] = useState(project.address);
  const [zip, setZip] = useState(project.zipCode);
  const [description, setDescription] = useState(project.description);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Project name required."); return; }
    if (!/^\d{5}$/.test(zip)) { setError("Valid zip required."); return; }
    setSaving(true);
    setError(null);
    try {
      await updateProject(projectId, { name: name.trim(), address: address.trim(), zipCode: zip, description: description.trim() });
      onSaved();
    } catch { setError("Failed to save."); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-md">
      <h2 className="text-h1 text-on-surface">Edit Project</h2>
      {[
        { label: "Project name", value: name, set: setName, required: true },
        { label: "Address", value: address, set: setAddress, required: false },
        { label: "Zip", value: zip, set: setZip, required: true, max: 5 },
      ].map(({ label, value, set, required, max }) => (
        <div key={label}>
          <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
            {label}{required && <span className="text-error ml-xs">*</span>}
          </label>
          <input className="input" value={value} onChange={(e) => set(e.target.value)} maxLength={max} />
        </div>
      ))}
      <div>
        <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">Description</label>
        <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error && <p className="text-body-sm text-error">{error}</p>}
      <div className="flex gap-sm">
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        <button type="button" className="btn-secondary" onClick={onSaved}>Cancel</button>
      </div>
    </form>
  );
}
