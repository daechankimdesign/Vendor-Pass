import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";

const db = admin.firestore();
const appUrl = defineString("APP_URL", { default: "https://vendorpass.web.app" });
const sendgridApiKey = defineString("SENDGRID_API_KEY", { default: "" });

interface SendInvitePayload {
  pmUid: string;
  vendorEmail: string;
  projectId: string;
  source: "search" | "email";
  vendorUid?: string;
}

/**
 * Callable function: creates an invite doc and queues an email.
 *
 * Branch A — vendor account exists: invite status = 'pending', email notifies vendor.
 * Branch B — no account: invite status = 'pending_signup', email includes signup link with ?invite=.
 */
export const sendInvite = onCall(
  { invoker: "public" },
  async (request: CallableRequest<SendInvitePayload>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { pmUid, vendorEmail, projectId, source, vendorUid: explicitVendorUid } =
      request.data;

    if (request.auth.uid !== pmUid) {
      throw new HttpsError("permission-denied", "pmUid mismatch.");
    }

    const pmSnap = await db.collection("users").doc(pmUid).get();
    if (pmSnap.data()?.role !== "property_manager") {
      throw new HttpsError("permission-denied", "Only property managers can send invites.");
    }

    const projectSnap = await db.collection("projects").doc(projectId).get();
    if (!projectSnap.exists || projectSnap.data()?.pmUid !== pmUid) {
      throw new HttpsError("not-found", "Project not found or access denied.");
    }

    const pmName = pmSnap.data()?.displayName ?? "A property manager";
    const projectName = projectSnap.data()?.name ?? "a project";

    let resolvedVendorUid: string | null = explicitVendorUid ?? null;
    let resolvedVendorEmail = vendorEmail?.trim().toLowerCase() ?? "";

    if (!resolvedVendorUid) {
      try {
        const userRecord = await admin.auth().getUserByEmail(resolvedVendorEmail);
        resolvedVendorUid = userRecord.uid;
      } catch {
        resolvedVendorUid = null;
      }
    } else if (!resolvedVendorEmail) {
      try {
        const userRecord = await admin.auth().getUser(resolvedVendorUid);
        resolvedVendorEmail = userRecord.email?.toLowerCase() ?? "";
      } catch {
        throw new HttpsError("not-found", "Vendor account not found.");
      }
    }

    if (!resolvedVendorEmail) {
      throw new HttpsError("invalid-argument", "vendorEmail is required.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    );

    if (resolvedVendorUid) {
      // Branch A: vendor account exists
      const inviteRef = db.collection("invites").doc();
      await inviteRef.set({
        pmUid,
        vendorUid: resolvedVendorUid,
        vendorEmail: resolvedVendorEmail,
        projectId,
        status: "pending",
        source,
        createdAt: now,
        expiresAt,
      });

      await queueEmail({
        to: resolvedVendorEmail,
        subject: `${pmName} invited you to a project on VendorPass`,
        text: `${pmName} has invited you to project "${projectName}" on VendorPass. Log in to accept or decline: ${appUrl.value()}`,
        inviteId: inviteRef.id,
      });

      return { inviteId: inviteRef.id, status: "pending" };
    } else {
      // Branch B: no account — pending_signup
      const inviteRef = db.collection("invites").doc();
      await inviteRef.set({
        pmUid,
        vendorEmail: resolvedVendorEmail,
        projectId,
        status: "pending_signup",
        source,
        createdAt: now,
        expiresAt,
      });

      const signupLink = `${appUrl.value()}/signup?invite=${inviteRef.id}`;
      await queueEmail({
        to: resolvedVendorEmail,
        subject: `${pmName} invited you to join VendorPass`,
        text: `${pmName} has invited you to join VendorPass for project "${projectName}". Sign up here: ${signupLink}`,
        inviteId: inviteRef.id,
      });

      return { inviteId: inviteRef.id, status: "pending_signup" };
    }
  }
);

async function queueEmail(params: {
  to: string;
  subject: string;
  text: string;
  inviteId: string;
}) {
  const key = sendgridApiKey.value();
  if (!key) {
    console.log(
      `[sendInvite] Would send email to ${params.to}: "${params.subject}" (invite ${params.inviteId})`
    );
    return;
  }
  // Trigger Email extension: write to 'mail' collection
  await admin.firestore().collection("mail").add({
    to: params.to,
    message: { subject: params.subject, text: params.text },
  });
}
