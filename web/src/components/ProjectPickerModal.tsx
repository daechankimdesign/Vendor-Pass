import { useState, useEffect, useRef } from "react";
import { X, File, Paperclip, CheckCircle } from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { getPmProjects, createProject, createInvite } from "../lib/firestore";
import { useAuth } from "../contexts/AuthContext";
import type { Project, CreateInviteOptions } from "../lib/firestore";

interface Props {
  vendorUid: string;
  vendorEmail?: string;
  onClose: () => void;
  onInvited?: () => void;
}

type View = "pick" | "new" | "compose" | "sent";

export default function ProjectPickerModal({ vendorUid, vendorEmail, onClose, onInvited }: Props) {
  const { profile } = useAuth();
  const [view, setView] = useState<View>("pick");
  const [projects, setProjects] = useState<Array<Project & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Compose step
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleSend() {
    if (!profile || !selectedProjectId) return;
    setSending(true);
    setError(null);
    try {
      // Upload attachments first
      let attachmentUrls: string[] = [];
      if (files.length > 0) {
        attachmentUrls = await Promise.all(
          files.map(async (file) => {
            const path = `inviteAttachments/${profile.uid}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, file);
            return getDownloadURL(storageRef);
          })
        );
      }

      const project = projects.find((p) => p.id === selectedProjectId);
      const opts: CreateInviteOptions = {
        pmUid: profile.uid,
        vendorUid,
        vendorEmail: vendorEmail ?? "",
        projectId: selectedProjectId,
        source: "search",
        pmDisplayName: profile.displayName,
        pmCompanyName: profile.companyName ?? "",
        pmEmail: profile.email,
        pmPhone: profile.phone ?? "",
        projectName: project?.name ?? "",
        projectAddress: project?.address ?? "",
        projectZip: project?.zipCode ?? "",
        projectDescription: project?.description ?? "",
        note: note.trim() || undefined,
        attachmentUrls: attachmentUrls.length > 0 ? attachmentUrls : undefined,
      };
      await createInvite(opts);
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const added = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...added]);
    // Reset input so the same file can be re-added after removal
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const TITLE: Record<View, string> = {
    pick: "Select Project",
    new: "New Project",
    compose: "Add a Note",
    sent: "Quote Request Sent",
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="flex items-center justify-between mb-lg">
          <h2 className="text-h1 text-on-surface">{TITLE[view]}</h2>
          <button
            className="text-on-surface-variant hover:text-on-surface"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        {/* ── Sent ── */}
        {view === "sent" && (
          <div className="space-y-md text-center py-md">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary-container mx-auto">
              <CheckCircle size={28} aria-hidden className="text-on-primary" />
            </div>
            <div>
              <p className="text-h2 text-on-surface">Quote request sent!</p>
              {selectedProject && (
                <p className="text-body-sm text-on-surface-variant mt-xs">
                  Your quote request for <span className="font-semibold text-on-surface">{selectedProject.name}</span> has been sent.
                </p>
              )}
              {note && (
                <p className="text-body-sm text-on-surface-variant mt-xs">
                  Your note and{files.length > 0 ? ` ${files.length} attachment${files.length > 1 ? "s" : ""}` : " message"} were included.
                </p>
              )}
            </div>
            <button className="btn-primary w-full" onClick={onClose}>Done</button>
          </div>
        )}

        {/* ── New project form ── */}
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

        {/* ── Pick project ── */}
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

            <div className="flex gap-sm">
              <button
                className="btn-primary flex-1"
                disabled={!selectedProjectId}
                onClick={() => setView("compose")}
              >
                Next
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Compose (note + attachments) ── */}
        {view === "compose" && (
          <div className="space-y-md">
            {/* Selected project summary */}
            {selectedProject && (
              <div className="flex items-center justify-between p-sm rounded bg-surface-container-low border border-outline-variant">
                <div>
                  <p className="text-body-sm font-semibold text-on-surface">{selectedProject.name}</p>
                  {selectedProject.zipCode && (
                    <p className="text-body-sm text-on-surface-variant">{selectedProject.zipCode}</p>
                  )}
                </div>
                <button
                  className="btn-tertiary text-body-sm"
                  onClick={() => setView("pick")}
                >
                  Change
                </button>
              </div>
            )}

            {/* Note */}
            <div>
              <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
                Note to vendor
              </label>
              <textarea
                className="input w-full"
                rows={4}
                placeholder="Introduce yourself, describe the scope of work, timeline, or any special requirements…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-label-caps uppercase text-on-surface-variant mb-xs">
                Attachments <span className="text-on-surface-variant normal-case text-body-sm ml-xs">(optional)</span>
              </label>

              {files.length > 0 && (
                <ul className="space-y-xs mb-sm">
                  {files.map((file, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-sm p-xs rounded bg-surface-container border border-outline-variant"
                    >
                      <div className="flex items-center gap-xs min-w-0">
                        <File size={14} aria-hidden className="flex-shrink-0 text-on-surface-variant" />
                        <span className="text-body-sm text-on-surface truncate">{file.name}</span>
                        <span className="text-body-sm text-on-surface-variant flex-shrink-0">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-on-surface-variant hover:text-error flex-shrink-0"
                        onClick={() => removeFile(i)}
                        aria-label="Remove file"
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                className="btn-secondary text-body-sm flex items-center gap-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip size={14} aria-hidden /> Attach files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={handleFileChange}
              />
              <p className="text-body-sm text-on-surface-variant mt-xs">
                PDF, images, Word, or Excel files
              </p>
            </div>

            {error && <p className="text-body-sm text-error">{error}</p>}

            <div className="flex gap-sm">
              <button
                className="btn-primary flex-1"
                disabled={sending}
                onClick={handleSend}
              >
                {sending ? "Sending…" : "Send Quote Request"}
              </button>
              <button className="btn-secondary" onClick={() => setView("pick")}>
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

