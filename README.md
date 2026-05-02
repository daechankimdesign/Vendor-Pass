# Compliance Roster

> B2B Property-Vendor Discovery & Compliance Platform

**Design system source of truth: [`/design.md`](./design.md)**
All UI components consume tokens from `design.md`. Never hand-type hex values in components.

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
firebase functions:config:set \
  documentai.business_license_processor="projects/PROJECT_ID/locations/us/processors/PROCESSOR_ID" \
  documentai.w9_processor="projects/PROJECT_ID/locations/us/processors/PROCESSOR_ID" \
  documentai.coi_processor="projects/PROJECT_ID/locations/us/processors/PROCESSOR_ID" \
  app.url="https://YOUR_APP.web.app" \
  sendgrid.api_key="YOUR_KEY_WHEN_READY"
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
  businessName, businessZipCode, serviceZipCodes[], categories[], discoverable, createdAt

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
Any signed-in PM can read a discoverable vendor's public profile during search.
`vendors/{vendorUid}/private/contact` holds PII (email, phone) — readable only by the vendor,
admins, and PMs who have an accepted pmRelationships doc.

---

## Email (Trigger Email Extension)

Install the Firebase "Trigger Email" extension and configure it with your SendGrid API key.
Until the key is wired, `sendInvite` logs "would send" and writes notification docs without throwing.

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
| Location matching | Zip-code only (no geo/radius) | Simplicity for MVP; geo search is V2 |
| Service taxonomy | Fixed 7 trades | Prevents taxonomy sprawl; adding categories is deliberate |
| Vendor data split | Public (vendors/{uid}) + private (private/contact) | PII not exposed to all PMs; unlocked only after invite acceptance |
| Build order | Scaffold first, UI after design.md handoff | Design system must drive all visual decisions |
