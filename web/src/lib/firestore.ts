import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  DocumentReference,
  CollectionReference,
} from "firebase/firestore";
import { db } from "../firebase";
import type { UserRole } from "../contexts/AuthContext";
import type { DocType, VendorDocument, VerificationTier } from "./docTypes";
import type { ServiceCategory } from "./categories";

// ── Type definitions ──────────────────────────────────────────────────────────

export interface VendorPublicProfile {
  businessName: string;
  businessZipCode: string;
  serviceZipCodes: string[];
  categories: ServiceCategory[];
  discoverable: boolean;
  createdAt: Timestamp;
}

export interface VendorPrivateContact {
  contactEmail: string;
  phone: string;
}

export interface Project {
  pmUid: string;
  name: string;
  address: string;
  zipCode: string;
  status: "active" | "closed";
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  description: string;
  createdAt: Timestamp;
}

export interface ProjectVendor {
  addedAt: Timestamp;
  inviteId: string;
}

export interface Invite {
  pmUid: string;
  vendorUid?: string;
  vendorEmail: string;
  projectId: string;
  status: "pending" | "pending_signup" | "accepted" | "declined";
  source: "search" | "email";
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

export interface PmRelationship {
  firstLinkedAt: Timestamp;
  workOrdersPaused: boolean;
}

// ── Typed collection/doc refs ─────────────────────────────────────────────────

export const usersCol = () => collection(db, "users") as CollectionReference;
export const userDoc = (uid: string) => doc(db, "users", uid) as DocumentReference;

export const vendorsCol = () => collection(db, "vendors") as CollectionReference;
export const vendorDoc = (uid: string) => doc(db, "vendors", uid) as DocumentReference;
export const vendorPrivateDoc = (uid: string) => doc(db, "vendors", uid, "private", "contact");
export const vendorDocumentsCol = (uid: string) =>
  collection(db, "vendors", uid, "documents") as CollectionReference;
export const vendorDocumentDoc = (uid: string, docType: DocType) =>
  doc(db, "vendors", uid, "documents", docType);
export const pmRelationshipsCol = (vendorUid: string) =>
  collection(db, "vendors", vendorUid, "pmRelationships") as CollectionReference;
export const pmRelationshipDoc = (vendorUid: string, pmUid: string) =>
  doc(db, "vendors", vendorUid, "pmRelationships", pmUid);

export const projectsCol = () => collection(db, "projects") as CollectionReference;
export const projectDoc = (id: string) => doc(db, "projects", id) as DocumentReference;
export const projectVendorsCol = (projectId: string) =>
  collection(db, "projects", projectId, "vendors") as CollectionReference;
export const projectVendorDoc = (projectId: string, vendorUid: string) =>
  doc(db, "projects", projectId, "vendors", vendorUid);

export const invitesCol = () => collection(db, "invites") as CollectionReference;
export const inviteDoc = (id: string) => doc(db, "invites", id) as DocumentReference;

export const leadsCol = () => collection(db, "leads") as CollectionReference;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch a vendor's public profile */
export async function getVendorProfile(uid: string): Promise<VendorPublicProfile | null> {
  const snap = await getDoc(vendorDoc(uid));
  return snap.exists() ? (snap.data() as VendorPublicProfile) : null;
}

/** Fetch a vendor's private contact info */
export async function getVendorContact(uid: string): Promise<VendorPrivateContact | null> {
  const snap = await getDoc(vendorPrivateDoc(uid));
  return snap.exists() ? (snap.data() as VendorPrivateContact) : null;
}

/** Update vendor public profile fields */
export async function updateVendorProfile(
  uid: string,
  fields: Partial<VendorPublicProfile>
): Promise<void> {
  await updateDoc(vendorDoc(uid), fields as Record<string, unknown>);
}

/** Update vendor private contact fields */
export async function updateVendorContact(
  uid: string,
  fields: Partial<VendorPrivateContact>
): Promise<void> {
  await updateDoc(vendorPrivateDoc(uid), fields as Record<string, unknown>);
}

/** Get all documents for a vendor */
export async function getVendorDocuments(
  uid: string
): Promise<Partial<Record<DocType, VendorDocument>>> {
  const snap = await getDocs(vendorDocumentsCol(uid));
  const result: Partial<Record<DocType, VendorDocument>> = {};
  snap.forEach((d) => {
    result[d.id as DocType] = d.data() as VendorDocument;
  });
  return result;
}

/** Save vendor-confirmed extraction for a doc type; promotes tier to self_verified */
export async function confirmVendorDocument(
  vendorUid: string,
  docType: DocType,
  fields: Record<string, { value: string | null; confidence: number }>,
  expirationDate: Timestamp | null
): Promise<void> {
  await updateDoc(vendorDocumentDoc(vendorUid, docType), {
    extractedFields: fields,
    expirationDate,
    vendorConfirmed: true,
    tier: "self_verified" as VerificationTier,
    lastUpdatedAt: serverTimestamp(),
  });
}

/** Admin: promote a document to verified (tier 3) */
export async function adminPromoteDocument(
  vendorUid: string,
  docType: DocType
): Promise<void> {
  await updateDoc(vendorDocumentDoc(vendorUid, docType), {
    tier: "verified" as VerificationTier,
    adminReviewed: true,
    lastUpdatedAt: serverTimestamp(),
  });
}

/** Get a vendor's PM relationships */
export async function getPmRelationships(vendorUid: string): Promise<Record<string, PmRelationship>> {
  const snap = await getDocs(pmRelationshipsCol(vendorUid));
  const result: Record<string, PmRelationship> = {};
  snap.forEach((d) => {
    result[d.id] = d.data() as PmRelationship;
  });
  return result;
}

/** Toggle workOrdersPaused on a PM relationship */
export async function toggleWorkOrdersPaused(
  vendorUid: string,
  pmUid: string,
  paused: boolean
): Promise<void> {
  await updateDoc(pmRelationshipDoc(vendorUid, pmUid), { workOrdersPaused: paused });
}

/** Create or update a PM relationship doc */
export async function upsertPmRelationship(
  vendorUid: string,
  pmUid: string
): Promise<void> {
  const ref = pmRelationshipDoc(vendorUid, pmUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      firstLinkedAt: serverTimestamp(),
      workOrdersPaused: false,
    });
  }
}

/** Get projects for a PM */
export async function getPmProjects(pmUid: string): Promise<Array<Project & { id: string }>> {
  const q = query(projectsCol(), where("pmUid", "==", pmUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Project) }));
}

/** Create a project */
export async function createProject(
  pmUid: string,
  data: Omit<Project, "pmUid" | "createdAt">
): Promise<string> {
  const ref = await addDoc(projectsCol(), {
    ...data,
    pmUid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Accept an invite: set status to accepted, add to project vendors, upsert PM relationship */
export async function acceptInvite(inviteId: string, vendorUid: string): Promise<void> {
  const invSnap = await getDoc(inviteDoc(inviteId));
  if (!invSnap.exists()) throw new Error("Invite not found");
  const inv = invSnap.data() as Invite;

  await updateDoc(inviteDoc(inviteId), { status: "accepted" });

  await setDoc(projectVendorDoc(inv.projectId, vendorUid), {
    addedAt: serverTimestamp(),
    inviteId,
  });

  await upsertPmRelationship(vendorUid, inv.pmUid);
}

/** Decline an invite */
export async function declineInvite(inviteId: string): Promise<void> {
  await updateDoc(inviteDoc(inviteId), { status: "declined" });
}

/** Get invites for a vendor */
export async function getVendorInvites(vendorUid: string): Promise<Array<Invite & { id: string }>> {
  const q = query(invitesCol(), where("vendorUid", "==", vendorUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Invite) }));
}

/** Get pending invites by email (pending_signup flow) */
export async function getInvitesByEmail(email: string): Promise<Array<Invite & { id: string }>> {
  const q = query(
    invitesCol(),
    where("vendorEmail", "==", email),
    where("status", "==", "pending_signup")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Invite) }));
}

/**
 * Called after a new vendor signs up via an invite link.
 * Attaches the invite to the new vendor uid and converts status appropriately.
 */
export async function attachInviteToNewVendor(inviteId: string, vendorUid: string): Promise<void> {
  await updateDoc(inviteDoc(inviteId), { vendorUid, status: "pending" });
}

/** Submit waitlist lead */
export async function submitLead(email: string): Promise<void> {
  await addDoc(leadsCol(), {
    email,
    createdAt: serverTimestamp(),
    source: "landing",
  });
}

/** Search for discoverable vendors by category and zip */
export async function searchVendors(
  category: ServiceCategory,
  zipCode: string
): Promise<Array<VendorPublicProfile & { uid: string }>> {
  const q = query(
    vendorsCol(),
    where("discoverable", "==", true),
    where("categories", "array-contains", category),
    where("serviceZipCodes", "array-contains", zipCode)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as VendorPublicProfile) }));
}

/** Get all vendors in a PM's roster (those with a pmRelationship) */
export async function getPmRosterVendors(
  _pmUid: string
): Promise<Array<{ uid: string } & VendorPublicProfile>> {
  // Cannot query subcollections directly; this is loaded by the PM dashboard
  // from the pmRelationships subcollections of vendors already known.
  // Actual implementation reads vendors/{uid}/pmRelationships/{pmUid} docs,
  // then fetches the vendor profiles in parallel.
  // A full implementation would require a denormalized index.
  // For MVP, this is handled on the client via the pmRelationships subcollection.
  throw new Error("Use getPmRelationshipsForPm instead — see PmDashboard for roster loading.");
}

/** Get all vendor UIDs that have a relationship with a given PM */
export async function getVendorUidsForPm(pmUid: string): Promise<string[]> {
  // This requires a collection-group query on pmRelationships filtered by document ID == pmUid.
  // Simplified: the PM dashboard stores known vendor UIDs in local state after invite acceptance.
  // For true roster loading, query collectionGroup("pmRelationships") where __name__ ends in pmUid.
  // MVP approach: read from projects/{projectId}/vendors to collect all vendor UIDs for this PM.
  const projects = await getPmProjects(pmUid);
  const vendorUidSet = new Set<string>();
  for (const project of projects) {
    const vSnap = await getDocs(projectVendorsCol(project.id));
    vSnap.forEach((d) => vendorUidSet.add(d.id));
  }
  return Array.from(vendorUidSet);
}

/** Get user role from users collection */
export async function getUserRole(uid: string): Promise<UserRole | null> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists() ? (snap.data().role as UserRole) : null;
}
