import { useState, useEffect } from "react";
import { getPmProjects, createProject, createInvite } from "../lib/firestore";
import { useAuth } from "../contexts/AuthContext";
import type { Project } from "../lib/firestore";

interface Props {
  vendorUid: string;
  vendorEmail?: string;
  onClose: () => void;
  onInvited?: () => void;
}

type View = "pick" | "new" | "sent";

export default function ProjectPickerModal({ vendorUid, vendorEmail, onClose, onInvited }: Props) {
  const { profile } = useAuth();
  const [view, setView] = useState<View>("pick");
  const [projects, setProjects] = useState<Array<Project & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New project form
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newZip, setNewZip] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    getPmProjects(profile.uid)
      .then((p) => setProjects(p.filter((proj) => proj.status === "active")))
      .finally(() => setLoading(false));
  }, [profile]);

  async function handleInvite() {
    if (!profile || !selectedProjectId) return;
    setSending(true);
    setError(null);
    try {
      await createInvite(
        profile.uid,
        vendorUid,
        vendorEmail ?? "",
        selectedProjectId,
        "search"
      );
      setView("sent");
      onInvited?.();
    } catch (err) {
      setError("Failed to send invite. Please try again.");
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!newName.trim()) { setCreateError("Project name is required."); return; }
    if (!/^\d{5}$/.test(newZip)) { setCreateError("Enter a valid 5-digit zip code."); return; }

    setCreating(true);
    setCreateError(null);
    try {
      const id = await createProject(profile.uid, {
        name: newName.trim(),
        address: newAddress.trim(),
        zipCode: newZip.trim(),
        status: "active",
        startDate: null,
        endDate: null,
        description: "",
      });
      const newProject = {
        id,
        pmUid: profile.uid,
        name: newName.trim(),
        address: newAddress.trim(),
        zipCode: newZip.trim(),
        status: "active" as const,
        startDate: null,
        endDate: null,
        description: "",
        createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as never,
      };
      setProjects((prev) => [newProject, ...prev]);
      setSelectedProjectId(id);
      setView("pick");
    } catch {
      setCreateError("Failed to create project. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="flex items-center justify-between mb-lg">
          <h2 className="text-h1 text-on-surface">
            {view === "new" ? "New Project" : view === "sent" ? "Invite Sent" : "Select Project"}
          </h2>
          <button
            className="text-on-surface-variant hover:text-on-surface"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {view === "sent" && (
          <div className="space-y-md">
            <p className="text-body-md text-on-surface">Invite sent successfully.</p>
            <button className="btn-secondary w-full" onClick={onClose}>Close</button>
          </div>
        )}

        {view === "new" && (
          <form onSubmit={handleCreateProject} className="space-y-md">
            <div>
              <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
                Project name <span className="text-error">*</span>
              </label>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
                Address
              </label>
              <input className="input" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
            </div>
            <div>
              <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
                Zip code <span className="text-error">*</span>
              </label>
              <input className="input" maxLength={5} value={newZip} onChange={(e) => setNewZip(e.target.value)} />
            </div>
            {createError && <p className="text-body-sm text-error">{createError}</p>}
            <div className="flex gap-sm">
              <button type="submit" className="btn-primary flex-1" disabled={creating}>
                {creating ? "Creating…" : "Create & Select"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setView("pick")}>
                Back
              </button>
            </div>
          </form>
        )}

        {view === "pick" && (
          <div className="space-y-md">
            {loading ? (
              <p className="text-body-sm text-on-surface-variant">Loading projects…</p>
            ) : projects.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">
                No active projects.{" "}
                <button className="btn-tertiary" onClick={() => setView("new")}>
                  Create one
                </button>
              </p>
            ) : (
              <div className="space-y-xs max-h-64 overflow-y-auto">
                {projects.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-sm p-sm rounded border cursor-pointer transition-colors ${
                      selectedProjectId === p.id
                        ? "border-primary-container bg-surface-container-low"
                        : "border-tier-1-border hover:bg-surface-container-low"
                    }`}
                  >
                    <input
                      type="radio"
                      name="project"
                      value={p.id}
                      checked={selectedProjectId === p.id}
                      onChange={() => setSelectedProjectId(p.id)}
                      className="accent-primary-container"
                    />
                    <div className="min-w-0">
                      <p className="text-body-md text-on-surface">{p.name}</p>
                      {p.zipCode && (
                        <p className="text-body-sm text-on-surface-variant">{p.zipCode}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            <button className="btn-tertiary text-body-sm" onClick={() => setView("new")}>
              + New Project
            </button>

            {error && <p className="text-body-sm text-error">{error}</p>}

            <div className="flex gap-sm">
              <button
                className="btn-primary flex-1"
                disabled={!selectedProjectId || sending}
                onClick={handleInvite}
              >
                {sending ? "Sending…" : "Invite to Project"}
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
