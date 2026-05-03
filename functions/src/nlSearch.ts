import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";

const mapsApiKey = defineString("MAPS_API_KEY", { default: "" });

const GCP_PROJECT = "vendorpass-495114";
const GCP_LOCATION = "us-central1";
const GEMINI_MODEL = "gemini-2.0-flash-001";

const SERVICE_CATEGORIES = [
  "plumbing",
  "landscaping",
  "electrical",
  "hvac",
  "painting",
  "pest_control",
  "general_handyman",
] as const;

type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

interface ParsedQuery {
  category: ServiceCategory | null;
  zip: string | null;
  location: string | null;
}

interface VendorResult {
  uid: string;
  businessName: string;
  businessZipCode: string;
  serviceZipCodes: string[];
  categories: string[];
  discoverable: boolean;
  overallTier?: string;
}

interface NlSearchResponse {
  vendors: VendorResult[];
  parsed: ParsedQuery;
  resolvedZips: string[];
}

// ── Get GCP access token via firebase-admin credential ─────────────────────────

async function getAccessToken(): Promise<string> {
  const token = await admin.app().options.credential!.getAccessToken();
  return token.access_token;
}

// ── Gemini intent parser via Vertex AI REST API ────────────────────────────────

async function parseQuery(queryText: string): Promise<ParsedQuery> {
  const accessToken = await getAccessToken();

  const prompt = `You are a search intent parser for a contractor compliance platform.

Extract the search intent from the user query below and return ONLY valid JSON — no markdown fences, no explanation.

Return this exact JSON shape:
{
  "category": "<one of: plumbing|landscaping|electrical|hvac|painting|pest_control|general_handyman — or null if unclear>",
  "zip": "<5-digit US zip code if the user specified one, otherwise null>",
  "location": "<city, neighborhood, or address string if the user mentioned a location that is NOT a zip code, otherwise null>"
}

Keyword hints for categories:
- plumbing: plumber, pipe, drain, leak, water heater, faucet
- landscaping: lawn, garden, grass, tree, yard, landscape
- electrical: electrician, wiring, outlet, panel, circuit, lighting
- hvac: AC, air conditioning, heating, furnace, heat pump, HVAC, ventilation
- painting: painter, paint, wall, interior, exterior
- pest_control: pest, bug, rodent, termite, exterminator, fumigation
- general_handyman: handyman, fix, repair, odd jobs, maintenance, general

User query: "${queryText.replace(/"/g, "'")}"`;

  const url =
    `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT}` +
    `/locations/${GCP_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 256 },
    }),
  });

  if (!res.ok) {
    console.error("Vertex AI error:", res.status, await res.text());
    return { category: null, zip: null, location: null };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const rawText: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  // Strip any accidental markdown fences
  const cleaned = rawText.replace(/```json\n?|\n?```/g, "").trim();

  let parsed: Partial<ParsedQuery> = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { category: null, zip: null, location: null };
  }

  // Validate category
  const cat = parsed.category as string | null;
  let validCategory =
    cat && SERVICE_CATEGORIES.includes(cat as ServiceCategory)
      ? (cat as ServiceCategory)
      : null;

  // Keyword fallback — if Gemini returned no category, extract from query text directly
  if (!validCategory) {
    validCategory = keywordCategory(queryText);
  }

  // Validate zip
  const zip = parsed.zip ?? null;
  const validZip = zip && /^\d{5}$/.test(zip) ? zip : null;

  return {
    category: validCategory,
    zip: validZip,
    location: parsed.location ?? null,
  };
}

// ── Keyword-based category fallback ───────────────────────────────────────────

const KEYWORD_MAP: Array<[string[], ServiceCategory]> = [
  [["plumb", "pipe", "drain", "leak", "water heater", "faucet", "sewer"], "plumbing"],
  [["landscap", "lawn", "garden", "grass", "tree", "yard", "mow", "hedge"], "landscaping"],
  [["electric", "wiring", "outlet", "panel", "circuit", "lighting", "breaker"], "electrical"],
  [["hvac", "air condition", "heating", "furnace", "heat pump", "ventilation", "ac ", " ac"], "hvac"],
  [["paint", "wall", "interior", "exterior", "stain", "primer"], "painting"],
  [["pest", "bug", "rodent", "termite", "exterminator", "fumigat", "insect", "roach"], "pest_control"],
  [["handyman", "repair", "odd job", "mainten", "fix", "general contractor"], "general_handyman"],
];

function keywordCategory(query: string): ServiceCategory | null {
  const lower = query.toLowerCase();
  for (const [keywords, category] of KEYWORD_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return null;
}

// ── Google Maps Geocoding via REST ─────────────────────────────────────────────

interface GeoAddrComponent {
  short_name: string;
  types: string[];
}

interface GeoResult {
  address_components?: GeoAddrComponent[];
  geometry?: { location: { lat: number; lng: number } };
}

interface GeoResponse {
  results: GeoResult[];
  status: string;
}

async function resolveLocationToZips(
  location: string,
  apiKey: string
): Promise<string[]> {
  if (!apiKey) return [];

  try {
    const encoded = encodeURIComponent(`${location}, USA`);
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encoded}&components=country:US&key=${apiKey}`;

    const res = await fetch(url);
    const data = (await res.json()) as GeoResponse;

    if (!data.results?.length) return [];

    const zips: Set<string> = new Set();

    for (const result of data.results.slice(0, 5)) {
      const pc = result.address_components?.find((c) =>
        c.types.includes("postal_code")
      );
      if (pc?.short_name) zips.add(pc.short_name);
    }

    // Area query (e.g. "Beverly Hills") — reverse-geocode the center point
    if (zips.size === 0 && data.results[0]?.geometry?.location) {
      const { lat, lng } = data.results[0].geometry.location;
      const revUrl =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?latlng=${lat},${lng}&result_type=postal_code&key=${apiKey}`;

      const revRes = await fetch(revUrl);
      const revData = (await revRes.json()) as GeoResponse;

      for (const r of (revData.results ?? []).slice(0, 3)) {
        const pc = r.address_components?.find((c) =>
          c.types.includes("postal_code")
        );
        if (pc?.short_name) zips.add(pc.short_name);
      }
    }

    return [...zips].slice(0, 10);
  } catch (err) {
    console.error("Geocoding error:", err);
    return [];
  }
}

// ── Cloud Function ─────────────────────────────────────────────────────────────

export const nlSearch = onCall(
  { region: "us-central1", timeoutSeconds: 30 },
  async (request): Promise<NlSearchResponse> => {
    const { query } = request.data as { query?: string };
    if (!query?.trim()) {
      throw new HttpsError("invalid-argument", "query is required");
    }

    // 1. Parse natural language intent with Gemini
    const parsed = await parseQuery(query.trim());

    // 2. Resolve location → zip codes if needed
    let resolvedZips: string[] = [];
    if (parsed.zip) {
      resolvedZips = [parsed.zip];
    } else if (parsed.location) {
      const apiKey = mapsApiKey.value();
      resolvedZips = await resolveLocationToZips(parsed.location, apiKey);
    }

    // 3. Query Firestore
    const db = admin.firestore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.collection("vendors").where("discoverable", "==", true);

    if (parsed.category) {
      q = q.where("categories", "array-contains", parsed.category);
    }

    const snap = await q.limit(100).get();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let vendors: VendorResult[] = snap.docs.map((d: any) => ({
      uid: d.id,
      ...(d.data() as Omit<VendorResult, "uid">),
    }));

    // 4. Client-side zip filter
    if (resolvedZips.length > 0) {
      vendors = vendors.filter((v) =>
        resolvedZips.some((z) => v.serviceZipCodes?.includes(z))
      );
    }

    // 5. Sort: verified first, then self_verified, then unverified
    const tierRank: Record<string, number> = {
      verified: 0,
      self_verified: 1,
      unverified: 2,
    };
    vendors.sort(
      (a, b) =>
        (tierRank[a.overallTier ?? "unverified"] ?? 2) -
        (tierRank[b.overallTier ?? "unverified"] ?? 2)
    );

    return { vendors, parsed, resolvedZips };
  }
);
