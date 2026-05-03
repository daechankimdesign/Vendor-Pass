import { useState, useEffect } from "react";
import { Search, ChevronLeft, MessageSquare } from "lucide-react";
import { getPmProjects, getVendorProjects } from "../lib/firestore";
import ProjectChat from "./ProjectChat";

interface Conversation {
  projectId: string;
  projectName: string;
}

interface Props {
  currentUid: string;
  currentName: string;
  currentRole: "property_manager" | "vendor";
  initialProjectId?: string | null;
}

export default function MessagesTab({ currentUid, currentName, currentRole, initialProjectId }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialProjectId ?? null);
  const [loading, setLoading] = useState(true);
  const [mobileShowChat, setMobileShowChat] = useState(!!initialProjectId);

  useEffect(() => {
    if (!currentUid) return;
    setLoading(true);
    const fetch = currentRole === "property_manager"
      ? getPmProjects(currentUid)
      : getVendorProjects(currentUid);
    fetch.then((projects) => {
      setConversations(
        [...projects]
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
          .map((p) => ({ projectId: p.id, projectName: p.name }))
      );
      setLoading(false);
    });
  }, [currentUid, currentRole]);

  useEffect(() => {
    if (initialProjectId) {
      setSelectedId(initialProjectId);
      setMobileShowChat(true);
    }
  }, [initialProjectId]);

  const selected = conversations.find((c) => c.projectId === selectedId);

  return (
    <div className="flex h-full">
      {/* Conversation list */}
      <div className={`${mobileShowChat ? "hidden sm:flex" : "flex"} flex-col w-full sm:w-72 flex-shrink-0 border-r border-outline-variant bg-surface-container-lowest overflow-hidden`}>
        <div className="px-md py-sm border-b border-outline-variant flex-shrink-0">
          <div className="relative">
            <Search
              size={14}
              aria-hidden
              className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search conversations…"
              className="input w-full pl-lg text-body-sm"
              readOnly
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-body-sm text-on-surface-variant p-md">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant p-md italic">No active projects yet.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.projectId}
                onClick={() => { setSelectedId(c.projectId); setMobileShowChat(true); }}
                className={`w-full flex items-center gap-sm px-md py-md border-b border-outline-variant text-left transition-colors ${
                  selectedId === c.projectId ? "bg-primary-fixed" : "hover:bg-surface-container"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-white font-bold text-body-md uppercase select-none">
                  {c.projectName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-body-md font-semibold truncate ${selectedId === c.projectId ? "text-on-primary-fixed" : "text-on-surface"}`}>
                    {c.projectName}
                  </p>
                  <p className={`text-body-sm ${selectedId === c.projectId ? "text-on-primary-fixed-variant" : "text-on-surface-variant"}`}>
                    Project chat
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div className={`${mobileShowChat ? "flex" : "hidden sm:flex"} flex-1 flex-col min-w-0 bg-surface overflow-hidden`}>
        {selected ? (
          <>
            <div className="px-md py-sm border-b border-outline-variant bg-surface-container-lowest flex items-center gap-sm flex-shrink-0">
              <button
                className="sm:hidden text-on-surface-variant hover:text-on-surface p-xs -ml-xs"
                onClick={() => setMobileShowChat(false)}
                aria-label="Back"
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
              <div className="w-9 h-9 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-white font-bold uppercase select-none">
                {selected.projectName.charAt(0)}
              </div>
              <div>
                <p className="text-body-md font-semibold text-on-surface">{selected.projectName}</p>
                <p className="text-body-sm text-on-surface-variant">Project chat</p>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ProjectChat
                projectId={selected.projectId}
                projectName={selected.projectName}
                currentUid={currentUid}
                currentName={currentName}
                currentRole={currentRole}
                variant="full"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-lg">
              <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-md">
                <MessageSquare size={28} aria-hidden className="text-on-surface-variant" />
              </div>
              <p className="text-body-md text-on-surface font-semibold">Select a conversation</p>
              <p className="text-body-sm text-on-surface-variant mt-xs">
                Choose a project from the list to view its chat.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
