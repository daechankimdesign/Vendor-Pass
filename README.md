# VendorPass

> B2B Property-Vendor Discovery & Compliance Platform

**Design system source of truth: [`/Design.md`](./Design.md)**
All UI components consume tokens from `Design.md`. Never hand-type hex values in components.

---

## Setup

### Prerequisites
- Node 20+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project with Authentication, Firestore, Cloud Storage, and Cloud Functions enabled

### 1. Firebase init
```bash
firebase login
firebase use --add   # select your project
```

### 2. Environment variables
```bash
cp web/.env.local.example web/.env.local
# Fill in your Firebase project config values
```

### 3. Document AI processor IDs
Create one Document AI processor per doc type in Google Cloud Console, then set:
```bash
firebase functions:params:set BUSINESS_LICENSE_PROCESSOR_ID="projects/PROJECT_ID/locations/us/processors/PROCESSOR_ID"
firebase functions:params:set W9_PROCESSOR_ID="projects/PROJECT_ID/locations/us/processors/PROCESSOR_ID"
firebase functions:params:set COI_PROCESSOR_ID="projects/PROJECT_ID/locations/us/processors/PROCESSOR_ID"
firebase functions:params:set APP_URL="https://YOUR_APP.web.app"
firebase functions:params:set SENDGRID_API_KEY="YOUR_KEY_WHEN_READY"
```

### 4. Install dependencies
```bash
cd functions && npm install && cd ..
cd web && npm install && cd ..
```

### 5. Deploy Firestore rules & indexes
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 6. Admin users
Set `role: "admin"` manually in Firestore console for `users/{uid}`, and add their email to `web/src/config/admins.ts`.

---

## MVP User Flow

Vendor discovery comes before account creation or sales handoff.

1. A property manager lands on VendorPass and searches by category and zip immediately.
2. Public search only reads public-safe vendor fields from `vendors/{vendorUid}`.
3. To invite a vendor, the PM signs up or signs in, creates/selects a project, and sends an invite.
4. Existing vendors receive a project invite without exposing private contact data in search.
5. New vendors receive a signup invite, complete onboarding, and accept/decline from the vendor dashboard.
6. Accepted invites create both `projects/{projectId}/vendors/{vendorUid}` and `vendors/{vendorUid}/pmRelationships/{pmUid}` through Cloud Functions.

Keep the path huddleless: search first, defer account creation until intent is clear, and avoid asking for meetings or manual approval before a PM can see the marketplace.

---

## Local Development

```bash
# Terminal 1 — Firebase emulators
firebase emulators:start

# Terminal 2 — Vite dev server
cd web && npm run dev
```

Emulator UI: http://localhost:4000

---

## Deploy

```bash
# Build web
cd web && npm run build && cd ..

# Deploy everything
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only hosting
firebase deploy --only hosting
```

---

## Schema

```
leads/{id}
  email, createdAt, source

users/{uid}
  email, role ("property_manager" | "vendor" | "admin"), displayName, createdAt

vendors/{vendorUid}                         <- public-safe fields only
  businessName, businessZipCode, serviceZipCodes[], categories[], discoverable,
  overallTier (function-maintained), createdAt

vendors/{vendorUid}/private/contact         <- PII, locked down
  contactEmail, phone

vendors/{vendorUid}/documents/{docType}
  docType, storagePath, extractedFields{}, extractionStatus,
  tier, vendorConfirmed, adminReviewed, expirationDate, uploadedAt, lastUpdatedAt

vendors/{vendorUid}/pmRelationships/{pmUid}
  firstLinkedAt, workOrdersPaused

projects/{projectId}
  pmUid, name, address, zipCode, status, startDate, endDate, description, createdAt

projects/{projectId}/vendors/{vendorUid}
  addedAt, inviteId

invites/{id}
  pmUid, vendorUid?, vendorEmail, projectId, status, source, createdAt, expiresAt

notifications/{id}
  vendorUid, pmUid, docType, daysUntil, type, sentAt
```

### Public/private vendor split

`vendors/{vendorUid}` holds only public-safe fields (name, zip, categories, discoverable).
Anyone can read a discoverable vendor's public profile during search.
`vendors/{vendorUid}/private/contact` holds PII (email, phone) — readable only by the vendor,
admins, and PMs who have an accepted pmRelationships doc.

Verification-changing writes are server-owned:
- Vendors upload files to Storage; `processDocument` creates document records.
- Vendors confirm extracted fields through `confirmVendorDocument`.
- Admins promote documents through `adminPromoteDocument`.
- Invite acceptance/decline and invite-to-new-vendor attachment run through Cloud Functions.

---

## Email (Trigger Email Extension)

Install the Firebase "Trigger Email" extension and configure it with your SendGrid API key.
Until the key is wired, `sendInvite` logs "would send" without throwing. Once configured,
it queues email through the extension's `mail` collection.

SMS via Twilio is out of scope for MVP.

---

## V2 Roadmap

- SMS notifications via Twilio
- Additional document types (pesticide license, driver's license, etc.)
- Real SendGrid API key wiring for all email flows
- Per-project compliance requirements (e.g., "$2M COI naming property as additional insured")
- Geo/radius search (lat/lng on vendors, geofire-common, map view)
- Vendor reviews, ratings, and job history
- In-app messaging and quote requests between PMs and vendors
- More service categories and subcategories (user-managed taxonomy)
- Payment and invoicing integrations
- Dark mode, full accessibility audit

---

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Auth | Email/password + email verification | Simple, no OAuth complexity for MVP |
| Vendor profile | Shared across all PMs | Vendor manages one profile; compliance is global |
| Tier 3 promotion | Admin-gated | Human-in-the-loop validation prevents fraud |
| Vendor signup | Open (self-register) | Reduces friction for beta onboarding |
| Project model | Model B — tag layer over PM-vendor roster | Projects are organizational, not compliance-scoping |
| Compliance scope | Global per vendor (not per project) | Per-project requirements are a V2 feature |
| Primary product motion | Vendor search + discovery | Discovery is the core value; roster is secondary |
| Search access | Public discoverable search first | PMs should inspect supply before signing up or scheduling conversations |
| Location matching | Zip-code only (no geo/radius) | Simplicity for MVP; geo search is V2 |
| Service taxonomy | Fixed 7 trades | Prevents taxonomy sprawl; adding categories is deliberate |
| Vendor data split | Public (vendors/{uid}) + private (private/contact) | PII not exposed to all PMs; unlocked only after invite acceptance |
| Build order | Scaffold first, UI after design.md handoff | Design system must drive all visual decisions |
