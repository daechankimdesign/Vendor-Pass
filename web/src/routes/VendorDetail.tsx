import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { onSnapshot } from "firebase/firestore";
import {
  vendorDoc,
  vendorDocumentsCol,
  getVendorContact,
} from "../lib/firestore";
import type { VendorPublicProfile, VendorPrivateContact } from "../lib/firestore";
import type { VendorDocument, DocType } from "../lib/docTypes";
import { DOC_TYPE_ORDER, DOC_TYPE_SCHEMAS, computeOverallTier } from "../lib/docTypes";
import { getCategoryLabel } from "../lib/categories";
import TierBadge from "../components/TierBadge";
import LiabilityFooter from "../components/LiabilityFooter";
import { useAuth } from "../contexts/AuthContext";

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile: myProfile } = useAuth();

  const [vendor, setVendor] = useState<VendorPublicProfile | null>(null);
  const [docs, setDocs] = useState<Partial<Record<DocType, VendorDocument>>>({});
  const [contact, setContact] = useState<VendorPrivateContact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const unsubVendor = onSnapshot(vendorDoc(id), (snap) => {
      if (snap.exists()) setVendor(snap.data() as VendorPublicProfile);
      setLoading(false);
    });

    const unsubDocs = onSnapshot(vendorDocumentsCol(id), (snap) => {
      const next: Partial<Record<DocType, VendorDocument>> = {};
      snap.forEach((d) => { next[d.id as DocType] = d.data() as VendorDocument; });
      setDocs(next);
    });

    // Try to fetch contact (succeeds for admin or PMs with relationship)
    getVendorContact(id)
      .then(setContact)
      .catch(() => {});

    return () => { unsubVendor(); unsubDocs(); };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="page-container py-lg">
          <p className="text-body-md text-on-surface-variant">Loading…</p>
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="page-container py-lg">
          <p className="text-body-md text-on-surface-variant">Vendor not found.</p>
        </div>
      </div>
    );
  }

  const overallTier = computeOverallTier(docs);

  const backTo = myProfile?.role === "vendor" ? "/vendor" : "/dashboard?tab=roster";

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="page-container flex items-center h-14">
          <Link to={backTo} className="btn-tertiary text-body-sm">
            ← Back
          </Link>
        </div>
      </header>

      <div className="page-container py-lg max-w-2xl space-y-lg">
        {/* Header */}
        <div className="flex items-start gap-sm flex-wrap">
          <div className="flex-1">
            <h1 className="text-display text-on-surface">{vendor.businessName}</h1>
            <p className="mt-xs text-body-md text-on-surface-variant">
              {vendor.businessZipCode}
            </p>
          </div>
          <TierBadge tier={overallTier} />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-xs">
          {vendor.categories.map((cat) => (
            <span
              key={cat}
              className="bg-surface-container text-on-surface-variant text-body-sm px-sm py-xs rounded"
            >
              {getCategoryLabel(cat)}
            </span>
          ))}
        </div>

        {/* Contact info (if accessible) */}
        {contact && (
          <div className="card space-y-sm">
            <h2 className="text-h2 text-on-surface mb-sm">Contact</h2>
            {contact.contactEmail && (
              <Row label="Email" value={contact.contactEmail} />
            )}
            {contact.phone && (
              <Row label="Phone" value={contact.phone} />
            )}
          </div>
        )}

        {/* Documents */}
        <section>
          <h2 className="text-h1 text-on-surface mb-md">Compliance Documents</h2>
          <div className="space-y-sm">
            {DOC_TYPE_ORDER.map((docType) => {
              const doc = docs[docType];
              return (
                <div key={docType} className="card flex items-center justify-between gap-md">
                  <span className="text-body-md text-on-surface font-semibold">
                    {DOC_TYPE_SCHEMAS[docType].label}
                  </span>
                  {doc ? (
                    <TierBadge tier={doc.tier} />
                  ) : (
                    <span className="text-body-sm text-on-surface-variant">Not uploaded</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <LiabilityFooter />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-md">
      <span className="text-label-caps uppercase text-on-surface-variant w-24 flex-shrink-0">
        {label}
      </span>
      <span className="text-body-md text-on-surface">{value}</span>
    </div>
  );
}
