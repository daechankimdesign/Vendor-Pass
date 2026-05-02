import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

const db = admin.firestore();

const WARNING_DAYS = [30, 7, 0];

/**
 * Scheduled daily at 09:00 UTC.
 * Scans all vendor documents for expiring certs and writes notification docs.
 * SendGrid key intentionally unset — logs "would send", does not throw.
 * W-9 has no expiration and is excluded.
 */
export const scanExpirations = onSchedule("0 9 * * *", async () => {
  const now = new Date();
  console.log(`[scanExpirations] Starting run at ${now.toISOString()}`);

  const batch = db.batch();
  let notificationsQueued = 0;

  for (const daysUntil of WARNING_DAYS) {
    const windowStart = new Date(now);
    windowStart.setHours(0, 0, 0, 0);
    windowStart.setDate(windowStart.getDate() + daysUntil);

    const windowEnd = new Date(windowStart);
    windowEnd.setHours(23, 59, 59, 999);

    const windowStartTs = admin.firestore.Timestamp.fromDate(windowStart);
    const windowEndTs = admin.firestore.Timestamp.fromDate(windowEnd);

    // Query all vendor document subdocs with expirationDate in window
    const collectionGroupSnap = await db
      .collectionGroup("documents")
      .where("expirationDate", ">=", windowStartTs)
      .where("expirationDate", "<=", windowEndTs)
      .get();

    for (const docSnap of collectionGroupSnap.docs) {
      const data = docSnap.data();
      const docType = data.docType as string;

      // Skip W-9 (no expiration)
      if (docType === "w9") continue;

      // Extract vendorUid from path: vendors/{vendorUid}/documents/{docType}
      const pathParts = docSnap.ref.path.split("/");
      const vendorUid = pathParts[1];

      // Get all PM relationships for this vendor
      const pmRelSnap = await db
        .collection("vendors")
        .doc(vendorUid)
        .collection("pmRelationships")
        .get();

      const pmUids = pmRelSnap.docs.map((d) => d.id);
      const recipients: Array<{ uid: string; role: "vendor" | "pm" }> = [
        { uid: vendorUid, role: "vendor" },
        ...pmUids.map((uid) => ({ uid, role: "pm" as const })),
      ];

      for (const recipient of recipients) {
        const notifRef = db.collection("notifications").doc();
        batch.set(notifRef, {
          vendorUid,
          pmUid: recipient.role === "pm" ? recipient.uid : null,
          recipientUid: recipient.uid,
          recipientRole: recipient.role,
          docType,
          daysUntil,
          type: "expiration_warning",
          sentAt: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        notificationsQueued++;

        console.log(
          `[scanExpirations] Would send ${daysUntil}-day warning to ${recipient.role} ${recipient.uid} for vendor ${vendorUid} docType=${docType}`
        );
      }
    }
  }

  await batch.commit();
  console.log(
    `[scanExpirations] Complete. Queued ${notificationsQueued} notification docs.`
  );
});
