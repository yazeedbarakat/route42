/**
 * RouteMap — reusable Leaflet map for Smart Shuttle Solution.
 *
 * Modes:
 *  - standalone (map page)  : full bus animation + ETA callbacks + internal custom pickup state
 *  - booking embed           : onLocationSelect prop → valid click lifts coords to parent
 *  - admin / driver embed    : customBookings prop → orange markers for student custom pickups
 */
import { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CustomBooking {
  lat: number;
  lng: number;
  studentName: string;
}

export interface RouteMapProps {
  height?: string;
  /** Called with [lat, lng] when a VALID on-route click happens */
  onLocationSelect?: (coords: [number, number]) => void;
  /** Green marker at these coords (controlled from parent for booking embed) */
  selectedCoords?: [number, number] | null;
  /** Orange markers shown for admin / driver views */
  customBookings?: CustomBooking[];
  /** Enable animated bus (default true) */
  showBus?: boolean;
  /** Fires (throttled) with bus progress info so the parent can render ETAs */
  onBusMoved?: (busIdx: number, totalSteps: number, stopIndices: number[]) => void;
  /** Called when a predefined terminal marker is clicked — lifts coords to parent */
  onTerminalClick?: (coords: [number, number]) => void;
}

// ─── Terminals & Route ────────────────────────────────────────────────────────
export const TERMINALS = [
  { id: 1, name: "Northern Terminal",  nameAr: "مجمع الشمالي",       lat: 32.568219717501016, lng: 35.85560315169505  },
  { id: 2, name: "Al-Ghour Terminal",  nameAr: "مجمع الغور الجديد",  lat: 32.55064060061745,  lng: 35.8361863228588   },
  { id: 3, name: "Sheikh Khalil",      nameAr: "مجمع الشيخ خليل",    lat: 32.55034219324052,  lng: 35.85550052285881  },
  { id: 4, name: "Amman Terminal",     nameAr: "مجمع عمان",           lat: 32.535047165765235, lng: 35.869768897719915 },
  { id: 5, name: "دوار الدرة",         nameAr: "دوار الدرة",          lat: 32.55824371537429,  lng: 35.87344062736422  },
] as const;

export const DESTINATION = { name: "42 Irbid", lat: 32.50422734122801, lng: 35.8711883498439 };

// All waypoints for the OSRM Trip API (lng,lat order), source=first, destination=last
const ALL_WAYPOINTS = [
  ...TERMINALS.map(t => `${t.lng},${t.lat}`),
  `${DESTINATION.lng},${DESTINATION.lat}`,
].join(";");

const OSRM_TRIP_URL =
  `https://router.project-osrm.org/trip/v1/driving/${ALL_WAYPOINTS}` +
  `?roundtrip=false&source=first&destination=last&geometries=geojson&overview=full`;

const FALLBACK: [number, number][] = TERMINALS.map(t => [t.lat, t.lng] as [number, number])
  .concat([[DESTINATION.lat, DESTINATION.lng]]);

// ─── Geometry ─────────────────────────────────────────────────────────────────
function interp(pts: [number, number][], steps = 3): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [la, lo] = pts[i], [lb, lob] = pts[i + 1];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push([la + (lb - la) * t, lo + (lob - lo) * t]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function ptSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function minDistToRoute(lat: number, lng: number, route: [number, number][]): number {
  let min = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const d = ptSegDist(lat, lng, route[i][0], route[i][1], route[i + 1][0], route[i + 1][1]);
    if (d < min) min = d;
  }
  return min;
}

function closestIdx(lat: number, lng: number, route: [number, number][]): number {
  let minD = Infinity, minI = 0;
  for (let i = 0; i < route.length; i++) {
    const d = Math.hypot(route[i][0] - lat, route[i][1] - lng);
    if (d < minD) { minD = d; minI = i; }
  }
  return minI;
}

// ─── Icon Factories ───────────────────────────────────────────────────────────
const RIPPLE = `<style>@keyframes rm-ripple{0%{transform:scale(0.8);opacity:0.8}100%{transform:scale(2.4);opacity:0}}</style>`;

export function cyanMarkerIcon() {
  return L.divIcon({
    className: "", iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -14],
    html: `${RIPPLE}<div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:28px;height:28px;background:rgba(34,211,238,.15);border-radius:50%;animation:rm-ripple 2s ease-out infinite;"></div>
      <div style="width:14px;height:14px;background:#22d3ee;border:2px solid rgba(255,255,255,.6);border-radius:50%;box-shadow:0 0 10px rgba(34,211,238,.9),0 0 20px rgba(34,211,238,.5);"></div>
    </div>`,
  });
}

export function destIcon() {
  return L.divIcon({
    className: "", iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -15],
    html: `${RIPPLE}<div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:30px;height:30px;background:rgba(255,46,136,.15);border-radius:50%;animation:rm-ripple 2.5s ease-out infinite;"></div>
      <div style="width:16px;height:16px;background:linear-gradient(135deg,#ff2e88,#7c3aed);border:2px solid rgba(255,255,255,.5);border-radius:50%;box-shadow:0 0 14px rgba(255,46,136,.9),0 0 28px rgba(255,46,136,.4);"></div>
    </div>`,
  });
}

export function busIcon() {
  return L.divIcon({
    className: "", iconSize: [30, 30], iconAnchor: [15, 15],
    html: `<div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#ff2e88,#c0136a);border:2px solid rgba(255,255,255,.7);border-radius:8px;box-shadow:0 0 12px rgba(255,46,136,.9),0 0 24px rgba(255,46,136,.4);font-size:15px;">🚌</div>`,
  });
}

function greenMarkerIcon() {
  return L.divIcon({
    className: "", iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -15],
    html: `${RIPPLE}<div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:30px;height:30px;background:rgba(52,211,153,.2);border-radius:50%;animation:rm-ripple 2s ease-out infinite;"></div>
      <div style="width:16px;height:16px;background:#34d399;border:2px solid rgba(255,255,255,.7);border-radius:50%;box-shadow:0 0 12px rgba(52,211,153,.9),0 0 24px rgba(52,211,153,.4);"></div>
    </div>`,
  });
}

function orangeMarkerIcon() {
  return L.divIcon({
    className: "", iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -12],
    html: `${RIPPLE}<div style="position:relative;width:16px;height:16px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:22px;height:22px;background:rgba(251,146,60,.2);border-radius:50%;animation:rm-ripple 2.2s ease-out infinite;"></div>
      <div style="width:10px;height:10px;background:#fb923c;border:1.5px solid rgba(255,255,255,.7);border-radius:50%;box-shadow:0 0 8px rgba(251,146,60,.9),0 0 16px rgba(251,146,60,.4);"></div>
    </div>`,
  });
}

// ─── Styles (dark popup + permanent label tooltips) ────────────────────────────
const POPUP_CSS = `
.rm-popup .leaflet-popup-content-wrapper{background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important;}
.rm-popup .leaflet-popup-content{margin:0!important;}
.rm-popup .leaflet-popup-tip-container{display:none!important;}
.leaflet-container{background:#0a0e17!important;}
.rm-label{
  background:#0d1420 !important;
  border:1px solid rgba(34,211,238,.35) !important;
  border-radius:6px !important;
  color:#22d3ee !important;
  font-family:Inter,sans-serif !important;
  font-size:11px !important;
  font-weight:600 !important;
  padding:3px 7px !important;
  white-space:nowrap !important;
  box-shadow:0 0 10px rgba(34,211,238,.2) !important;
  pointer-events:none !important;
}
.rm-label::before{display:none !important;}
.rm-label-dest{
  background:#0d1420 !important;
  border:1px solid rgba(255,46,136,.35) !important;
  border-radius:6px !important;
  color:#ff2e88 !important;
  font-family:Inter,sans-serif !important;
  font-size:11px !important;
  font-weight:700 !important;
  padding:3px 7px !important;
  white-space:nowrap !important;
  box-shadow:0 0 10px rgba(255,46,136,.2) !important;
  pointer-events:none !important;
}
.rm-label-dest::before{display:none !important;}
`;

// ─── Child Components ─────────────────────────────────────────────────────────

function BusAnimator({
  routePoints,
  onMove,
}: {
  routePoints: [number, number][];
  onMove: (idx: number) => void;
}) {
  const map = useMap();
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!routePoints.length) return;
    const marker = L.marker(routePoints[0], { icon: busIcon(), zIndexOffset: 1000 }).addTo(map);
    marker.bindPopup(
      `<div style="font-family:Inter,sans-serif;font-size:13px;font-weight:600;color:#fff;background:#0f1420;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,46,136,.3);">
        🚌 Smart Shuttle<br/><span style="color:#a7b0c0;font-weight:400;font-size:11px;">En route · OSRM roads</span>
      </div>`,
      { className: "rm-popup", closeButton: false }
    );
    let idx = 0;
    const ms = Math.max(40, Math.round(75000 / routePoints.length));
    const iv = setInterval(() => {
      idx = (idx + 1) % routePoints.length;
      marker.setLatLng(routePoints[idx]);
      onMoveRef.current(idx);
    }, ms);
    return () => { clearInterval(iv); if (map.hasLayer(marker)) map.removeLayer(marker); };
  }, [map, routePoints]);

  return null;
}

function TerminalMarkers({
  busIdx,
  stopIndices,
  totalSteps,
  onTerminalClick,
}: {
  busIdx: number;
  stopIndices: number[];
  totalSteps: number;
  onTerminalClick?: (coords: [number, number]) => void;
}) {
  const map = useMap();
  const refs = useRef<L.Marker[]>([]);
  const onClickRef = useRef(onTerminalClick);
  onClickRef.current = onTerminalClick;

  const eta = useCallback((i: number) => {
    if (!totalSteps) return "—";
    let away = (stopIndices[i] ?? 0) - busIdx;
    if (away < 0) away += totalSteps;
    return Math.max(1, Math.round((away / totalSteps) * 22));
  }, [busIdx, stopIndices, totalSteps]);

  useEffect(() => {
    refs.current.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); });
    refs.current = [];

    TERMINALS.forEach((t, i) => {
      const m = L.marker([t.lat, t.lng], { icon: cyanMarkerIcon(), zIndexOffset: 500 }).addTo(map);

      // Permanent visible label
      m.bindTooltip(t.nameAr, {
        permanent: true,
        direction: "top",
        className: "rm-label",
        offset: [0, -12],
      });

      m.bindPopup(
        `<div style="font-family:Inter,sans-serif;background:#0f1420;border:1px solid rgba(34,211,238,.3);border-radius:12px;padding:12px 16px;box-shadow:0 0 20px rgba(34,211,238,.15);min-width:160px;">
          <div style="color:#22d3ee;font-weight:700;font-size:14px;margin-bottom:4px;">${t.name}</div>
          <div style="color:#a7b0c0;font-size:11px;margin-bottom:8px;">${t.nameAr}</div>
          <div style="color:#fff;font-size:12px;">⏱ ETA: <strong style="color:#ff2e88">${eta(i)} min</strong></div>
          ${onClickRef.current ? '<div style="color:#22d3ee;font-size:11px;margin-top:8px;">📍 Click to select as pickup</div>' : ''}
        </div>`,
        { className: "rm-popup", closeButton: false }
      );

      m.on("click", () => {
        if (onClickRef.current) {
          onClickRef.current([t.lat, t.lng]);
        }
      });
      refs.current.push(m);
    });

    const dm = L.marker([DESTINATION.lat, DESTINATION.lng], { icon: destIcon(), zIndexOffset: 600 }).addTo(map);

    // Permanent label for destination
    dm.bindTooltip("42 Irbid 🎯", {
      permanent: true,
      direction: "top",
      className: "rm-label-dest",
      offset: [0, -13],
    });

    dm.bindPopup(
      `<div style="font-family:Inter,sans-serif;background:#0f1420;border:1px solid rgba(255,46,136,.3);border-radius:12px;padding:12px 16px;">
        <div style="color:#ff2e88;font-weight:700;font-size:14px;">🎯 42 Irbid</div>
        <div style="color:#a7b0c0;font-size:11px;margin-top:4px;">Final Destination</div>
      </div>`,
      { className: "rm-popup", closeButton: false }
    );
    refs.current.push(dm);

    return () => { refs.current.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); }); };
  }, [map, busIdx, eta]);

  return null;
}

function PickupMarker({ position }: { position: [number, number] | null }) {
  const map = useMap();
  const ref = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (ref.current) { if (map.hasLayer(ref.current)) map.removeLayer(ref.current); ref.current = null; }
    if (!position) return;
    const m = L.marker(position, { icon: greenMarkerIcon(), zIndexOffset: 800 }).addTo(map);
    m.bindPopup(
      `<div style="font-family:Inter,sans-serif;background:#0f1420;border:1px solid rgba(52,211,153,.35);border-radius:12px;padding:12px 16px;">
        <div style="color:#34d399;font-weight:700;font-size:14px;margin-bottom:4px;">✅ Custom Pickup</div>
        <div style="color:#a7b0c0;font-size:11px;">On-route · Approved</div>
        <div style="color:#a7b0c0;font-size:10px;margin-top:6px;font-family:monospace;">${position[0].toFixed(5)}, ${position[1].toFixed(5)}</div>
      </div>`,
      { className: "rm-popup", closeButton: false }
    );
    m.openPopup();
    ref.current = m;
    return () => { if (map.hasLayer(m)) map.removeLayer(m); };
  }, [map, position]);

  return null;
}

function CustomBookingsLayer({ bookings }: { bookings: CustomBooking[] }) {
  const map = useMap();
  const refs = useRef<L.Marker[]>([]);

  useEffect(() => {
    refs.current.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); });
    refs.current = [];

    bookings.forEach(b => {
      const m = L.marker([b.lat, b.lng], { icon: orangeMarkerIcon(), zIndexOffset: 700 }).addTo(map);
      m.bindPopup(
        `<div style="font-family:Inter,sans-serif;background:#0f1420;border:1px solid rgba(251,146,60,.35);border-radius:12px;padding:12px 16px;box-shadow:0 0 20px rgba(251,146,60,.15);">
          <div style="color:#fb923c;font-weight:700;font-size:14px;margin-bottom:4px;">🟠 Custom Pickup</div>
          <div style="color:#fff;font-size:12px;">Passenger: <strong>${b.studentName}</strong></div>
          <div style="color:#a7b0c0;font-size:10px;margin-top:6px;font-family:monospace;">${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}</div>
        </div>`,
        { className: "rm-popup", closeButton: false }
      );
      refs.current.push(m);
    });

    return () => { refs.current.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); }); };
  }, [map, bookings]);

  return null;
}

const ON_ROUTE_THRESHOLD = 0.0005; // ~55 m

function ClickHandler({
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
      if (!routePoints.length) return;
      const dist = minDistToRoute(e.latlng.lat, e.latlng.lng, routePoints);
      if (dist <= ON_ROUTE_THRESHOLD) onValid([e.latlng.lat, e.latlng.lng]);
      else onInvalid();
    },
  });
  return null;
}

// ─── Toast type ───────────────────────────────────────────────────────────────
interface Toast { type: "valid" | "invalid"; text: string }

// ─── RouteMap ─────────────────────────────────────────────────────────────────
export function RouteMap({
  height = "100%",
  onLocationSelect,
  selectedCoords,
  customBookings,
  showBus = true,
  onBusMoved,
  onTerminalClick,
}: RouteMapProps) {
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [stopIndices, setStopIndices] = useState<number[]>(TERMINALS.map(() => 0));
  const [loading, setLoading]         = useState(true);
  const [busIdx, setBusIdx]            = useState(0);
  const [etaTick, setEtaTick]          = useState(0);

  const [internalPickup, setInternalPickup] = useState<[number, number] | null>(null);
  const effectivePickup = selectedCoords !== undefined ? selectedCoords : internalPickup;

  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // OSRM Trip API fetch — finds the optimal shortest path through all waypoints
  useEffect(() => {
    let cancelled = false;
    fetch(OSRM_TRIP_URL)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        if (cancelled) return;
        // Trip API returns data.trips[0]
        const tripData = data.trips?.[0] ?? data.routes?.[0];
        if (!tripData) throw new Error("No trip data");
        const raw: [number, number][] = tripData.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
        );
        const pts = interp(raw, 3);
        setRoutePoints(pts);
        setStopIndices(TERMINALS.map(t => closestIdx(t.lat, t.lng, pts)));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        const pts = interp(FALLBACK, 70);
        setRoutePoints(pts);
        setStopIndices(TERMINALS.map(t => closestIdx(t.lat, t.lng, pts)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleBusMove = useCallback((idx: number) => {
    setBusIdx(idx);
    if (idx % 40 === 0) {
      setEtaTick(t => t + 1);
      if (onBusMoved) onBusMoved(idx, routePoints.length, stopIndices);
    }
  }, [routePoints.length, stopIndices, onBusMoved]);

  const handleValidClick = useCallback((coords: [number, number]) => {
    if (onLocationSelect) {
      onLocationSelect(coords);
    } else {
      setInternalPickup(coords);
    }
    setToast({ type: "valid", text: "✅ Custom pickup added — on-route location confirmed!" });
  }, [onLocationSelect]);

  const handleInvalidClick = useCallback(() => {
    setToast({ type: "invalid", text: "Invalid location. You can only request pickups directly on the bus route." });
  }, []);

  return (
    <div className="relative w-full" style={{ height }}>
      <style>{POPUP_CSS}</style>

      {loading && (
        <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-[#0a0e17]/85 backdrop-blur-sm gap-3">
          <Loader2 size={28} className="text-[#ff2e88] animate-spin" />
          <p className="text-white text-sm font-medium">Optimising route via OSRM Trip API…</p>
          <p className="text-[#a7b0c0] text-xs">router.project-osrm.org</p>
        </div>
      )}

      {toast && (
        <div className={`
          absolute top-3 left-1/2 -translate-x-1/2 z-[1002]
          flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
          shadow-xl backdrop-blur-md border whitespace-nowrap
          ${toast.type === "valid"
            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
            : "bg-red-500/20 border-red-500/40 text-red-300"}
        `}>
          {toast.type === "valid" ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {toast.text}
        </div>
      )}

      <MapContainer
        center={[32.535, 35.86]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

        {routePoints.length > 0 && (
          <>
            <Polyline positions={routePoints} color="rgba(255,46,136,0.12)" weight={16} lineCap="round" />
            <Polyline positions={routePoints} color="#ff2e88" weight={3} opacity={0.9} dashArray="9 5" lineCap="round" />
          </>
        )}

        {routePoints.length > 0 && (
          <>
            {showBus && (
              <BusAnimator key={routePoints.length} routePoints={routePoints} onMove={handleBusMove} />
            )}
            <TerminalMarkers
              busIdx={busIdx}
              stopIndices={stopIndices}
              totalSteps={routePoints.length}
              key={etaTick}
              onTerminalClick={onTerminalClick}
            />
          </>
        )}

        <PickupMarker position={effectivePickup ?? null} />

        {customBookings && customBookings.length > 0 && (
          <CustomBookingsLayer bookings={customBookings} />
        )}

        {routePoints.length > 0 && (
          <ClickHandler routePoints={routePoints} onValid={handleValidClick} onInvalid={handleInvalidClick} />
        )}
      </MapContainer>
    </div>
  );
}
