import * as admin from "firebase-admin";

admin.initializeApp();

export { processDocument } from "./processDocument";
export { sendInvite } from "./sendInvite";
export { scanExpirations } from "./scanExpirations";
