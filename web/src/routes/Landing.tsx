import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2, ShieldCheck, Clock, X, SlidersHorizontal, LocateFixed,
  Wrench, Leaf, Zap, Wind, Paintbrush, Shield, Hammer, Building, ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getDiscoverableVendors, submitLead, nlSearchVendors } from "../lib/firestore";
import type { VendorPublicProfile, NlSearchParsed } from "../lib/firestore";
import { SERVICE_CATEGORIES, getCategoryLabel } from "../lib/categories";
import type { ServiceCategory } from "../lib/categories";
import type { VerificationTier } from "../lib/docTypes";
import { DOC_TYPE_ORDER, DOC_TYPE_SCHEMAS } from "../lib/docTypes";
import { useAuth } from "../contexts/AuthContext";
import ProjectPickerModal from "../components/ProjectPickerModal";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
    __mapsLoaded?: boolean;
    __mapsLoading?: boolean;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DisplayVendor = VendorPublicProfile & { uid: string; demo?: boolean };

// ── Hardcoded demo businesses ─────────────────────────────────────────────────

const DEMO_VENDORS: DisplayVendor[] = [
  {
    uid: "demo-1",
    businessName: "GreenScapes Landscaping",
    businessZipCode: "02116",
    serviceZipCodes: ["02116", "02115", "02118", "02130"],
    categories: ["landscaping"],
    discoverable: true,
    overallTier: "verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-2",
    businessName: "ProFlow Plumbing",
    businessZipCode: "02127",
    serviceZipCodes: ["02127", "02128", "02129", "02169", "02116", "02115", "02118", "02119", "02120"],
    categories: ["plumbing"],
    discoverable: true,
    overallTier: "verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-3",
    businessName: "Volt Logic Electric",
    businessZipCode: "02139",
    serviceZipCodes: ["02139", "02138", "02143", "02144"],
    categories: ["electrical"],
    discoverable: true,
    overallTier: "self_verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-4",
    businessName: "Arctic Air HVAC",
    businessZipCode: "02445",
    serviceZipCodes: ["02445", "02446", "02116", "02115"],
    categories: ["hvac"],
    discoverable: true,
    overallTier: "self_verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-5",
    businessName: "Fresh Coat Painting",
    businessZipCode: "02134",
    serviceZipCodes: ["02134", "02135", "02130", "02139"],
    categories: ["painting"],
    discoverable: true,
    overallTier: "unverified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-6",
    businessName: "Shield Pest Solutions",
    businessZipCode: "02143",
    serviceZipCodes: ["02143", "02144", "02145", "02139"],
    categories: ["pest_control"],
    discoverable: true,
    overallTier: "verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-7",
    businessName: "All-Pro Handyman Services",
    businessZipCode: "02118",
    serviceZipCodes: ["02116", "02118", "02119", "02120"],
    categories: ["general_handyman"],
    discoverable: true,
    overallTier: "unverified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-8",
    businessName: "Blue River Plumbing Co.",
    businessZipCode: "02169",
    serviceZipCodes: ["02169", "02170", "02171", "02127", "02128", "02129", "02130", "02134"],
    categories: ["plumbing", "general_handyman"],
    discoverable: true,
    overallTier: "self_verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-9",
    businessName: "Precision Climate Control",
    businessZipCode: "02451",
    serviceZipCodes: ["02451", "02452", "02445", "02472"],
    categories: ["hvac", "electrical"],
    discoverable: true,
    overallTier: "verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-10",
    businessName: "Worcester Pipe Works",
    businessZipCode: "01601",
    serviceZipCodes: ["01601", "01602", "01603", "01604", "01605"],
    categories: ["plumbing"],
    discoverable: true,
    overallTier: "verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-11",
    businessName: "Bay State HVAC",
    businessZipCode: "01101",
    serviceZipCodes: ["01101", "01103", "01104", "01108"],
    categories: ["hvac"],
    discoverable: true,
    overallTier: "self_verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-12",
    businessName: "Merrimack Valley Electric",
    businessZipCode: "01850",
    serviceZipCodes: ["01850", "01851", "01852", "01854"],
    categories: ["electrical"],
    discoverable: true,
    overallTier: "verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-13",
    businessName: "Cape Cod Lawn & Garden",
    businessZipCode: "02601",
    serviceZipCodes: ["02601", "02630", "02632", "02646"],
    categories: ["landscaping"],
    discoverable: true,
    overallTier: "self_verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-14",
    businessName: "North Shore Pest Control",
    businessZipCode: "01970",
    serviceZipCodes: ["01970", "01960", "01940"],
    categories: ["pest_control"],
    discoverable: true,
    overallTier: "verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-15",
    businessName: "Plymouth Rock Handyman",
    businessZipCode: "02360",
    serviceZipCodes: ["02360", "02361", "02364"],
    categories: ["general_handyman"],
    discoverable: true,
    overallTier: "unverified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-16",
    businessName: "Pioneer Valley Painters",
    businessZipCode: "01060",
    serviceZipCodes: ["01060", "01062", "01063"],
    categories: ["painting"],
    discoverable: true,
    overallTier: "self_verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-17",
    businessName: "MetroWest Home Services",
    businessZipCode: "01701",
    serviceZipCodes: ["01701", "01702", "02451", "02472"],
    categories: ["general_handyman", "painting"],
    discoverable: true,
    overallTier: "verified",
    createdAt: null as never,
    demo: true,
  },
  {
    uid: "demo-18",
    businessName: "South Shore Electric",
    businessZipCode: "02301",
    serviceZipCodes: ["02301", "02302", "02303", "02169"],
    categories: ["electrical"],
    discoverable: true,
    overallTier: "self_verified",
    createdAt: null as never,
    demo: true,
  },
];

// ── Category icons ────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<ServiceCategory, LucideIcon> = {
  plumbing: Wrench,
  landscaping: Leaf,
  electrical: Zap,
  hvac: Wind,
  painting: Paintbrush,
  pest_control: Shield,
  general_handyman: Hammer,
};


// ── Zip → approximate lat/lng (Boston metro) ─────────────────────────────────

const ZIP_COORDS: Record<string, [number, number]> = {
  // Boston metro
  "02115": [42.3442, -71.0966],
  "02116": [42.3484, -71.0831],
  "02118": [42.3399, -71.0721],
  "02119": [42.3232, -71.0842],
  "02120": [42.3306, -71.0982],
  "02127": [42.3361, -71.0465],
  "02128": [42.3698, -71.0126],
  "02129": [42.3766, -71.0617],
  "02130": [42.3091, -71.1126],
  "02134": [42.3533, -71.1309],
  "02135": [42.3576, -71.1543],
  "02138": [42.3756, -71.1227],
  "02139": [42.3662, -71.1056],
  "02143": [42.3876, -71.1003],
  "02144": [42.3969, -71.1208],
  "02145": [42.3895, -71.0789],
  "02169": [42.2529, -71.0023],
  "02170": [42.2684, -71.0201],
  "02171": [42.2851, -71.0074],
  "02445": [42.3317, -71.1253],
  "02446": [42.3434, -71.1318],
  "02451": [42.3765, -71.2356],
  "02452": [42.3654, -71.2426],
  "02472": [42.3720, -71.1757],
  // Worcester
  "01601": [42.2626, -71.8023],
  "01602": [42.2689, -71.8290],
  "01603": [42.2407, -71.8257],
  "01604": [42.2575, -71.7719],
  "01605": [42.2829, -71.7873],
  // Framingham
  "01701": [42.2793, -71.4162],
  "01702": [42.3062, -71.4359],
  // Lowell
  "01850": [42.6334, -71.3162],
  "01851": [42.6462, -71.3301],
  "01852": [42.6248, -71.3095],
  "01854": [42.6389, -71.2891],
  // Salem / North Shore
  "01970": [42.5195, -70.8967],
  "01960": [42.5340, -70.9285],
  "01940": [42.4668, -70.9565],
  // Springfield
  "01101": [42.1015, -72.5898],
  "01103": [42.1024, -72.5937],
  "01104": [42.1204, -72.5735],
  "01108": [42.0816, -72.5640],
  // Northampton
  "01060": [42.3251, -72.6412],
  "01062": [42.3487, -72.6876],
  "01063": [42.3162, -72.6320],
  // Plymouth
  "02360": [41.9584, -70.6673],
  "02361": [41.9450, -70.6562],
  "02364": [42.0987, -70.7190],
  // Cape Cod
  "02601": [41.6688, -70.2962],
  "02630": [41.6795, -70.3412],
  "02632": [41.6512, -70.2790],
  "02646": [41.6604, -70.0701],
  // Brockton
  "02301": [42.0834, -71.0184],
  "02302": [42.0723, -71.0301],
  "02303": [42.0945, -71.0023],
};

// ── Hero map ──────────────────────────────────────────────────────────────────

interface MapCircle { lat: number; lng: number; radiusM: number; }

function HeroMap({ vendors, circle }: { vendors: DisplayVendor[]; circle?: MapCircle | null }) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const circleRef = useRef<google.maps.Circle | null>(null);
  // Keep a ref so the async map-init callback can read the latest circle value
  const circlePropsRef = useRef<MapCircle | null | undefined>(circle);
  useEffect(() => { circlePropsRef.current = circle; }, [circle]);

  function applyCircle(map: google.maps.Map, c: MapCircle | null | undefined) {
    if (c) {
      if (!circleRef.current) {
        circleRef.current = new google.maps.Circle({
          map,
          strokeColor: "#0052cc",
          strokeOpacity: 0.7,
          strokeWeight: 2,
          fillColor: "#0052cc",
          fillOpacity: 0.08,
        });
      }
      circleRef.current.setCenter({ lat: c.lat, lng: c.lng });
      circleRef.current.setRadius(c.radiusM);
      const bounds = circleRef.current.getBounds();
      if (bounds) map.fitBounds(bounds);
    } else {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
        map.setCenter({ lat: 42.3601, lng: -71.0589 });
        map.setZoom(11);
      }
    }
  }

  useEffect(() => {
    if (!MAPS_API_KEY || MAPS_API_KEY === "REPLACE_ME") return;
    if (!mapDivRef.current) return;

    loadMapsApi().then(() => {
      if (!mapDivRef.current) return;

      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(mapDivRef.current, {
          center: { lat: 42.3601, lng: -71.0589 },
          zoom: 11,
          disableDefaultUI: true,
          zoomControl: false,
          gestureHandling: "cooperative",
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        // Apply circle that was set before the map was ready
        applyCircle(mapRef.current, circlePropsRef.current);
      }

      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      vendors.forEach((v) => {
        const coords = ZIP_COORDS[v.businessZipCode];
        if (!coords || !mapRef.current) return;
        const marker = new google.maps.Marker({
          position: { lat: coords[0], lng: coords[1] },
          map: mapRef.current,
          title: v.businessName,
        });
        markersRef.current.push(marker);
      });
    }).catch(() => { /* graceful degradation */ });
  }, [vendors]);

  // Update circle whenever it changes after the map is already initialized
  useEffect(() => {
    if (!mapRef.current) return;
    applyCircle(mapRef.current, circle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circle]);

  if (!MAPS_API_KEY || MAPS_API_KEY === "REPLACE_ME") {
    return (
      <iframe
        src="https://www.openstreetmap.org/export/embed.html?bbox=-71.25%2C42.27%2C-70.95%2C42.47&layer=mapnik"
        className="w-full h-full border-0"
        title="Service area map"
        loading="lazy"
      />
    );
  }

  return <div ref={mapDivRef} className="w-full h-full" />;
}

// ── Google Maps loader ────────────────────────────────────────────────────────

function loadMapsApi(): Promise<void> {
  if (window.__mapsLoaded) return Promise.resolve();
  if (window.__mapsLoading) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (window.__mapsLoaded) { clearInterval(interval); resolve(); }
      }, 100);
    });
  }
  window.__mapsLoading = true;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => { window.__mapsLoaded = true; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ── Client-side location → zip codes via Places API (no Geocoding API needed) ─
// Uses PlacesService.textSearch (Places API — already enabled) to get a city's
// bounding box, then matches entries in ZIP_COORDS that fall inside that box.
// A fast-path city lookup table is checked first so common city names always
// resolve correctly without relying on Places API viewport accuracy.

interface GeocodeResult { zips: string[]; center: { lat: number; lng: number } | null; }

/** Miles → approximate degrees (1° lat ≈ 69 miles) */
function milesToDeg(miles: number): number { return miles / 69; }

/**
 * Direct city-name → zip-codes lookup.
 * Checked before the Places API so common searches always resolve reliably.
 * Keys are lowercase; partial matches are supported (see geocodeToZips).
 */
const CITY_ZIP_LOOKUP: Record<string, string[]> = {
  // Boston proper + inner neighborhoods
  "boston":        ["02116","02115","02118","02119","02120","02127","02128","02129","02130","02134","02135"],
  "back bay":      ["02116","02115"],
  "south end":     ["02118","02119"],
  "south boston":  ["02127","02128"],
  "charlestown":   ["02129"],
  "jamaica plain": ["02130"],
  "allston":       ["02134","02135"],
  // Inner ring
  "cambridge":     ["02138","02139"],
  "somerville":    ["02143","02144","02145"],
  "brookline":     ["02445","02446"],
  "waltham":       ["02451","02452"],
  "newton":        ["02451","02452","02472"],
  "watertown":     ["02472"],
  // South Shore / Quincy
  "quincy":        ["02169","02170","02171"],
  "braintree":     ["02169","02184"],
  // Metro West
  "framingham":    ["01701","01702"],
  "natick":        ["01701","01760"],
  // Lowell / North Shore
  "lowell":        ["01850","01851","01852","01854"],
  "salem":         ["01970"],
  "peabody":       ["01960"],
  "lynn":          ["01940"],
  // Central MA
  "worcester":     ["01601","01602","01603","01604","01605"],
  // Western MA
  "springfield":   ["01101","01103","01104","01108"],
  "northampton":   ["01060","01062","01063"],
  // South Shore / Plymouth
  "plymouth":      ["02360","02361","02364"],
  "brockton":      ["02301","02302","02303"],
  // Cape Cod
  "cape cod":      ["02601","02630","02632","02646"],
  "hyannis":       ["02601"],
  "barnstable":    ["02630","02632"],
};

async function geocodeToZips(
  location: string,
  /** Extra search radius in miles added on top of the viewport (default 3 mi) */
  extraRadiusMiles = 3
): Promise<GeocodeResult> {
  if (!MAPS_API_KEY || MAPS_API_KEY === "REPLACE_ME") return { zips: [], center: null };
  try {
    // ── Fast path 1: direct 5-digit zip ──
    const directZip = location.trim().match(/^(\d{5})$/);
    if (directZip) {
      const coords = ZIP_COORDS[directZip[1]];
      return { zips: [directZip[1]], center: coords ? { lat: coords[0], lng: coords[1] } : null };
    }

    // ── Fast path 2: known city name lookup (no API call needed) ──
    const normalized = location.trim().toLowerCase().replace(/,\s*(ma|massachusetts|usa?)$/i, "").trim();
    if (CITY_ZIP_LOOKUP[normalized]) {
      const zips = CITY_ZIP_LOOKUP[normalized];
      // Compute centroid from the first zip's coords as the map circle center
      const firstCoords = ZIP_COORDS[zips[0]];
      return {
        zips,
        center: firstCoords ? { lat: firstCoords[0], lng: firstCoords[1] } : null,
      };
    }

    await loadMapsApi();
    const svc = new window.google!.maps.places.PlacesService(document.createElement("div"));

    const geoResult = await new Promise<{
      bounds: { neLat: number; neLng: number; swLat: number; swLng: number };
      center: { lat: number; lng: number };
    } | null>((resolve) => {
      svc.textSearch({ query: `${location}, USA` }, (results, status) => {
        if (status !== window.google!.maps.places.PlacesServiceStatus.OK || !results?.length) {
          resolve(null); return;
        }
        // Prefer geographic types over points of interest ("Quincy Market" vs "Quincy, MA")
        const GEO_TYPES = [
          "locality", "sublocality", "sublocality_level_1", "neighborhood",
          "postal_code", "administrative_area_level_2", "administrative_area_level_3", "political",
        ];
        const best = results.find((r) => r.types?.some((t) => GEO_TYPES.includes(t))) ?? results[0];
        const geo = best.geometry;
        if (!geo) { resolve(null); return; }

        const lat = geo.location!.lat();
        const lng = geo.location!.lng();
        const BUFFER = milesToDeg(extraRadiusMiles);

        if (geo.viewport) {
          resolve({
            center: { lat, lng },
            bounds: {
              neLat: geo.viewport.getNorthEast().lat() + BUFFER,
              neLng: geo.viewport.getNorthEast().lng() + BUFFER,
              swLat: geo.viewport.getSouthWest().lat() - BUFFER,
              swLng: geo.viewport.getSouthWest().lng() - BUFFER,
            },
          });
        } else {
          const r = Math.max(BUFFER, milesToDeg(10));
          resolve({ center: { lat, lng }, bounds: { neLat: lat + r, neLng: lng + r, swLat: lat - r, swLng: lng - r } });
        }
      });
    });

    if (!geoResult) return { zips: [], center: null };
    const { bounds, center } = geoResult;
    const zips = Object.entries(ZIP_COORDS)
      .filter(([, [lat, lng]]) => lat >= bounds.swLat && lat <= bounds.neLat && lng >= bounds.swLng && lng <= bounds.neLng)
      .map(([zip]) => zip);

    return { zips, center };
  } catch {
    return { zips: [], center: null };
  }
}

// Extract location string from raw query ("plumbing in boston" → "boston")
function extractLocationFromQuery(q: string): string | null {
  const m = q.trim().match(/\b(?:in|near|around|close to)\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// ── Places Autocomplete hook ──────────────────────────────────────────────────

function usePlacesAutocomplete(
  inputRef: React.RefObject<HTMLInputElement>,
  enabled: boolean
) {
  const [place, setPlace] = useState<{ description: string; zip?: string; lat?: number; lng?: number } | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!enabled || !inputRef.current || !MAPS_API_KEY || MAPS_API_KEY === "REPLACE_ME") return;

    loadMapsApi()
      .then(() => {
        if (!inputRef.current) return;
        const ac = new window.google!.maps.places.Autocomplete(inputRef.current, {
          types: ["geocode"],
          componentRestrictions: { country: "us" },
          fields: ["formatted_address", "address_components", "geometry"],
        });
        autocompleteRef.current = ac;

        ac.addListener("place_changed", () => {
          const p = ac.getPlace();
          if (!p) return;

          const postal = p.address_components?.find((c: google.maps.GeocoderAddressComponent) =>
            c.types.includes("postal_code")
          );
          const loc = p.geometry?.location;

          setPlace({
            description: p.formatted_address ?? inputRef.current?.value ?? "",
            zip: postal?.short_name,
            lat: loc?.lat(),
            lng: loc?.lng(),
          });
        });
      })
      .catch(() => { /* Maps API not loaded — graceful degradation */ });

    return () => {
      if (autocompleteRef.current) {
        window.google?.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [enabled, inputRef]);

  return { place, resetPlace: () => setPlace(null) };
}

// ── Search bar ────────────────────────────────────────────────────────────────

const SEARCH_PLACEHOLDERS = [
  "Plumbing service in Back Bay…",
  "Electricians near Cambridge…",
  "HVAC contractors in Brookline…",
];

interface SearchBarProps {
  allVendors: DisplayVendor[];
  onResults: (vendors: DisplayVendor[], parsed: NlSearchParsed | null, resolvedZips: string[], rawQuery: string) => void;
  onClear: () => void;
  onCircleUpdate?: (circle: MapCircle | null) => void;
}

function SearchBar({ allVendors, onResults, onClear, onCircleUpdate }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [category, setCategory] = useState<ServiceCategory | "">("");
  const [locationInput, setLocationInput] = useState("");
  const [radius, setRadius] = useState<string>("10");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [resolvedCenter, setResolvedCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
  const locationRef = useRef<HTMLInputElement>(null);
  const typewriterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { place } = usePlacesAutocomplete(locationRef, showFilters);

  // Typewriter: type → pause → delete → next
  useEffect(() => {
    let idx = 0;
    let charPos = 0;
    let deleting = false;

    function tick() {
      const full = SEARCH_PLACEHOLDERS[idx];
      if (!deleting) {
        charPos++;
        setDisplayedPlaceholder(full.slice(0, charPos));
        if (charPos === full.length) {
          deleting = true;
          typewriterTimer.current = setTimeout(tick, 1800);
        } else {
          typewriterTimer.current = setTimeout(tick, 60);
        }
      } else {
        charPos--;
        setDisplayedPlaceholder(full.slice(0, charPos));
        if (charPos === 0) {
          deleting = false;
          idx = (idx + 1) % SEARCH_PLACEHOLDERS.length;
          typewriterTimer.current = setTimeout(tick, 400);
        } else {
          typewriterTimer.current = setTimeout(tick, 35);
        }
      }
    }

    typewriterTimer.current = setTimeout(tick, 600);
    return () => { if (typewriterTimer.current) clearTimeout(typewriterTimer.current); };
  }, []);

  // Emit circle whenever center or radius changes
  useEffect(() => {
    if (!onCircleUpdate) return;
    if (resolvedCenter) {
      onCircleUpdate({ ...resolvedCenter, radiusM: parseFloat(radius) * 1609.34 });
    } else {
      onCircleUpdate(null);
    }
  }, [resolvedCenter, radius, onCircleUpdate]);

  async function handleLocate() {
    if (!navigator.geolocation) { setError("Geolocation is not supported by your browser."); return; }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { latitude: lat, longitude: lng } = coords;
          setResolvedCenter({ lat, lng });
          // Try Google Maps reverse geocoding first
          if (MAPS_API_KEY && MAPS_API_KEY !== "REPLACE_ME") {
            const res = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_API_KEY}`
            );
            const data = await res.json();
            const postal = data.results?.[0]?.address_components?.find(
              (c: { types: string[] }) => c.types.includes("postal_code")
            );
            if (postal?.short_name) { setLocationInput(postal.short_name); return; }
            const formatted = data.results?.[0]?.formatted_address;
            if (formatted) { setLocationInput(formatted); return; }
          }
          // Fallback: Nominatim (OpenStreetMap)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          const data = await res.json();
          const zip = data.address?.postcode;
          setLocationInput(zip ?? data.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } catch {
          setError("Could not determine your location. Try typing it instead.");
        } finally {
          setLocating(false);
        }
      },
      () => { setError("Location access denied. Please allow location or type it manually."); setLocating(false); }
    );
  }

  // When Places picks a place, sync input value and resolved center
  useEffect(() => {
    if (place) {
      setLocationInput(place.description);
      if (place.lat != null && place.lng != null) {
        setResolvedCenter({ lat: place.lat, lng: place.lng });
      }
    }
  }, [place]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const hasNlQuery = query.trim().length > 0;
      const hasFilters = category !== "" || locationInput.trim() !== "";

      if (!hasNlQuery && !hasFilters) {
        setError("Enter a search query or select filters.");
        return;
      }

      setLoading(true);
      setHasSearched(true);

      try {
        // ── Natural language path via Cloud Function ──
        if (hasNlQuery) {
          // Append manual filter hints to the NL query if user also set them
          let enrichedQuery = query.trim();
          if (category) enrichedQuery += ` category:${category}`;
          if (locationInput.trim()) enrichedQuery += ` location:${locationInput.trim()}`;

          const result = await nlSearchVendors(enrichedQuery);

          // If server didn't geocode the location, try client-side as fallback.
          // Also fall back to extracting location from the raw query in case Gemini
          // didn't parse it (e.g. "Plumbing in Boston" → location: null).
          let resolvedZips = result.resolvedZips;
          if (resolvedZips.length === 0) {
            const locationStr =
              result.parsed?.location ?? extractLocationFromQuery(query.trim());
            if (locationStr) {
              const geo = await geocodeToZips(locationStr);
              resolvedZips = geo.zips;
              if (geo.center) setResolvedCenter(geo.center);
            }
          }

          onResults(result.vendors as DisplayVendor[], result.parsed, resolvedZips, query.trim());
          return;
        }

        // ── Manual filter path (category + location + radius dropdowns) ──
        const radiusMiles = parseFloat(radius) || 10;
        let resolvedZips: string[] = [];

        if (locationInput.trim()) {
          const geo = await geocodeToZips(locationInput.trim(), radiusMiles);
          resolvedZips = geo.zips;
          if (geo.center) setResolvedCenter(geo.center);
          else setResolvedCenter(null);
        } else {
          setResolvedCenter(null);
        }

        // Filter allVendors by category and resolved zips
        let filtered = allVendors;
        if (category) {
          filtered = filtered.filter((v) => v.categories.includes(category as ServiceCategory));
        }
        if (resolvedZips.length > 0) {
          filtered = filtered.filter((v) => resolvedZips.some((z) => v.serviceZipCodes?.includes(z)));
        }

        // Build a synthetic parsed so handleResults can show the intent chip
        const syntheticParsed = {
          category: category || null,
          zip: null,
          location: locationInput.trim() || null,
        } as NlSearchParsed;

        onResults(filtered, syntheticParsed, resolvedZips, "");
      } catch (err) {
        console.error("Search error:", err);
        setError("Search failed. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [query, category, locationInput, radius, place, allVendors, onResults, setResolvedCenter]
  );

  function handleClear() {
    setQuery("");
    setCategory("");
    setLocationInput("");
    setResolvedCenter(null);
    setHasSearched(false);
    setError(null);
    onClear();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-lg">
      <div className="flex items-center gap-sm border border-outline-variant rounded-full bg-white px-lg shadow-sm focus-within:border-primary transition-colors overflow-hidden">
        {/* Both modes are always mounted; opacity + translate cross-fades between them */}
        <div className="relative flex-1 min-w-0" style={{ minHeight: "calc(1em + 2 * var(--spacing-md, 16px))" }}>

          {/* ── NL mode ── */}
          <div className={`flex items-center gap-sm transition-all duration-200 ease-out ${
            showFilters ? "opacity-0 translate-y-1 pointer-events-none absolute inset-0" : "opacity-100 translate-y-0"
          }`}>
            <div className="relative flex-1 min-w-0">
              <input
                className="w-full bg-transparent outline-none text-body-md text-on-surface py-md"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Natural language search"
                tabIndex={showFilters ? -1 : 0}
              />
              {/* Typewriter placeholder — hidden once user types */}
              {!query && (
                <span className="absolute inset-0 flex items-center pointer-events-none text-body-md text-on-surface-variant opacity-40">
                  {displayedPlaceholder}
                  <span className="ml-px animate-pulse">|</span>
                </span>
              )}
            </div>
            {hasSearched && (
              <button
                type="button"
                className="text-on-surface-variant hover:text-on-surface flex-shrink-0"
                onClick={handleClear}
                aria-label="Clear search"
                tabIndex={showFilters ? -1 : 0}
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </div>

          {/* ── Filter mode ── */}
          <div className={`flex items-center gap-sm transition-all duration-200 ease-out ${
            showFilters ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none absolute inset-0"
          }`}>
            <select
              className="flex-1 min-w-0 bg-transparent outline-none text-body-md text-on-surface py-md appearance-none cursor-pointer"
              value={category}
              onChange={(e) => setCategory(e.target.value as ServiceCategory | "")}
              aria-label="Service category"
              tabIndex={showFilters ? 0 : -1}
            >
              <option value="">All Services</option>
              {SERVICE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
              ))}
            </select>
            <div className="w-px self-stretch bg-outline-variant flex-shrink-0 my-sm" />
            <button
              type="button"
              onClick={handleLocate}
              disabled={locating}
              aria-label="Use my current location"
              className="flex-shrink-0 px-xs text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
              tabIndex={showFilters ? 0 : -1}
            >
              {locating
                ? <Loader2 size={14} aria-hidden className="animate-spin" />
                : <LocateFixed size={14} aria-hidden />}
            </button>
            <input
              ref={locationRef}
              className="flex-1 min-w-0 bg-transparent outline-none text-body-md text-on-surface placeholder:text-on-surface-variant py-md"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder={MAPS_API_KEY && MAPS_API_KEY !== "REPLACE_ME" ? "City, neighborhood, or zip" : "5-digit zip code"}
              aria-label="Location"
              tabIndex={showFilters ? 0 : -1}
            />
            <div className="w-px self-stretch bg-outline-variant flex-shrink-0 my-sm" />
            <select
              className="bg-transparent pl-sm outline-none appearance-none text-body-md text-on-surface py-md flex-shrink-0 cursor-pointer"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              aria-label="Search radius"
              tabIndex={showFilters ? 0 : -1}
            >
              <option value="5">5 mi</option>
              <option value="10">10 mi</option>
              <option value="25">25 mi</option>
              <option value="50">50 mi</option>
              <option value="100">100 mi</option>
            </select>
          </div>

        </div>

        {/* Filter toggle — always visible */}
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          aria-label="Toggle filters"
          className={`flex-shrink-0 p-xs rounded transition-colors ${
            showFilters ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <SlidersHorizontal size={18} aria-hidden />
        </button>
        <button
          type="submit"
          className="btn-primary flex-shrink-0 px-lg py-sm text-body-md"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-xs">
              <Loader2 size={14} aria-hidden className="animate-spin" /> Searching…
            </span>
          ) : (
            "Search"
          )}
        </button>
      </div>

      {error && <p className="text-body-sm text-error mt-xs">{error}</p>}
    </form>
  );
}

// ── Parsed intent chip ────────────────────────────────────────────────────────

function IntentChip({ parsed, zips }: { parsed: NlSearchParsed; zips: string[] }) {
  const parts: string[] = [];
  if (parsed.category) parts.push(getCategoryLabel(parsed.category as ServiceCategory));
  if (parsed.location) parts.push(parsed.location);
  else if (zips.length > 0) parts.push(zips.slice(0, 3).join(", "));

  if (parts.length === 0) return null;

  return (
    <div className="flex items-center gap-xs text-body-sm text-on-surface-variant bg-surface-container px-sm py-xs rounded-full w-fit">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4.5 6l1 1L7.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        Showing: <span className="font-semibold text-on-surface">{parts.join(" · ")}</span>
      </span>
    </div>
  );
}

// ── Vendor card ───────────────────────────────────────────────────────────────


const CATEGORY_IMAGES: Partial<Record<ServiceCategory, string>> = {
  plumbing:        "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=160&h=160&fit=crop&auto=format&q=80",
  landscaping:     "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=160&h=160&fit=crop&auto=format&q=80",
  electrical:      "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=160&h=160&fit=crop&auto=format&q=80",
  hvac:            "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=160&h=160&fit=crop&auto=format&q=80",
  painting:        "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=160&h=160&fit=crop&auto=format&q=80",
  pest_control:    "https://images.unsplash.com/photo-1632864952744-6ea9c3484ffe?w=160&h=160&fit=crop&auto=format&q=80",
  general_handyman:"https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=160&h=160&fit=crop&auto=format&q=80",
};

const TIER_BADGE: Record<string, { pill: string; icon: React.ReactNode; label: string; labelColor: string; tagline: string }> = {
  verified: {
    pill: "bg-primary",
    icon: <ShieldCheck size={11} className="text-white" aria-hidden />,
    label: "Verified",
    labelColor: "text-white",
    tagline: "All compliance documents verified",
  },
  self_verified: {
    pill: "bg-amber-100",
    icon: <Clock size={11} className="text-amber-700" aria-hidden />,
    label: "Self-Verified",
    labelColor: "text-amber-800",
    tagline: "Self-reported · Awaiting document review",
  },
  unverified: {
    pill: "bg-surface-container",
    icon: <Shield size={11} className="text-on-surface-variant" aria-hidden />,
    label: "Unverified",
    labelColor: "text-on-surface-variant",
    tagline: "No compliance documents on file",
  },
};

function VendorCard({ vendor, onClick }: { vendor: DisplayVendor; onClick: () => void }) {
  const CategoryIcon = vendor.categories[0] ? CATEGORY_ICONS[vendor.categories[0]] : Building;
  const tierKey = vendor.overallTier ?? "unverified";
  const badge = TIER_BADGE[tierKey] ?? TIER_BADGE.unverified;
  const imgSrc = vendor.categories[0] ? CATEGORY_IMAGES[vendor.categories[0]] : undefined;

  return (
    <button
      onClick={onClick}
      className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col w-full text-left hover:border-primary hover:shadow-md transition-all group"
    >
      {/* ── Card body ── */}
      <div className="p-md flex items-start gap-md">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-surface-container flex-shrink-0 flex items-center justify-center text-on-surface-variant">
          {imgSrc ? (
            <img src={imgSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <CategoryIcon size={36} aria-hidden />
          )}
        </div>
        <div className="flex-1 min-w-0 pt-xs">
          <div className="flex items-start justify-between gap-xs">
            <p className="text-h2 text-on-surface leading-snug flex-1 min-w-0">
              {vendor.businessName}
              <span className={`inline-flex items-center justify-center w-5 h-5 ${badge.pill} rounded-full ml-[6px] align-middle`}>
                {badge.icon}
              </span>
            </p>
            <ChevronRight size={14} className="flex-shrink-0 text-on-surface-variant group-hover:text-primary transition-colors mt-[3px]" aria-hidden />
          </div>
          <p className="text-body-sm text-on-surface-variant mt-xs">
            {vendor.categories.map(getCategoryLabel).join(" · ")}
            <span className="mx-xs opacity-40">·</span>
            {vendor.businessZipCode}
          </p>
        </div>
      </div>
    </button>
  );
}

// ── Vendor detail modal ───────────────────────────────────────────────────────

function docStatusForTier(overallTier: VerificationTier | undefined): VerificationTier | "missing" {
  if (overallTier === "verified") return "verified";
  if (overallTier === "self_verified") return "self_verified";
  return "missing";
}

function DocStatusBadge({ status }: { status: VerificationTier | "missing" }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-xs text-body-sm font-semibold text-on-primary bg-primary-container px-sm py-xs rounded">
        <ShieldCheck size={12} aria-hidden /> Verified
      </span>
    );
  }
  if (status === "self_verified") {
    return (
      <span className="inline-flex items-center gap-xs text-body-sm font-semibold text-on-surface bg-tier-2-bg px-sm py-xs rounded">
        <Clock size={12} aria-hidden /> Self-Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-body-sm text-on-surface-variant border border-tier-1-border px-sm py-xs rounded">
      Not uploaded
    </span>
  );
}

function VendorDetailModal({
  vendor,
  onClose,
  onInvite,
}: {
  vendor: DisplayVendor;
  onClose: () => void;
  onInvite: () => void;
}) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const docStatus = docStatusForTier(vendor.overallTier);

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isLoggedIn = !!user;
  const isPm = profile?.role === "property_manager";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay px-md"
      onClick={handleBackdrop}
    >
      <div className="modal w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-md mb-md">
          <div>
            <h2 className="text-h1 text-on-surface">{vendor.businessName}</h2>
            <p className="text-body-sm text-on-surface-variant mt-xs">{vendor.businessZipCode}</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface flex-shrink-0 mt-xs" aria-label="Close">
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="mb-md"><TierChip tier={vendor.overallTier} /></div>

        <div className="flex flex-wrap gap-xs mb-lg">
          {vendor.categories.map((cat) => {
            const CatIcon = CATEGORY_ICONS[cat];
            return (
              <span key={cat} className="inline-flex items-center gap-xs bg-surface-container text-on-surface-variant text-body-sm px-sm py-xs rounded">
                <CatIcon size={14} aria-hidden />
                {getCategoryLabel(cat)}
              </span>
            );
          })}
        </div>

        <div className="mb-lg">
          <p className="text-label-caps uppercase text-on-surface-variant mb-sm">Service Area</p>
          <div className="flex flex-wrap gap-xs">
            {(vendor.serviceZipCodes ?? [vendor.businessZipCode]).map((zip) => (
              <span key={zip} className="bg-surface-container text-on-surface text-body-sm px-sm py-xs rounded">
                {zip}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-lg">
          <p className="text-label-caps uppercase text-on-surface-variant mb-sm">Compliance Documents</p>
          <div className="space-y-sm">
            {DOC_TYPE_ORDER.map((docType) => (
              <div key={docType} className="flex items-center justify-between gap-md py-xs border-b border-outline-variant last:border-0">
                <span className="text-body-md text-on-surface font-semibold">
                  {DOC_TYPE_SCHEMAS[docType].label}
                </span>
                <DocStatusBadge status={docStatus} />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-sm border-t border-outline-variant">
          {!isLoggedIn && (
            <div className="space-y-sm">
              <p className="text-body-sm text-on-surface-variant">Sign in to invite this vendor to your project.</p>
              <div className="flex gap-sm">
                <button className="btn-primary flex-1" onClick={() => navigate("/login")}>Sign in to Contact</button>
                <button className="btn-secondary flex-1" onClick={() => navigate("/signup")}>Create Account</button>
              </div>
            </div>
          )}
          {isLoggedIn && isPm && !vendor.demo && (
            <button className="btn-primary w-full" onClick={onInvite}>Request Quote</button>
          )}
          {isLoggedIn && isPm && vendor.demo && (
            <p className="text-body-sm text-on-surface-variant">
              This is a sample listing. Real vendors appear in search results once they register.
            </p>
          )}
          {isLoggedIn && !isPm && (
            <p className="text-body-sm text-on-surface-variant text-center">
              Only property managers can invite vendors.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TierChip({ tier }: { tier: VerificationTier | undefined }) {
  if (tier === "verified") {
    return (
      <span className="inline-flex items-center gap-xs text-body-sm font-semibold text-on-primary bg-primary-container px-sm py-xs rounded">
        <ShieldCheck size={12} aria-hidden /> Verified
      </span>
    );
  }
  if (tier === "self_verified") {
    return (
      <span className="inline-flex items-center gap-xs text-body-sm font-semibold text-on-surface bg-tier-2-bg px-sm py-xs rounded">
        <Clock size={12} aria-hidden /> Self-Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-body-sm text-on-surface-variant border border-tier-1-border px-sm py-xs rounded">
      Unverified
    </span>
  );
}

// ── Sidebar panels ────────────────────────────────────────────────────────────

function ComplianceTiersPanel() {
  return (
    <div className="border border-outline-variant rounded bg-surface-container-lowest p-md">
      <p className="text-label-caps uppercase text-on-surface-variant mb-md tracking-widest">Compliance Tiers</p>
      <div className="space-y-md">
        {[
          { bar: "bg-primary-container", label: "Tier 3: Verified", color: "text-primary", desc: "Documents reviewed and approved by VendorPass. Highest trust level." },
          { bar: "bg-tier-2-bg border border-outline-variant", label: "Tier 2: Self-Verified", color: "text-on-surface", desc: "Documentation submitted by the vendor, awaiting admin review." },
          { bar: "bg-outline-variant", label: "Tier 1: Unverified", color: "text-on-surface-variant", desc: "Basic profile only. No verified documentation on file." },
        ].map(({ bar, label, color, desc }) => (
          <div key={label} className="flex gap-sm">
            <div className={`w-1 rounded-full flex-shrink-0 ${bar}`} />
            <div>
              <p className={`text-body-sm font-semibold ${color}`}>{label}</p>
              <p className="text-body-sm text-on-surface-variant mt-xs">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhyVendorPassPanel() {
  return (
    <div className="border border-outline-variant rounded bg-primary-container p-md">
      <p className="text-label-caps uppercase text-on-primary mb-md tracking-widest">Why VendorPass?</p>
      <ul className="space-y-sm">
        {["Instant compliance document check", "Insurance & license verification", "Expiration date tracking & alerts", "Risk-scored vendor roster"].map((item) => (
          <li key={item} className="flex items-start gap-sm text-body-sm text-on-primary">
            <span className="flex-shrink-0 mt-xs">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VendorCTAPanel({
  submitted, email, setEmail, emailError, setEmailError,
  submitError, submitting, onSubmit,
}: {
  submitted: boolean; email: string; setEmail: (v: string) => void;
  emailError: string | null; setEmailError: (v: string | null) => void;
  submitError: string | null; submitting: boolean; onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="border border-outline-variant rounded bg-surface-container-lowest p-md">
      <p className="text-h2 text-on-surface mb-xs">Are you a vendor?</p>
      <p className="text-body-sm text-on-surface-variant mb-md">
        Register your business to appear in property manager searches.
      </p>
      <Link to="/signup" className="btn-primary block text-center mb-md">Register Your Business</Link>
      {submitted ? (
        <p className="text-body-sm text-on-surface-variant text-center">You're on the list. We'll be in touch.</p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-xs">
          <input
            type="email"
            className={`input w-full ${emailError ? "input-error" : ""}`}
            placeholder="Email for updates"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
          />
          {emailError && <p className="text-body-sm text-error">{emailError}</p>}
          {submitError && <p className="text-body-sm text-error">{submitError}</p>}
          <button type="submit" className="btn-secondary w-full" disabled={submitting}>
            {submitting ? "Joining…" : "Stay updated"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Landing() {
  const { user, profile } = useAuth();
  const dashboardPath =
    profile?.role === "property_manager" ? "/dashboard?tab=projects" :
    profile?.role === "vendor" ? "/vendor" :
    profile?.role === "admin" ? "/admin" : "/dashboard";

  const [allVendors, setAllVendors] = useState<DisplayVendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [displayVendors, setDisplayVendors] = useState<DisplayVendor[]>([]);
  const [activeFilter, setActiveFilter] = useState(false);
  const [lastParsed, setLastParsed] = useState<NlSearchParsed | null>(null);
  const [lastZips, setLastZips] = useState<string[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<DisplayVendor | null>(null);
  const [inviteVendor, setInviteVendor] = useState<DisplayVendor | null>(null);
  const [mapCircle, setMapCircle] = useState<MapCircle | null>({
    lat: 42.3601,
    lng: -71.0589,
    radiusM: 10 * 1609.34,
  });

  // Waitlist state
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load reCAPTCHA
  useEffect(() => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
    if (!siteKey) return;
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  // Load all real vendors on mount, merge with demo
  useEffect(() => {
    getDiscoverableVendors()
      .then((real) => {
        const realUids = new Set(real.map((v) => v.uid));
        const filteredDemo = DEMO_VENDORS.filter((d) => !realUids.has(d.uid));
        const merged = [...real, ...filteredDemo];
        setAllVendors(merged);
        setDisplayVendors(merged);
      })
      .catch(() => {
        setAllVendors(DEMO_VENDORS);
        setDisplayVendors(DEMO_VENDORS);
      })
      .finally(() => setLoadingVendors(false));
  }, []);

  // Client-side keyword fallback — used when Cloud Function returns no category
  function keywordCategoryFromQuery(q: string): ServiceCategory | null {
    const s = q.toLowerCase();
    if (/plumb|pipe|drain|leak|faucet|sewer|water heater/.test(s)) return "plumbing";
    if (/electric|wiring|outlet|panel|circuit|lighting|breaker/.test(s)) return "electrical";
    if (/landscap|lawn|garden|grass|tree|yard|mow|hedge/.test(s)) return "landscaping";
    if (/hvac|air.?condition|heating|furnace|heat pump|ventilation/.test(s)) return "hvac";
    if (/paint|stain|primer/.test(s)) return "painting";
    if (/pest|bug|rodent|termite|exterminator|fumigat|insect|roach/.test(s)) return "pest_control";
    if (/handyman|odd.?job|mainten|general contractor/.test(s)) return "general_handyman";
    return null;
  }

  function handleResults(vendors: DisplayVendor[], parsed: NlSearchParsed | null, resolvedZips: string[], rawQuery: string) {
    // If Cloud Function didn't detect a category, fall back to local keyword matching
    const detectedCategory: ServiceCategory | null =
      (parsed?.category as ServiceCategory | null) ?? keywordCategoryFromQuery(rawQuery);

    const hasIntent = !!(detectedCategory || parsed?.zip || parsed?.location || resolvedZips.length > 0);

    // Filter real vendors by detected category if the Cloud Function didn't do it server-side
    let filteredVendors = vendors;
    if (detectedCategory && !parsed?.category) {
      // Cloud Function returned no category — apply category filter client-side
      filteredVendors = vendors.filter((v) => v.categories.includes(detectedCategory));
    }

    // Detect whether user specified a geographic location in the query
    const locationSpecified = !!(
      parsed?.location ||
      parsed?.zip ||
      /\b(in|near|around|close to)\b/.test(rawQuery.toLowerCase())
    );
    const locationResolved = resolvedZips.length > 0 || !!(parsed?.zip);

    // If location was specified but couldn't be geocoded, we can't verify any vendor
    // serves that area — filter real vendors by zip too (or clear if unresolvable)
    if (locationSpecified && !locationResolved) {
      filteredVendors = [];
    } else if (resolvedZips.length > 0) {
      filteredVendors = filteredVendors.filter((v) =>
        resolvedZips.some((z) => v.serviceZipCodes?.includes(z))
      );
    }

    const filteredUids = new Set(filteredVendors.map((v) => v.uid));
    let demos = DEMO_VENDORS.filter((d) => !filteredUids.has(d.uid));

    if (hasIntent) {
      if (detectedCategory) {
        demos = demos.filter((d) => d.categories.includes(detectedCategory));
      }
      if (locationSpecified && !locationResolved) {
        // User specified a location but we couldn't geocode it —
        // hide demos too since their hardcoded zip codes don't match the searched area
        demos = [];
      } else if (resolvedZips.length > 0) {
        // Always apply the zip filter — never keep demos that don't serve this area
        demos = demos.filter((d) =>
          resolvedZips.some((z) => d.serviceZipCodes?.includes(z))
        );
      }
    }

    const effectiveParsed = parsed ?? (detectedCategory ? { category: detectedCategory, zip: null, location: null } : null);
    setDisplayVendors([...filteredVendors, ...demos]);
    setActiveFilter(true);
    setLastParsed(effectiveParsed);
    setLastZips(resolvedZips);
  }

  function handleClear() {
    setDisplayVendors(allVendors);
    setActiveFilter(false);
    setLastParsed(null);
    setLastZips([]);
  }

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) { setEmailError("Please enter a valid email address."); return; }
    setEmailError(null);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
      if (siteKey && window.grecaptcha) {
        await new Promise<void>((resolve) => window.grecaptcha!.ready(resolve));
        await window.grecaptcha!.execute(siteKey, { action: "waitlist" });
      }
      await submitLead(email);
      setSubmitted(true);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">

      {/* ── Nav ── */}
      <header className="bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-10">
        <div className="page-container flex items-center justify-between h-14">
          <span className="text-h2 text-on-surface font-bold">VendorPass.</span>
          <div className="flex items-center gap-sm">
            {user ? (
              <>
                <span className="text-body-sm text-on-surface-variant hidden sm:block">
                  {profile?.displayName || user.email}
                </span>
                <Link to={dashboardPath} className="btn-primary">Dashboard</Link>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-tertiary text-body-sm">Sign in</Link>
                <Link to="/signup" className="btn-primary">Add Your Business</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Map ── */}
      <section className="w-full" style={{ height: "300px" }}>
        <HeroMap vendors={allVendors} circle={mapCircle} />
      </section>

      {/* ── Hero ── */}
      <section className="bg-surface-container-lowest border-b border-outline-variant relative z-10 rounded-tl-3xl rounded-tr-3xl shadow-modal" style={{ minHeight: "280px", marginTop: "-32px" }}>
        <div className="page-container pt-xl flex flex-col items-center text-center" style={{ paddingBottom: "40px" }}>
          <h1 className="text-on-surface font-bold max-w-lg" style={{ fontSize: "32px", lineHeight: "40px" }}>
            Find the good hands in local.
          </h1>
          <p className="mt-sm text-body-md text-on-surface-variant max-w-lg">
            Find and verify professional service providers across your entire property portfolio. All
            vendors are categorized by risk-mitigation tiers.
          </p>
          <div className="w-full max-w-2xl">
            <SearchBar
              allVendors={allVendors}
              onResults={handleResults}
              onClear={handleClear}
              onCircleUpdate={setMapCircle}
            />
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="flex-1">
        <div className="page-container py-lg flex gap-lg items-start">

          {/* Main results */}
          <main className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-md flex-wrap gap-sm">
              <div className="space-y-xs">
                <p className="text-h2 text-on-surface">
                  Registered Businesses
                  {!loadingVendors && (
                    <span className="ml-sm text-body-md text-on-surface-variant font-normal">
                      ({displayVendors.length})
                    </span>
                  )}
                </p>
                {activeFilter && lastParsed && (
                  <IntentChip parsed={lastParsed} zips={lastZips} />
                )}
              </div>
              {activeFilter && (
                <button
                  onClick={handleClear}
                  className="text-body-sm text-primary underline underline-offset-2"
                >
                  Clear filter
                </button>
              )}
            </div>

            {loadingVendors ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-44 bg-surface-container rounded animate-pulse" />
                ))}
              </div>
            ) : displayVendors.length === 0 && activeFilter ? (
              <>
                {/* Empty state */}
                <div className="flex flex-col items-center justify-center gap-md py-xl border border-dashed border-outline-variant rounded-xl text-center px-lg mb-xl">
                  <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center">
                    <Building className="w-7 h-7 text-on-surface-variant" />
                  </div>
                  <div>
                    <p className="text-body-lg font-semibold text-on-surface">No vendors found in this area</p>
                    <p className="mt-xs text-body-md text-on-surface-variant max-w-sm">
                      We couldn't find any registered vendors matching your search.{" "}
                      <button
                        onClick={handleClear}
                        className="text-primary underline underline-offset-2 font-medium"
                      >
                        Clear the filter
                      </button>{" "}
                      to browse all vendors, or try a different location or service.
                    </p>
                  </div>
                </div>

                {/* Other vendors on the platform */}
                {allVendors.length > 0 && (
                  <div>
                    <p className="text-body-lg font-semibold text-on-surface mb-sm">
                      Other vendors on the platform
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
                      {allVendors.slice(0, 6).map((vendor) => (
                        <VendorCard key={vendor.uid} vendor={vendor} onClick={() => setSelectedVendor(vendor)} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
                {displayVendors.map((vendor) => (
                  <VendorCard key={vendor.uid} vendor={vendor} onClick={() => setSelectedVendor(vendor)} />
                ))}
              </div>
            )}
          </main>

          {/* Sidebar */}
          <aside className="w-72 flex-shrink-0 space-y-md hidden lg:block">
            <ComplianceTiersPanel />
            <WhyVendorPassPanel />
            <VendorCTAPanel
              submitted={submitted}
              email={email}
              setEmail={setEmail}
              emailError={emailError}
              setEmailError={setEmailError}
              submitError={submitError}
              submitting={submitting}
              onSubmit={handleWaitlist}
            />
          </aside>
        </div>
      </div>

      {/* ── Vendor detail modal ── */}
      {selectedVendor && !inviteVendor && (
        <VendorDetailModal
          vendor={selectedVendor}
          onClose={() => setSelectedVendor(null)}
          onInvite={() => {
            setInviteVendor(selectedVendor);
            setSelectedVendor(null);
          }}
        />
      )}

      {/* ── Project picker (invite flow from homepage) ── */}
      {inviteVendor && (
        <ProjectPickerModal
          vendorUid={inviteVendor.uid}
          vendorEmail=""
          onClose={() => setInviteVendor(null)}
        />
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-outline-variant bg-surface-container-lowest">
        <div className="page-container py-md flex flex-wrap items-center justify-between gap-sm">
          <div>
            <p className="text-body-sm font-semibold text-on-surface">VendorPass</p>
            <p className="text-body-sm text-on-surface-variant">
              © {new Date().getFullYear()} VendorPass. All rights reserved.
            </p>
          </div>
          <div className="flex gap-md">
            <Link to="/terms" className="text-body-sm text-on-surface-variant hover:text-on-surface">
              Terms of Service
            </Link>
            <Link to="/terms" className="text-body-sm text-on-surface-variant hover:text-on-surface">
              Liability Disclosure
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
