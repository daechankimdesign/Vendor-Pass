import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";

const db = admin.firestore();

interface InviteActionPayload {
  inviteId: string;
}

interface InviteData {
  pmUid: string;
  vendorUid?: string;
  vendorEmail?: string;
  projectId: string;
  status: "pending" | "pending_signup" | "accepted" | "declined";
  expiresAt?: admin.firestore.Timestamp;
}

export const attachInviteToNewVendor = onCall(
  { invoker: "public" },
  async (request: CallableRequest<InviteActionPayload>) => {
    const vendorUid = requireAuth(request);
    const inviteId = requireInviteId(request.data?.inviteId);
    const email = request.auth?.token.email?.toLowerCase();

    const inviteRef = db.collection("invites").doc(inviteId);
    await db.runTransaction(async (tx) => {
      const inviteSnap = await tx.get(inviteRef);
      if (!inviteSnap.exists) {
        throw new HttpsError("not-found", "Invite not found.");
      }

      const invite = inviteSnap.data() as InviteData;
      assertNotExpired(invite);
      if (invite.status !== "pending_signup") {
        throw new HttpsError("failed-precondition", "Invite is not awaiting signup.");
      }
      if (!email || invite.vendorEmail?.toLowerCase() !== email) {
        throw new HttpsError("permission-denied", "Invite email does not match this account.");
      }

      tx.update(inviteRef, {
        vendorUid,
        status: "pending",
      });
    });

    return { status: "pending" };
  }
);

export const acceptInvite = onCall(
  { invoker: "public" },
  async (request: CallableRequest<InviteActionPayload>) => {
    const vendorUid = requireAuth(request);
    const inviteId = requireInviteId(request.data?.inviteId);
    const email = request.auth?.token.email?.toLowerCase();

    const inviteRef = db.collection("invites").doc(inviteId);
    await db.runTransaction(async (tx) => {
      const inviteSnap = await tx.get(inviteRef);
      if (!inviteSnap.exists) {
        throw new HttpsError("not-found", "Invite not found.");
      }

      const invite = inviteSnap.data() as InviteData;
      assertNotExpired(invite);
      if (invite.status !== "pending") {
        throw new HttpsError("failed-precondition", "Invite is not pending.");
      }
      if (invite.vendorUid && invite.vendorUid !== vendorUid) {
        throw new HttpsError("permission-denied", "Invite belongs to another vendor.");
      }
      if (!invite.vendorUid && (!email || invite.vendorEmail?.toLowerCase() !== email)) {
        throw new HttpsError("permission-denied", "Invite email does not match this account.");
      }

      const projectRef = db.collection("projects").doc(invite.projectId);
      const relationshipRef = db
        .collection("vendors")
        .doc(vendorUid)
        .collection("pmRelationships")
        .doc(invite.pmUid);

      tx.update(inviteRef, {
        status: "accepted",
        vendorUid,
      });
      tx.set(projectRef.collection("vendors").doc(vendorUid), {
        addedAt: admin.firestore.FieldValue.serverTimestamp(),
        inviteId,
      });
      tx.set(
        relationshipRef,
        {
          firstLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
          workOrdersPaused: false,
        },
        { merge: true }
      );
    });

    return { status: "accepted" };
  }
);

export const declineInvite = onCall(
  { invoker: "public" },
  async (request: CallableRequest<InviteActionPayload>) => {
    const vendorUid = requireAuth(request);
    const inviteId = requireInviteId(request.data?.inviteId);
    const email = request.auth?.token.email?.toLowerCase();

    const inviteRef = db.collection("invites").doc(inviteId);
    await db.runTransaction(async (tx) => {
      const inviteSnap = await tx.get(inviteRef);
      if (!inviteSnap.exists) {
        throw new HttpsError("not-found", "Invite not found.");
      }

      const invite = inviteSnap.data() as InviteData;
      if (invite.vendorUid && invite.vendorUid !== vendorUid) {
        throw new HttpsError("permission-denied", "Invite belongs to another vendor.");
      }
      if (!invite.vendorUid && (!email || invite.vendorEmail?.toLowerCase() !== email)) {
        throw new HttpsError("permission-denied", "Invite email does not match this account.");
      }
      if (!["pending", "pending_signup"].includes(invite.status)) {
        throw new HttpsError("failed-precondition", "Invite is not pending.");
      }

      tx.update(inviteRef, {
        status: "declined",
        vendorUid,
      });
    });

    return { status: "declined" };
  }
);

function requireAuth(request: CallableRequest<unknown>): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  return request.auth.uid;
}

function requireInviteId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", "inviteId is required.");
  }
  return value;
}

function assertNotExpired(invite: InviteData): void {
  if (invite.expiresAt?.toMillis() && invite.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError("deadline-exceeded", "Invite has expired.");
  }
}
