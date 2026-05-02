import { useState, useEffect, useRef } from "react";
import { onSnapshot, query, orderBy } from "firebase/firestore";
import { projectMessagesCol, sendProjectMessage } from "../lib/firestore";
import type { ChatMessage } from "../lib/firestore";

interface Props {
  projectId: string;
  currentUid: string;
  currentName: string;
  currentRole: "property_manager" | "vendor";
}

export default function ProjectChat({ projectId, currentUid, currentName, currentRole }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(projectMessagesCol(projectId), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, "id">),
        }))
      );
    });
    return unsub;
  }, [projectId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText("");
    try {
      await sendProjectMessage(projectId, currentUid, currentName, currentRole, trimmed);
    } finally {
      setSending(false);
    }
  }

  function formatTime(ts: ChatMessage["createdAt"]): string {
    if (!ts) return "";
    return new Date(ts.seconds * 1000).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="flex flex-col border border-outline-variant rounded overflow-hidden bg-surface-container-lowest" style={{ height: "360px" }}>
      {/* Header */}
      <div className="px-md py-sm border-b border-outline-variant bg-surface-container">
        <p className="text-label-caps uppercase text-on-surface-variant">Project Chat</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-md py-sm space-y-sm">
        {messages.length === 0 && (
          <p className="text-body-sm text-on-surface-variant text-center py-lg">
            No messages yet. Start the conversation.
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderUid === currentUid;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs lg:max-w-sm ${isMine ? "items-end" : "items-start"} flex flex-col gap-xs`}>
                {!isMine && (
                  <p className="text-body-sm font-semibold text-on-surface-variant px-xs">
                    {msg.senderName}
                  </p>
                )}
                <div
                  className={`px-md py-sm rounded-lg text-body-md ${
                    isMine
                      ? "bg-primary-container text-on-surface rounded-br-none"
                      : "bg-surface-container text-on-surface rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </div>
                <p className="text-body-sm text-on-surface-variant px-xs">
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="border-t border-outline-variant px-md py-sm flex gap-sm bg-surface"
      >
        <input
          className="input flex-1"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={sending}
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn-primary px-md flex-shrink-0"
          disabled={!text.trim() || sending}
        >
          Send
        </button>
      </form>
    </div>
  );
}
