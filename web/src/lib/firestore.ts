import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  DocumentReference,
  CollectionReference,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
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
  // Denormalized for search result display — computed from documents subcollection
  // and stored here so any signed-in PM can see tier without a relationship.
  overallTier?: VerificationTier;
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

export async function getVendorProfile(uid: string): Promise<VendorPublicProfile | null> {
  const snap = await getDoc(vendorDoc(uid));
  return snap.exists() ? (snap.data() as VendorPublicProfile) : null;
}

export async function getVendorContact(uid: string): Promise<VendorPrivateContact | null> {
  const snap = await getDoc(vendorPrivateDoc(uid));
  return snap.exists() ? (snap.data() as VendorPrivateContact) : null;
}

export async function updateVendorProfile(
  uid: string,
  fields: Partial<VendorPublicProfile>
): Promise<void> {
  await updateDoc(vendorDoc(uid), fields as Record<string, unknown>);
}

export async function updateVendorContact(
  uid: string,
  fields: Partial<VendorPrivateContact>
): Promise<void> {
  await updateDoc(vendorPrivateDoc(uid), fields as Record<string, unknown>);
}

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

/** Save vendor-confirmed extraction; promotes tier to self_verified and updates overallTier. */
export async function confirmVendorDocument(
  vendorUid: string,
  docType: DocType,
  fields: Record<string, { value: string | null; confidence: number }>,
  expirationDate: Timestamp | null
): Promise<void> {
  if (!vendorUid) throw new Error("Vendor UID is required.");
  const confirmDocument = httpsCallable(functions, "confirmVendorDocument");
  await confirmDocument({
    docType,
    fields,
    expirationDate: expirationDate ? expirationDate.toMillis() : null,
  });
}

/** Admin: promote a document to verified (tier 3) and update overallTier. */
export async function adminPromoteDocument(
  vendorUid: string,
  docType: DocType
): Promise<void> {
  const promoteDocument = httpsCallable(functions, "adminPromoteDocument");
  await promoteDocument({ vendorUid, docType });
}

export async function getPmRelationships(
  vendorUid: string
): Promise<Record<string, PmRelationship>> {
  const snap = await getDocs(pmRelationshipsCol(vendorUid));
  const result: Record<string, PmRelationship> = {};
  snap.forEach((d) => {
    result[d.id] = d.data() as PmRelationship;
  });
  return result;
}

export async function toggleWorkOrdersPaused(
  vendorUid: string,
  pmUid: string,
  paused: boolean
): Promise<void> {
  await updateDoc(pmRelationshipDoc(vendorUid, pmUid), { workOrdersPaused: paused });
}

export async function getPmProjects(pmUid: string): Promise<Array<Project & { id: string }>> {
  const q = query(projectsCol(), where("pmUid", "==", pmUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Project) }));
}

export async function createProject(
  pmUid: string,
  data: Omit<Project, "pmUid" | "createdAt">
): Promise<string> {
  const ref = await addDoc(projectsCol(), { ...data, pmUid, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateProject(
  projectId: string,
  data: Partial<Omit<Project, "pmUid" | "createdAt">>
): Promise<void> {
  await updateDoc(projectDoc(projectId), data as Record<string, unknown>);
}

export async function acceptInvite(inviteId: string, vendorUid: string): Promise<void> {
  if (!vendorUid) throw new Error("Vendor UID is required.");
  const acceptInviteCallable = httpsCallable(functions, "acceptInvite");
  await acceptInviteCallable({ inviteId });
}

export async function declineInvite(inviteId: string): Promise<void> {
  const declineInviteCallable = httpsCallable(functions, "declineInvite");
  await declineInviteCallable({ inviteId });
}

export async function getVendorInvites(vendorUid: string): Promise<Array<Invite & { id: string }>> {
  const q = query(invitesCol(), where("vendorUid", "==", vendorUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Invite) }));
}

export async function getVendorInvitesByEmail(
  email: string
): Promise<Array<Invite & { id: string }>> {
  const q = query(
    invitesCol(),
    where("vendorEmail", "==", email),
    where("status", "==", "pending_signup")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Invite) }));
}

export async function getPmInvites(pmUid: string): Promise<Array<Invite & { id: string }>> {
  const q = query(invitesCol(), where("pmUid", "==", pmUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Invite) }));
}

export async function attachInviteToNewVendor(inviteId: string, vendorUid: string): Promise<void> {
  if (!vendorUid) throw new Error("Vendor UID is required.");
  const attachInvite = httpsCallable(functions, "attachInviteToNewVendor");
  await attachInvite({ inviteId });
}

export async function submitLead(email: string): Promise<void> {
  await addDoc(leadsCol(), { email, createdAt: serverTimestamp(), source: "landing" });
}

/** Return all discoverable vendors (no filter). Used for the public landing page. */
export async function getDiscoverableVendors(): Promise<
  Array<VendorPublicProfile & { uid: string }>
> {
  const q = query(vendorsCol(), where("discoverable", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as VendorPublicProfile) }));
}

/** Search discoverable vendors by category and zip. Returns vendor docs with uid.
 *  Firestore only allows one array-contains per query; zip is filtered client-side. */
export async function searchVendors(
  category: ServiceCategory,
  zipCode: string
): Promise<Array<VendorPublicProfile & { uid: string }>> {
  const q = query(
    vendorsCol(),
    where("discoverable", "==", true),
    where("categories", "array-contains", category)
  );
  const snap = await getDocs(q);
  return snap.docs
    .filter((d) => {
      const data = d.data() as VendorPublicProfile;
      return data.serviceZipCodes?.includes(zipCode);
    })
    .map((d) => ({ uid: d.id, ...(d.data() as VendorPublicProfile) }));
}

/** Collect all vendor UIDs that have worked with this PM (via project assignments). */
export async function getVendorUidsForPm(pmUid: string): Promise<string[]> {
  const projects = await getPmProjects(pmUid);
  const vendorUidSet = new Set<string>();
  await Promise.all(
    projects.map(async (project) => {
      const vSnap = await getDocs(projectVendorsCol(project.id));
      vSnap.forEach((d) => vendorUidSet.add(d.id));
    })
  );
  return Array.from(vendorUidSet);
}

/** Get all projects a vendor has been accepted into. */
export async function getVendorProjects(
  vendorUid: string
): Promise<Array<Project & { id: string }>> {
  const invites = await getVendorInvites(vendorUid);
  const acceptedIds = [
    ...new Set(
      invites.filter((i) => i.status === "accepted").map((i) => i.projectId)
    ),
  ];
  const results = await Promise.all(
    acceptedIds.map(async (id) => {
      const snap = await getDoc(projectDoc(id));
      return snap.exists() ? { id, ...(snap.data() as Project) } : null;
    })
  );
  return results.filter((p): p is Project & { id: string } => p !== null);
}

/** Get PM clients for a vendor with their user profiles. */
export async function getVendorClients(vendorUid: string): Promise<
  Array<{
    pmUid: string;
    displayName: string;
    email: string;
    relationship: PmRelationship;
  }>
> {
  const relationships = await getPmRelationships(vendorUid);
  return Promise.all(
    Object.entries(relationships).map(async ([pmUid, relationship]) => {
      const snap = await getDoc(userDoc(pmUid));
      const data = snap.exists()
        ? (snap.data() as { displayName: string; email: string })
        : null;
      return {
        pmUid,
        displayName: data?.displayName ?? "Unknown",
        email: data?.email ?? "",
        relationship,
      };
    })
  );
}

export async function getUserRole(uid: string): Promise<UserRole | null> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists() ? (snap.data().role as UserRole) : null;
}

/** Parse comma-separated zip input into valid 5-digit zip array. */
export function parseZipCodes(input: string): string[] {
  return input
    .split(",")
    .map((z) => z.trim())
    .filter((z) => /^\d{5}$/.test(z));
}
