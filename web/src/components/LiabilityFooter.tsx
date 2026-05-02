import { Link } from "react-router-dom";

/** Persistent liability disclaimer — required on PM dashboard, vendor dashboard, search, and onboarding. */
export default function LiabilityFooter() {
  return (
    <footer className="mt-xl pt-lg border-t border-outline-variant">
      <p className="text-body-sm text-on-surface-variant">
        VendorPass is a document-tracking facilitator. We do not underwrite insurance,
        validate license authenticity, or assume liability for vendor-submitted information.{" "}
        <Link to="/terms" className="underline underline-offset-2 hover:text-on-surface">
          Terms
        </Link>
      </p>
    </footer>
  );
}
