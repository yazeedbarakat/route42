import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Bus, Navigation, Clock, Wifi, MapPin, X, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

// ─── Terminal Definitions ────────────────────────────────────────────────────
interface Terminal {
  id: number;
  name: string;
  nameAr: string;
  lat: number;
  lng: number;
}

const TERMINALS: Terminal[] = [
  { id: 1, name: "Northern Bus Terminal",  nameAr: "مجمع الشمالي",       lat: 32.568219717501016, lng: 35.85560315169505  },
  { id: 2, name: "Al-Ghour New Terminal",  nameAr: "مجمع الغور الجديد",  lat: 32.55064060061745,  lng: 35.8361863228588   },
  { id: 3, name: "Sheikh Khalil Terminal", nameAr: "مجمع الشيخ خليل",    lat: 32.55034219324052,  lng: 35.85550052285881  },
  { id: 4, name: "Amman Bus Terminal",     nameAr: "مجمع عمان",           lat: 32.535047165765235, lng: 35.869768897719915 },
];

const DESTINATION = { name: "42 Irbid", lat: 32.50422734122801, lng: 35.8711883498439 };

// OSRM expects lng,lat order
const OSRM_COORDS = [
  "35.855603,32.568219",
  "35.836186,32.550640",
  "35.855500,32.550342",
  "35.869768,32.535047",
  "35.871188,32.504227",
].join(";");

const OSRM_URL = `https://router.project-osrm.org/route/v1/driving/${OSRM_COORDS}?geometries=geojson&overview=full`;

// Fallback straight-line route used only if OSRM fails
const FALLBACK_ROUTE: [number, number][] = [
  [TERMINALS[0].lat, TERMINALS[0].lng],
  [TERMINALS[1].lat, TERMINALS[1].lng],
  [TERMINALS[2].lat, TERMINALS[2].lng],
  [TERMINALS[3].lat, TERMINALS[3].lng],
  [DESTINATION.lat,  DESTINATION.lng],
];

// ─── Geometry Utilities ───────────────────────────────────────────────────────
function interpolate(points: [number, number][], steps = 4): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [la, lo] = points[i];
    const [lb, lob] = points[i + 1];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push([la + (lb - la) * t, lo + (lob - lo) * t]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Perpendicular distance from point P to segment AB (in degree units). */
function ptSegDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Minimum distance from a lat/lng point to any segment of the route. */
function minDistToRoute(lat: number, lng: number, route: [number, number][]): number {
  let min = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const d = ptSegDist(lat, lng, route[i][0], route[i][1], route[i + 1][0], route[i + 1][1]);
    if (d < min) min = d;
  }
  return min;
}

/** Index in route array that is closest to a given lat/lng. */
function findClosestIdx(lat: number, lng: number, route: [number, number][]): number {
  let minD = Infinity, minI = 0;
  for (let i = 0; i < route.length; i++) {
    const d = Math.hypot(route[i][0] - lat, route[i][1] - lng);
    if (d < minD) { minD = d; minI = i; }
  }
  return minI;
}

// ─── Icon Factories ───────────────────────────────────────────────────────────
const RIPPLE_CSS = `<style>@keyframes ripple{0%{transform:scale(0.8);opacity:0.8}100%{transform:scale(2.4);opacity:0}}</style>`;

function cyanMarkerIcon() {
  return L.divIcon({
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -14],
    html: `
      ${RIPPLE_CSS}
      <div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:28px;height:28px;background:rgba(34,211,238,0.15);border-radius:50%;animation:ripple 2s ease-out infinite;"></div>
        <div style="width:14px;height:14px;background:#22d3ee;border:2px solid rgba(255,255,255,0.6);border-radius:50%;box-shadow:0 0 10px rgba(34,211,238,0.9),0 0 20px rgba(34,211,238,0.5);"></div>
      </div>`,
  });
}

function destIcon() {
  return L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -15],
    html: `
      ${RIPPLE_CSS}
      <div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:30px;height:30px;background:rgba(255,46,136,0.15);border-radius:50%;animation:ripple 2.5s ease-out infinite;"></div>
        <div style="width:16px;height:16px;background:linear-gradient(135deg,#ff2e88,#7c3aed);border:2px solid rgba(255,255,255,0.5);border-radius:50%;box-shadow:0 0 14px rgba(255,46,136,0.9),0 0 28px rgba(255,46,136,0.4);"></div>
      </div>`,
  });
}

function busIcon() {
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `
      <div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#ff2e88,#c0136a);border:2px solid rgba(255,255,255,0.7);border-radius:8px;box-shadow:0 0 12px rgba(255,46,136,0.9),0 0 24px rgba(255,46,136,0.4);font-size:15px;">🚌</div>`,
  });
}

function greenMarkerIcon() {
  return L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -15],
    html: `
      ${RIPPLE_CSS}
      <div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:30px;height:30px;background:rgba(52,211,153,0.2);border-radius:50%;animation:ripple 2s ease-out infinite;"></div>
        <div style="width:16px;height:16px;background:#34d399;border:2px solid rgba(255,255,255,0.7);border-radius:50%;box-shadow:0 0 12px rgba(52,211,153,0.9),0 0 24px rgba(52,211,153,0.4);"></div>
      </div>`,
  });
}

// ─── Bus Animator ─────────────────────────────────────────────────────────────
function BusAnimator({
  routePoints,
  onBusMove,
}: {
  routePoints: [number, number][];
  onBusMove: (idx: number) => void;
}) {
  const map = useMap();
  const onBusMoveRef = useRef(onBusMove);
  onBusMoveRef.current = onBusMove;

  useEffect(() => {
    if (routePoints.length === 0) return;
    const icon = busIcon();
    const marker = L.marker(routePoints[0], { icon, zIndexOffset: 1000 }).addTo(map);
    marker.bindPopup(
      `<div style="font-family:Inter,sans-serif;font-size:13px;font-weight:600;color:#fff;background:#0f1420;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,46,136,0.3);">
        🚌 Smart Shuttle<br/>
        <span style="color:#a7b0c0;font-weight:400;font-size:11px;">En route · Real road tracking</span>
      </div>`,
      { className: "dark-popup", closeButton: false }
    );

    let idx = 0;
    // Normalise speed: aim for ~75s per full loop regardless of point density
    const ms = Math.max(40, Math.round(75000 / routePoints.length));
    const interval = setInterval(() => {
      idx = (idx + 1) % routePoints.length;
      marker.setLatLng(routePoints[idx]);
      onBusMoveRef.current(idx);
    }, ms);

    return () => {
      clearInterval(interval);
      if (map.hasLayer(marker)) map.removeLayer(marker);
    };
  }, [map, routePoints]);

  return null;
}

// ─── Terminal Markers ─────────────────────────────────────────────────────────
function TerminalMarkers({
  busIndex,
  stopIndices,
  totalSteps,
}: {
  busIndex: number;
  stopIndices: number[];
  totalSteps: number;
}) {
  const map = useMap();
  const markersRef = useRef<L.Marker[]>([]);

  const computeEta = useCallback(
    (i: number) => {
      if (totalSteps === 0) return "—";
      const stopIdx = stopIndices[i] ?? 0;
      let away = stopIdx - busIndex;
      if (away < 0) away += totalSteps;
      return Math.max(1, Math.round((away / totalSteps) * 22));
    },
    [busIndex, stopIndices, totalSteps]
  );

  useEffect(() => {
    markersRef.current.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); });
    markersRef.current = [];

    TERMINALS.forEach((t, i) => {
      const eta = computeEta(i);
      const marker = L.marker([t.lat, t.lng], { icon: cyanMarkerIcon(), zIndexOffset: 500 }).addTo(map);
      marker.bindPopup(
        `<div style="font-family:Inter,sans-serif;background:#0f1420;border:1px solid rgba(34,211,238,0.3);border-radius:12px;padding:12px 16px;box-shadow:0 0 20px rgba(34,211,238,0.15);min-width:160px;">
          <div style="color:#22d3ee;font-weight:700;font-size:14px;margin-bottom:4px;">${t.name}</div>
          <div style="color:#a7b0c0;font-size:11px;margin-bottom:8px;">${t.nameAr}</div>
          <div style="display:flex;align-items:center;gap:6px;color:#fff;font-size:12px;">
            <span style="color:#ff2e88">⏱</span>
            ETA: <strong style="color:#ff2e88">${eta} min${eta !== 1 ? "s" : ""}</strong>
          </div>
        </div>`,
        { className: "dark-popup", closeButton: false }
      );
      markersRef.current.push(marker);
    });

    const destMarker = L.marker([DESTINATION.lat, DESTINATION.lng], { icon: destIcon(), zIndexOffset: 600 }).addTo(map);
    destMarker.bindPopup(
      `<div style="font-family:Inter,sans-serif;background:#0f1420;border:1px solid rgba(255,46,136,0.3);border-radius:12px;padding:12px 16px;box-shadow:0 0 20px rgba(255,46,136,0.15);">
        <div style="color:#ff2e88;font-weight:700;font-size:14px;margin-bottom:4px;">🎯 42 Irbid</div>
        <div style="color:#a7b0c0;font-size:11px;">Final Destination</div>
      </div>`,
      { className: "dark-popup", closeButton: false }
    );
    markersRef.current.push(destMarker);

    return () => { markersRef.current.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); }); };
  }, [map, busIndex, computeEta]);

  return null;
}

// ─── Custom Pickup Marker ─────────────────────────────────────────────────────
function CustomPickupLayer({ position }: { position: [number, number] | null }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (markerRef.current) { if (map.hasLayer(markerRef.current)) map.removeLayer(markerRef.current); markerRef.current = null; }
    if (!position) return;
    const m = L.marker(position, { icon: greenMarkerIcon(), zIndexOffset: 800 }).addTo(map);
    m.bindPopup(
      `<div style="font-family:Inter,sans-serif;background:#0f1420;border:1px solid rgba(52,211,153,0.35);border-radius:12px;padding:12px 16px;box-shadow:0 0 20px rgba(52,211,153,0.15);">
        <div style="color:#34d399;font-weight:700;font-size:14px;margin-bottom:4px;">✅ Custom Pickup</div>
        <div style="color:#a7b0c0;font-size:11px;">On-route pickup approved</div>
        <div style="color:#a7b0c0;font-size:10px;margin-top:6px;font-family:monospace;">
          ${position[0].toFixed(5)}, ${position[1].toFixed(5)}
        </div>
      </div>`,
      { className: "dark-popup", closeButton: false }
    );
    m.openPopup();
    markerRef.current = m;
    return () => { if (map.hasLayer(m)) map.removeLayer(m); };
  }, [map, position]);

  return null;
}

// ─── Map Click Handler ────────────────────────────────────────────────────────
const ON_ROUTE_THRESHOLD = 0.0005; // ~55 m in degree units

function MapClickHandler({
  routePoints,
  onValid,
  onInvalid,
}: {
  routePoints: [number, number][];
  onValid: (pos: [number, number]) => void;
  onInvalid: () => void;
}) {
  useMapEvents({
    click(e) {
      if (routePoints.length === 0) return;
      const { lat, lng } = e.latlng;
      const dist = minDistToRoute(lat, lng, routePoints);
      if (dist <= ON_ROUTE_THRESHOLD) {
        onValid([lat, lng]);
      } else {
        onInvalid();
      }
    },
  });
  return null;
}

// ─── Toast Component ──────────────────────────────────────────────────────────
interface ToastMsg { type: "valid" | "invalid"; text: string }

// ─── Main MapPage ─────────────────────────────────────────────────────────────
export default function MapPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Route state
  const [routePoints, setRoutePoints]   = useState<[number, number][]>([]);
  const [stopIndices, setStopIndices]   = useState<number[]>([0, 0, 0, 0, 0]);
  const [routeLoading, setRouteLoading] = useState(true);
  const [routeError, setRouteError]     = useState(false);

  // Bus state
  const [busIndex, setBusIndex]     = useState(0);
  const [updateTick, setUpdateTick] = useState(0);

  // Custom pickup state
  const [customPickup, setCustomPickup] = useState<[number, number] | null>(null);
  const [toast, setToast]               = useState<ToastMsg | null>(null);

  useEffect(() => { if (!user) setLocation("/"); }, [user, setLocation]);

  // Auto-dismiss toast after 3.5 s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Fetch OSRM real road route
  useEffect(() => {
    let cancelled = false;
    setRouteLoading(true);
    setRouteError(false);

    fetch(OSRM_URL)
      .then(r => {
        if (!r.ok) throw new Error("OSRM error");
        return r.json();
      })
      .then(data => {
        if (cancelled) return;
        // OSRM returns [lng, lat] — swap to [lat, lng] for Leaflet
        const raw: [number, number][] = data.routes[0].geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
        );
        // Light interpolation for smooth animation
        const pts = interpolate(raw, 3);
        const indices = TERMINALS.map(t => findClosestIdx(t.lat, t.lng, pts));
        setRoutePoints(pts);
        setStopIndices(indices);
        setRouteLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Fallback: interpolated straight-line route
        const pts = interpolate(FALLBACK_ROUTE, 70);
        const indices = TERMINALS.map(t => findClosestIdx(t.lat, t.lng, pts));
        setRoutePoints(pts);
        setStopIndices(indices);
        setRouteError(true);
        setRouteLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const handleBusMove = useCallback((idx: number) => {
    setBusIndex(idx);
    if (idx % 40 === 0) setUpdateTick(t => t + 1);
  }, []);

  const handleValidPickup = useCallback((pos: [number, number]) => {
    setCustomPickup(pos);
    setToast({ type: "valid", text: "✅ Custom pickup added — on-route location confirmed!" });
  }, []);

  const handleInvalidPickup = useCallback(() => {
    setToast({ type: "invalid", text: "Invalid location. You can only request pickups directly on the bus route." });
  }, []);

  if (!user) return null;

  const totalSteps = routePoints.length;

  // Live ETAs for side panel
  const liveEtas = TERMINALS.map((_, i) => {
    if (totalSteps === 0) return "—";
    const stopIdx = stopIndices[i] ?? 0;
    let away = stopIdx - busIndex;
    if (away < 0) away += totalSteps;
    return Math.max(1, Math.round((away / totalSteps) * 22));
  });

  const busProgress = totalSteps > 0 ? Math.round((busIndex / totalSteps) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Route Map</h1>
          <p className="text-[#a7b0c0] text-sm mt-0.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            {routeLoading
              ? "Loading real road route…"
              : routeError
              ? "Irbid, Jordan · Fallback route active"
              : "Irbid, Jordan · OSRM real road routing active"}
          </p>
        </div>
        <div className="sm:ml-auto flex items-center gap-2 px-3 py-1.5 bg-emerald-400/10 border border-emerald-400/20 rounded-lg">
          {routeLoading
            ? <Loader2 size={13} className="text-emerald-400 animate-spin" />
            : <Wifi size={13} className="text-emerald-400" />}
          <span className="text-xs text-emerald-400 font-medium">{routeLoading ? "Loading" : "Live"}</span>
        </div>
      </div>

      {/* Map + side panel */}
      <div className="grid lg:grid-cols-4 gap-4">
        {/* Map container */}
        <div
          className="lg:col-span-3 relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl"
          style={{ height: "520px" }}
        >
          {/* Popup / container overrides */}
          <style>{`
            .dark-popup .leaflet-popup-content-wrapper{background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important;}
            .dark-popup .leaflet-popup-content{margin:0!important;}
            .dark-popup .leaflet-popup-tip-container{display:none!important;}
            .leaflet-container{background:#0a0e17!important;cursor:crosshair!important;}
          `}</style>

          {/* Route loading skeleton overlay */}
          {routeLoading && (
            <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-[#0a0e17]/80 backdrop-blur-sm gap-3">
              <Loader2 size={32} className="text-[#ff2e88] animate-spin" />
              <p className="text-white text-sm font-medium">Fetching real road route via OSRM…</p>
              <p className="text-[#a7b0c0] text-xs">router.project-osrm.org</p>
            </div>
          )}

          {/* Toast overlay */}
          {toast && (
            <div className={`
              absolute top-4 left-1/2 -translate-x-1/2 z-[1002]
              flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
              shadow-xl backdrop-blur-md border transition-all
              ${toast.type === "valid"
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                : "bg-red-500/20 border-red-500/40 text-red-300"}
            `}>
              {toast.type === "valid"
                ? <CheckCircle size={15} />
                : <AlertTriangle size={15} />}
              <span>{toast.text}</span>
            </div>
          )}

          <MapContainer
            center={[32.535, 35.85]}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
            zoomControl={true}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='© <a href="https://carto.com">CARTO</a>'
            />

            {/* Real road polyline — only rendered once OSRM data is ready */}
            {routePoints.length > 0 && (
              <>
                <Polyline positions={routePoints} color="rgba(255,46,136,0.12)" weight={16} lineCap="round" />
                <Polyline positions={routePoints} color="#ff2e88" weight={3} opacity={0.9} dashArray="9 5" lineCap="round" />
              </>
            )}

            {/* Bus + terminal markers — keyed so they remount when route loads */}
            {routePoints.length > 0 && (
              <>
                <BusAnimator key={totalSteps} routePoints={routePoints} onBusMove={handleBusMove} />
                <TerminalMarkers busIndex={busIndex} stopIndices={stopIndices} totalSteps={totalSteps} key={updateTick} />
              </>
            )}

            {/* Custom pickup marker */}
            <CustomPickupLayer position={customPickup} />

            {/* On-route click handler */}
            <MapClickHandler
              routePoints={routePoints}
              onValid={handleValidPickup}
              onInvalid={handleInvalidPickup}
            />
          </MapContainer>
        </div>

        {/* ── Side panel ── */}
        <div className="lg:col-span-1 flex flex-col gap-3">

          {/* Bus status */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bus size={15} className="text-[#ff2e88]" />
              <span className="text-sm font-semibold text-white">Bus Status</span>
              {!routeLoading && !routeError && (
                <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">OSRM</span>
              )}
              {routeError && (
                <span className="ml-auto text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">Fallback</span>
              )}
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#a7b0c0]">Route progress</span>
              <span className="text-xs font-mono text-[#ff2e88] font-bold">{busProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#ff2e88] to-[#7c3aed] rounded-full transition-all duration-300"
                style={{ width: `${busProgress}%` }}
              />
            </div>
          </div>

          {/* Stop ETAs */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <Navigation size={14} className="text-[#22d3ee]" />
              <span className="text-sm font-semibold text-white">Stop ETAs</span>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {TERMINALS.map((t, i) => (
                <div key={t.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#22d3ee] mt-1.5 shrink-0 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">{t.name}</div>
                    <div className="text-[10px] text-[#a7b0c0] mt-0.5">{t.nameAr}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    <Clock size={10} className="text-[#ff2e88]" />
                    <span className="text-xs font-mono font-bold text-[#ff2e88]">{liveEtas[i]}m</span>
                  </div>
                </div>
              ))}
              <div className="px-4 py-3 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-[#ff2e88] mt-1.5 shrink-0 shadow-[0_0_6px_rgba(255,46,136,0.8)]" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white">42 Irbid</div>
                  <div className="text-[10px] text-[#a7b0c0] mt-0.5">Final Destination</div>
                </div>
                <span className="text-[10px] text-[#a7b0c0] bg-white/[0.05] px-2 py-0.5 rounded-full shrink-0">dest.</span>
              </div>
            </div>
          </div>

          {/* Custom pickup card */}
          <div className={`bg-white/[0.03] border rounded-xl p-4 transition-colors ${
            customPickup ? "border-emerald-500/30" : "border-white/[0.08]"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={14} className={customPickup ? "text-emerald-400" : "text-[#a7b0c0]"} />
              <span className="text-sm font-semibold text-white">Custom Pickup</span>
              {customPickup && (
                <button
                  onClick={() => setCustomPickup(null)}
                  className="ml-auto p-1 rounded-md hover:bg-white/10 text-[#a7b0c0] hover:text-white transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {customPickup ? (
              <>
                <p className="text-[10px] font-mono text-emerald-400 mb-1">
                  {customPickup[0].toFixed(5)}, {customPickup[1].toFixed(5)}
                </p>
                <p className="text-[10px] text-[#a7b0c0]">On-route · Approved</p>
              </>
            ) : (
              <p className="text-[10px] text-[#a7b0c0] leading-relaxed">
                Click anywhere <strong className="text-white">on the pink route</strong> to request a custom pickup stop.
              </p>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#a7b0c0] mb-3 uppercase tracking-wider">Legend</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <div className="w-3 h-3 rounded-full bg-[#22d3ee] shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                Pickup Terminal
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <div className="w-3 h-3 rounded-full bg-[#ff2e88] shadow-[0_0_6px_rgba(255,46,136,0.8)]" />
                42 Irbid Destination
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <div className="w-3 h-3 rounded-full bg-[#34d399] shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                Custom Pickup
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <div className="w-10 h-0.5" style={{ backgroundImage: "repeating-linear-gradient(90deg,#ff2e88 0,#ff2e88 6px,transparent 6px,transparent 10px)" }} />
                Real Road Route
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <span className="text-base leading-none">🚌</span>
                Live Bus (OSRM)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
