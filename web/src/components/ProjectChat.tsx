import { useState, useEffect, useRef } from "react";
import { onSnapshot, query, orderBy } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import {
  projectMessagesCol,
  sendProjectMessage,
  sendQuoteMessage,
  respondToQuote,
  counterQuote,
} from "../lib/firestore";
import type { ChatMessage, ChatAttachment } from "../lib/firestore";
import {
  Paperclip,
  DollarSign,
  Send,
  X,
  Plus,
  File,
  Film,
  CheckCircle,
  XCircle,
  ArrowLeftRight,
} from "lucide-react";


interface Props {
  projectId: string;
  projectName?: string;
  currentUid: string;
  currentName: string;
  currentRole: "property_manager" | "vendor";
  variant?: "embedded" | "full";
}

interface StagedFile {
  file: File;
  previewUrl?: string;
}

export default function ProjectChat({
  projectId,
  projectName,
  currentUid,
  currentName,
  currentRole,
  variant = "embedded",
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [showActions, setShowActions] = useState(false);
  const [showQuoteComposer, setShowQuoteComposer] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [counteringId, setCounteringId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [counterNote, setCounterNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(projectMessagesCol(projectId), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, "id">) }))
      );
    });
    return unsub;
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      stagedFiles.forEach((sf) => { if (sf.previewUrl) URL.revokeObjectURL(sf.previewUrl); });
    };
  }, [stagedFiles]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const added: StagedFile[] = Array.from(e.target.files).map((file) => ({
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setStagedFiles((prev) => [...prev, ...added]);
    e.target.value = "";
  }

  function removeStagedFile(index: number) {
    setStagedFiles((prev) => {
      const next = [...prev];
      if (next[index].previewUrl) URL.revokeObjectURL(next[index].previewUrl!);
      next.splice(index, 1);
      return next;
    });
  }

  async function uploadFiles(files: StagedFile[]): Promise<ChatAttachment[]> {
    return Promise.all(
      files.map(async ({ file }) => {
        const path = `chatAttachments/${projectId}/${Date.now()}_${file.name}`;
        const sRef = storageRef(storage, path);
        await uploadBytes(sRef, file);
        const url = await getDownloadURL(sRef);
        return { name: file.name, url, mimeType: file.type, size: file.size };
      })
    );
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && stagedFiles.length === 0) || sending) return;
    setSending(true);
    const filesToUpload = [...stagedFiles];
    setText("");
    setStagedFiles([]);
    try {
      const attachments = filesToUpload.length > 0 ? await uploadFiles(filesToUpload) : undefined;
      await sendProjectMessage(projectId, currentUid, currentName, currentRole, trimmed, attachments);
    } finally {
      setSending(false);
    }
  }

  async function handleSendQuote(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(quoteAmount);
    if (isNaN(amount) || amount <= 0 || sending) return;
    setSending(true);
    try {
      await sendQuoteMessage(projectId, currentUid, currentName, currentRole, amount, quoteNote.trim());
      setShowQuoteComposer(false);
      setQuoteAmount("");
      setQuoteNote("");
    } finally {
      setSending(false);
    }
  }

  async function handleAccept(msg: ChatMessage) {
    await respondToQuote(projectId, msg.id, "accepted", currentUid);
  }

  async function handleDecline(msg: ChatMessage) {
    await respondToQuote(projectId, msg.id, "declined", currentUid);
  }

  async function handleCounter(msg: ChatMessage) {
    const amount = parseFloat(counterAmount);
    if (isNaN(amount) || amount <= 0) return;
    setSending(true);
    try {
      await counterQuote(projectId, msg.id, currentUid, currentName, currentRole, amount, counterNote.trim());
      setCounteringId(null);
      setCounterAmount("");
      setCounterNote("");
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

  function formatCurrency(amount: number): string {
    return amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function AttachmentPreview({ att }: { att: ChatAttachment }) {
    const isImage = att.mimeType.startsWith("image/");
    const isVideo = att.mimeType.startsWith("video/");
    if (isImage) {
      return (
        <a href={att.url} target="_blank" rel="noopener noreferrer" className="block mt-xs">
          <img
            src={att.url}
            alt={att.name}
            className="max-w-full max-h-48 rounded object-contain border border-outline-variant"
          />
        </a>
      );
    }
    if (isVideo) {
      return (
        <video
          src={att.url}
          controls
          className="max-w-full max-h-48 rounded mt-xs border border-outline-variant"
        />
      );
    }
    return (
      <a
        href={att.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-xs mt-xs px-sm py-xs rounded border border-outline-variant bg-surface hover:bg-surface-container transition-colors"
      >
        <File size={14} aria-hidden className="flex-shrink-0 text-on-surface-variant" />
        <span className="text-body-sm text-on-surface truncate">{att.name}</span>
        <span className="text-body-sm text-on-surface-variant flex-shrink-0 ml-auto">
          {(att.size / 1024).toFixed(0)} KB
        </span>
      </a>
    );
  }

  function QuoteCard({ msg }: { msg: ChatMessage }) {
    const q = msg.quote!;
    const isMine = msg.senderUid === currentUid;
    const canRespond = !isMine && q.status === "pending";
    const isCountering = counteringId === msg.id;

    const statusBadge = () => {
      if (q.status === "accepted") return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <CheckCircle size={12} aria-hidden /> Accepted
        </span>
      );
      if (q.status === "declined") return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500">
          <XCircle size={12} aria-hidden /> Declined
        </span>
      );
      if (q.status === "countered") return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
          <ArrowLeftRight size={12} aria-hidden /> Countered · {formatCurrency(q.counterAmount ?? 0)}
        </span>
      );
      return null;
    };

    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden w-52">
        <div className="px-4 pt-3 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
            {projectName ?? "Quote"}
          </p>
          <p className="text-3xl font-bold text-gray-900 leading-none">
            {formatCurrency(q.amount)}
          </p>
          {q.description && (
            <p className="text-xs text-gray-500 mt-1">{q.description}</p>
          )}
          {statusBadge() && (
            <div className="mt-2">{statusBadge()}</div>
          )}
        </div>

        {canRespond && !isCountering && (
          <div className="px-3 pb-3 flex gap-2">
            <button
              onClick={() => handleAccept(msg)}
              className="flex-1 bg-gray-900 text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => handleDecline(msg)}
              className="flex-1 border border-gray-200 text-gray-600 text-xs font-semibold py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Decline
            </button>
            <button
              onClick={() => { setCounteringId(msg.id); setCounterAmount(""); setCounterNote(""); }}
              className="flex-1 border border-gray-200 text-gray-600 text-xs font-semibold py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Counter
            </button>
          </div>
        )}

        {isCountering && (
          <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-2">
            <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1 bg-gray-50">
              <span className="text-xs text-gray-400 font-semibold">$</span>
              <input
                type="number"
                min="1"
                placeholder="Your amount"
                value={counterAmount}
                onChange={(e) => setCounterAmount(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder-gray-400"
                autoFocus
              />
            </div>
            <input
              type="text"
              placeholder="Note (optional)"
              value={counterNote}
              onChange={(e) => setCounterNote(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 text-sm text-gray-900 outline-none placeholder-gray-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleCounter(msg)}
                disabled={!counterAmount || sending}
                className="flex-1 bg-gray-900 text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                Send Counter
              </button>
              <button
                onClick={() => setCounteringId(null)}
                className="border border-gray-200 text-gray-600 text-xs font-semibold py-1.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col overflow-hidden bg-surface-container-lowest ${
        variant === "full" ? "h-full" : "border border-outline-variant rounded"
      }`}
      style={variant === "embedded" ? { height: "360px" } : undefined}
    >
      {variant === "embedded" && (
        <div className="px-md py-sm border-b border-outline-variant bg-surface-container">
          <p className="text-label-caps uppercase text-on-surface-variant">Project Chat</p>
        </div>
      )}

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
              <div className={`max-w-xs lg:max-w-sm flex flex-col gap-xs ${isMine ? "items-end" : "items-start"}`}>
                {!isMine && (
                  <p className="text-body-sm font-semibold text-on-surface-variant px-xs">
                    {msg.senderName}
                  </p>
                )}

                {msg.type === "quote" ? (
                  <QuoteCard msg={msg} />
                ) : (
                  <div
                    className={`px-md py-sm rounded-2xl text-body-md max-w-full ${
                      isMine
                        ? "bg-primary text-white rounded-br-sm"
                        : "bg-surface-container text-on-surface rounded-bl-sm"
                    }`}
                  >
                    {msg.text && <p>{msg.text}</p>}
                    {msg.attachments?.map((att, i) => (
                      <AttachmentPreview key={i} att={att} />
                    ))}
                  </div>
                )}

                <p className="text-body-sm text-on-surface-variant px-xs">
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Quote composer panel */}
      {showQuoteComposer && (
        <form
          onSubmit={handleSendQuote}
          className="border-t border-outline-variant px-md py-sm bg-surface-container space-y-sm"
        >
          <div className="flex items-center justify-between">
            <p className="text-label-caps uppercase text-on-surface-variant text-xs">Send Quote</p>
            <button
              type="button"
              onClick={() => setShowQuoteComposer(false)}
              className="text-on-surface-variant hover:text-on-surface"
              aria-label="Close quote composer"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <div className="flex items-center gap-xs">
            <span className="text-body-md text-on-surface-variant font-semibold">$</span>
            <input
              type="number"
              min="1"
              placeholder="Amount"
              value={quoteAmount}
              onChange={(e) => setQuoteAmount(e.target.value)}
              className="input flex-1"
              autoFocus
              required
            />
          </div>
          <input
            type="text"
            placeholder="Description (optional)"
            value={quoteNote}
            onChange={(e) => setQuoteNote(e.target.value)}
            className="input w-full"
          />
          <div className="flex gap-sm">
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={!quoteAmount || sending}
            >
              {sending ? "Sending…" : "Send Quote"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowQuoteComposer(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Staged file previews */}
      {stagedFiles.length > 0 && (
        <div className="border-t border-outline-variant px-md py-xs bg-surface flex gap-xs flex-wrap">
          {stagedFiles.map((sf, i) => (
            <div
              key={i}
              className="relative flex items-center gap-xs px-xs py-xs rounded border border-outline-variant bg-surface-container text-body-sm text-on-surface max-w-xs"
            >
              {sf.previewUrl ? (
                <img src={sf.previewUrl} alt={sf.file.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
              ) : sf.file.type.startsWith("video/") ? (
                <Film size={16} aria-hidden className="flex-shrink-0 text-on-surface-variant" />
              ) : (
                <File size={16} aria-hidden className="flex-shrink-0 text-on-surface-variant" />
              )}
              <span className="truncate max-w-24">{sf.file.name}</span>
              <button
                type="button"
                onClick={() => removeStagedFile(i)}
                className="flex-shrink-0 text-on-surface-variant hover:text-error"
                aria-label="Remove file"
              >
                <X size={12} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="border-t border-outline-variant px-3 py-2 flex gap-2 bg-surface items-center"
      >
        {/* + toggle → reveals action circles */}
        <button
          type="button"
          onClick={() => setShowActions((v) => !v)}
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label={showActions ? "Close actions" : "Open actions"}
        >
          {showActions
            ? <X size={16} aria-hidden />
            : <Plus size={16} aria-hidden />}
        </button>

        {/* Action circles — visible when expanded */}
        {showActions && (
          <>
            <button
              type="button"
              onClick={() => { fileInputRef.current?.click(); setShowActions(false); }}
              className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0 text-on-surface-variant hover:text-on-surface transition-colors"
              title="Attach files"
              aria-label="Attach files"
            >
              <Paperclip size={15} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => { setShowQuoteComposer(true); setShowActions(false); }}
              className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0 text-on-surface-variant hover:text-on-surface transition-colors"
              title="Send a quote"
              aria-label="Send a quote"
            >
              <DollarSign size={15} aria-hidden />
            </button>
          </>
        )}

        {/* Bare text input — no border, no background */}
        <input
          className="flex-1 bg-transparent outline-none text-body-md text-on-surface placeholder:text-on-surface-variant min-w-0"
          placeholder="Message…"
          value={text}
          onChange={(e) => { setText(e.target.value); if (showActions) setShowActions(false); }}
          disabled={sending}
          autoComplete="off"
        />

        {/* Send — icon only, colored when active */}
        <button
          type="submit"
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
            (!text.trim() && stagedFiles.length === 0) || sending
              ? "text-on-surface-variant opacity-30"
              : "text-primary hover:opacity-80"
          }`}
          disabled={(!text.trim() && stagedFiles.length === 0) || sending}
          aria-label="Send"
        >
          <Send size={16} aria-hidden />
        </button>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
