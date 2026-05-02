import { Link } from "react-router-dom";

export default function Terms() {
  return (
    <div className="min-h-screen bg-surface py-xl">
      <div className="page-container max-w-2xl">
        <Link to="/" className="btn-tertiary text-body-sm mb-lg inline-block">
          ← Back
        </Link>
        <h1 className="text-display text-on-surface mb-lg">Terms of Service</h1>
        <div className="space-y-md text-body-md text-on-surface">
          <p className="bg-error-container text-on-error-container px-sm py-xs rounded text-body-sm font-semibold">
            TODO: legal review
          </p>
          <p>
            Compliance Roster is a document-tracking facilitator. We do not underwrite insurance,
            validate license authenticity, or assume liability for vendor-submitted information.
          </p>
          <p>Full legal terms will be provided upon product launch.</p>
        </div>
      </div>
    </div>
  );
}
