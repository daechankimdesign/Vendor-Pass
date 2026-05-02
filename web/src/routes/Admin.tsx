import { useState, useEffect } from "react";
import { collectionGroup, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { adminPromoteDocument, getVendorProfile } from "../lib/firestore";
import type { VendorPublicProfile } from "../lib/firestore";
import type { VendorDocument, DocType } from "../lib/docTypes";
import { DOC_TYPE_SCHEMAS } from "../lib/docTypes";
import TierBadge from "../components/TierBadge";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";

interface ReviewItem {
  vendorUid: string;
  docType: DocType;
  document: VendorDocument;
  vendor: VendorPublicProfile | null;
}

export default function Admin() {
  const { logOut } = useAuth();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // Query documents subcollection group for self_verified, not yet adminReviewed
      const snap = await getDocs(
        query(
          collectionGroup(db, "documents"),
          where("tier", "==", "self_verified"),
          where("adminReviewed", "==", false)
        )
      );

      const results = await Promise.all(
        snap.docs.map(async (d) => {
          const pathParts = d.ref.path.split("/");
          const vendorUid = pathParts[1];
          const docType = d.id as DocType;
          const [vendor] = await Promise.all([getVendorProfile(vendorUid)]);
          return {
            vendorUid,
            docType,
            document: d.data() as VendorDocument,
            vendor,
          } satisfies ReviewItem;
        })
      );

      setItems(results);
      setLoading(false);
    }
    load();
  }, []);

  async function handlePromote(vendorUid: string, docType: DocType) {
    const key = `${vendorUid}:${docType}`;
    setPromoting(key);
    try {
      await adminPromoteDocument(vendorUid, docType);
      setItems((prev) => prev.filter((i) => !(i.vendorUid === vendorUid && i.docType === docType)));
    } finally {
      setPromoting(null);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="page-container flex items-center justify-between h-14">
          <span className="text-h2 text-on-surface">Admin — Compliance Roster</span>
          <button className="btn-tertiary text-body-sm" onClick={logOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="page-container py-lg max-w-4xl">
        <h1 className="text-display text-on-surface mb-lg">Documents Pending Review</h1>

        {loading ? (
          <p className="text-body-md text-on-surface-variant">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">No documents pending review.</p>
        ) : (
          <div className="space-y-lg">
            {items.map((item) => {
              const key = `${item.vendorUid}:${item.docType}`;
              const schema = DOC_TYPE_SCHEMAS[item.docType];

              return (
                <div key={key} className="card space-y-md">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-md flex-wrap">
                    <div>
                      <Link
                        to={`/vendors/${item.vendorUid}`}
                        className="text-h2 text-primary hover:underline"
                      >
                        {item.vendor?.businessName ?? item.vendorUid}
                      </Link>
                      <div className="mt-xs flex items-center gap-sm">
                        <span className="text-body-md text-on-surface-variant">
                          {schema.label}
                        </span>
                        <TierBadge tier="self_verified" />
                      </div>
                    </div>
                    <div className="flex gap-sm items-start">
                      {item.document.storagePath && (
                        <a
                          href={`https://storage.googleapis.com/${item.document.storagePath}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary text-body-sm"
                        >
                          View file ↗
                        </a>
                      )}
                      <button
                        className="btn-primary"
                        disabled={promoting === key}
                        onClick={() => handlePromote(item.vendorUid, item.docType)}
                      >
                        {promoting === key ? "Promoting…" : "Promote to Verified"}
                      </button>
                    </div>
                  </div>

                  {/* Extracted fields */}
                  <div className="border-t border-tier-1-border pt-md">
                    <p className="text-label-caps uppercase text-on-surface-variant mb-sm">
                      Extracted Fields
                    </p>
                    <div className="grid grid-cols-2 gap-sm">
                      {schema.fields.map((field) => {
                        const extracted = item.document.extractedFields?.[field.key];
                        return (
                          <div key={field.key}>
                            <p className="text-label-caps uppercase text-on-surface-variant">
                              {field.label}
                            </p>
                            <p
                              className={`text-body-md text-on-surface mt-xs ${
                                field.mono ? "font-mono" : ""
                              } ${!extracted?.value ? "text-on-surface-variant italic" : ""}`}
                            >
                              {extracted?.value ?? "—"}
                            </p>
                            {extracted?.confidence !== undefined && extracted.confidence < 0.8 && (
                              <p className="text-body-sm text-on-surface-variant">
                                Low confidence: {Math.round(extracted.confidence * 100)}%
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
