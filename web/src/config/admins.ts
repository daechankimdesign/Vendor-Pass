// Admin emails — checked client-side to show/hide the /admin route.
// Server-side enforcement is done via Firestore security rules (role === 'admin').
// Update this list manually; never expose it to the UI as data.
export const ADMIN_EMAILS: readonly string[] = [
  "daechankim.design@gmail.com",
];
