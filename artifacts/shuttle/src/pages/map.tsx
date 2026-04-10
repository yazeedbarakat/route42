import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin, Bus, Navigation, Clock, Wifi } from "lucide-react";

// ─── Terminal Definitions ────────────────────────────────────────────────────
interface Terminal {
  id: number;
  name: string;
  nameAr: string;
  lat: number;
  lng: number;
  eta: number;
}

const TERMINALS: Terminal[] = [
  { id: 1, name: "Northern Bus Terminal", nameAr: "مجمع الشمالي",    lat: 32.5625, lng: 35.8480, eta: 2  },
  { id: 2, name: "Sheikh Khalil Terminal", nameAr: "مجمع الشيخ خليل", lat: 32.5557, lng: 35.8427, eta: 7  },
  { id: 3, name: "Amman Bus Terminal",     nameAr: "مجمع عمان",        lat: 32.5370, lng: 35.8522, eta: 14 },
  { id: 4, name: "Al-Ghour New Terminal",  nameAr: "مجمع الغور الجديد", lat: 32.5590, lng: 35.8642, eta: 19 },
];

const DESTINATION = { name: "42 Irbid", lat: 32.5555, lng: 35.8516 };

// Full route: terminals → destination in loop
const ROUTE_BASE: [number, number][] = [
  [TERMINALS[0].lat, TERMINALS[0].lng],
  [TERMINALS[1].lat, TERMINALS[1].lng],
  [TERMINALS[2].lat, TERMINALS[2].lng],
  [TERMINALS[3].lat, TERMINALS[3].lng],
  [DESTINATION.lat, DESTINATION.lng],
];

// ─── Interpolation ───────────────────────────────────────────────────────────
function interpolate(points: [number, number][], steps = 60): [number, number][] {
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

const ROUTE_POINTS = interpolate(ROUTE_BASE, 70);
const TOTAL_STEPS = ROUTE_POINTS.length;

// ─── Terminal stop indices in ROUTE_POINTS ───────────────────────────────────
const STOP_INDICES = [0, 70, 140, 210, 280]; // approx per-segment

// ─── Icon Factories ───────────────────────────────────────────────────────────
function cyanMarkerIcon() {
  return L.divIcon({
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -14],
    html: `
      <div style="
        position:relative;width:20px;height:20px;
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="
          position:absolute;width:28px;height:28px;
          background:rgba(34,211,238,0.15);
          border-radius:50%;
          animation:ripple 2s ease-out infinite;
        "></div>
        <div style="
          width:14px;height:14px;
          background:#22d3ee;
          border:2px solid rgba(255,255,255,0.6);
          border-radius:50%;
          box-shadow:0 0 10px rgba(34,211,238,0.9),0 0 20px rgba(34,211,238,0.5);
        "></div>
      </div>
      <style>
        @keyframes ripple{0%{transform:scale(0.8);opacity:0.8}100%{transform:scale(2.2);opacity:0}}
      </style>
    `,
  });
}

function destIcon() {
  return L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -15],
    html: `
      <div style="
        width:22px;height:22px;
        background:linear-gradient(135deg,#ff2e88,#7c3aed);
        border:2px solid rgba(255,255,255,0.5);
        border-radius:50%;
        box-shadow:0 0 14px rgba(255,46,136,0.9),0 0 28px rgba(255,46,136,0.4);
      "></div>
    `,
  });
}

function busIcon() {
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `
      <div style="
        width:30px;height:30px;
        display:flex;align-items:center;justify-content:center;
        background:linear-gradient(135deg,#ff2e88,#c0136a);
        border:2px solid rgba(255,255,255,0.7);
        border-radius:8px;
        box-shadow:0 0 12px rgba(255,46,136,0.9),0 0 24px rgba(255,46,136,0.4);
        font-size:15px;
      ">🚌</div>
    `,
  });
}

// ─── Bus Animator component (uses useMap inside MapContainer) ─────────────────
function BusAnimator({ onBusMove }: { onBusMove: (idx: number) => void }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const indexRef = useRef(0);
  const onBusMoveRef = useRef(onBusMove);
  onBusMoveRef.current = onBusMove;

  useEffect(() => {
    const icon = busIcon();
    const marker = L.marker(ROUTE_POINTS[0], { icon, zIndexOffset: 1000 }).addTo(map);
    marker.bindPopup(
      `<div style="font-family:Inter,sans-serif;font-size:13px;font-weight:600;color:#fff;background:#0f1420;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,46,136,0.3);box-shadow:0 0 12px rgba(255,46,136,0.2);">
        🚌 Smart Shuttle<br/>
        <span style="color:#a7b0c0;font-weight:400;font-size:11px;">En route · Live tracking</span>
      </div>`,
      { className: "dark-popup", closeButton: false }
    );
    markerRef.current = marker;

    const interval = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % TOTAL_STEPS;
      marker.setLatLng(ROUTE_POINTS[indexRef.current]);
      onBusMoveRef.current(indexRef.current);
    }, 90);

    return () => {
      clearInterval(interval);
      if (map.hasLayer(marker)) map.removeLayer(marker);
    };
  }, [map]);

  return null;
}

// ─── Terminal Markers component ───────────────────────────────────────────────
function TerminalMarkers({ busIndex }: { busIndex: number }) {
  const map = useMap();
  const markersRef = useRef<L.Marker[]>([]);

  const computeEta = useCallback((terminalIdx: number): number => {
    const stopIdx = STOP_INDICES[terminalIdx] ?? 0;
    let stepsAway = stopIdx - busIndex;
    if (stepsAway < 0) stepsAway += TOTAL_STEPS;
    return Math.max(1, Math.round((stepsAway / TOTAL_STEPS) * 20));
  }, [busIndex]);

  useEffect(() => {
    // Clear old markers
    markersRef.current.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); });
    markersRef.current = [];

    // Add terminal markers
    TERMINALS.forEach((t, i) => {
      const icon = cyanMarkerIcon();
      const eta = computeEta(i);
      const marker = L.marker([t.lat, t.lng], { icon, zIndexOffset: 500 }).addTo(map);
      marker.bindPopup(
        `<div style="
          font-family:Inter,sans-serif;
          background:#0f1420;
          border:1px solid rgba(34,211,238,0.3);
          border-radius:12px;
          padding:12px 16px;
          box-shadow:0 0 20px rgba(34,211,238,0.15);
          min-width:160px;
        ">
          <div style="color:#22d3ee;font-weight:700;font-size:14px;margin-bottom:4px;">${t.name}</div>
          <div style="color:#a7b0c0;font-size:11px;margin-bottom:8px;">${t.nameAr}</div>
          <div style="display:flex;align-items:center;gap:6px;color:#fff;font-size:12px;">
            <span style="color:#ff2e88">⏱</span>
            <span>ETA: <strong style="color:#ff2e88">${eta} min${eta > 1 ? "s" : ""}</strong></span>
          </div>
        </div>`,
        { className: "dark-popup", closeButton: false }
      );
      markersRef.current.push(marker);
    });

    // Add destination marker
    const dIcon = destIcon();
    const destMarker = L.marker([DESTINATION.lat, DESTINATION.lng], { icon: dIcon, zIndexOffset: 600 }).addTo(map);
    destMarker.bindPopup(
      `<div style="
        font-family:Inter,sans-serif;
        background:#0f1420;
        border:1px solid rgba(255,46,136,0.3);
        border-radius:12px;
        padding:12px 16px;
        box-shadow:0 0 20px rgba(255,46,136,0.15);
      ">
        <div style="color:#ff2e88;font-weight:700;font-size:14px;margin-bottom:4px;">🎯 42 Irbid</div>
        <div style="color:#a7b0c0;font-size:11px;">Final Destination</div>
      </div>`,
      { className: "dark-popup", closeButton: false }
    );
    markersRef.current.push(destMarker);

    return () => {
      markersRef.current.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); });
    };
  }, [map, busIndex, computeEta]);

  return null;
}

// ─── Main MapPage Component ───────────────────────────────────────────────────
export default function MapPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [busIndex, setBusIndex] = useState(0);
  const [updateTick, setUpdateTick] = useState(0);

  useEffect(() => {
    if (!user) setLocation("/");
  }, [user, setLocation]);

  // Throttle re-render for ETA updates — only recalculate every ~3 seconds
  const handleBusMove = useCallback((idx: number) => {
    setBusIndex(idx);
    if (idx % 33 === 0) setUpdateTick(t => t + 1);
  }, []);

  if (!user) return null;

  const routeCoords: [number, number][] = ROUTE_BASE;

  // Live ETA for info panel
  const liveEtas = TERMINALS.map((t, i) => {
    const stopIdx = STOP_INDICES[i] ?? 0;
    let stepsAway = stopIdx - busIndex;
    if (stepsAway < 0) stepsAway += TOTAL_STEPS;
    return Math.max(1, Math.round((stepsAway / TOTAL_STEPS) * 20));
  });

  const busProgress = Math.round((busIndex / TOTAL_STEPS) * 100);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Route Map</h1>
          <p className="text-[#a7b0c0] text-sm mt-0.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            Irbid, Jordan · Real-time tracking active
          </p>
        </div>
        <div className="sm:ml-auto flex items-center gap-2 px-3 py-1.5 bg-emerald-400/10 border border-emerald-400/20 rounded-lg">
          <Wifi size={13} className="text-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">Live</span>
        </div>
      </div>

      {/* Map + side panel */}
      <div className="grid lg:grid-cols-4 gap-4">
        {/* Map */}
        <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl" style={{ height: "520px" }}>
          {/* Inject popup dark styles */}
          <style>{`
            .dark-popup .leaflet-popup-content-wrapper {
              background: transparent !important;
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
            }
            .dark-popup .leaflet-popup-content {
              margin: 0 !important;
            }
            .dark-popup .leaflet-popup-tip-container { display: none !important; }
            .leaflet-container { background: #0a0e17 !important; }
          `}</style>

          <MapContainer
            center={[32.5490, 35.8510]}
            zoom={14}
            style={{ height: "100%", width: "100%" }}
            zoomControl={true}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='© <a href="https://carto.com">CARTO</a>'
            />

            {/* Pink route polyline with glow effect */}
            <Polyline
              positions={routeCoords}
              color="rgba(255,46,136,0.15)"
              weight={14}
              lineCap="round"
            />
            <Polyline
              positions={routeCoords}
              color="#ff2e88"
              weight={3}
              opacity={0.9}
              dashArray="8 5"
              lineCap="round"
            />

            {/* Bus animator */}
            <BusAnimator onBusMove={handleBusMove} />

            {/* Terminal markers with live ETAs */}
            <TerminalMarkers busIndex={busIndex} key={updateTick} />
          </MapContainer>
        </div>

        {/* Side panel */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          {/* Bus progress */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bus size={15} className="text-[#ff2e88]" />
              <span className="text-sm font-semibold text-white">Bus Status</span>
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

          {/* Terminal ETAs */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <Navigation size={14} className="text-[#22d3ee]" />
              <span className="text-sm font-semibold text-white">Stop ETAs</span>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {TERMINALS.map((terminal, i) => (
                <div key={terminal.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#22d3ee] mt-1.5 shrink-0 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">{terminal.name}</div>
                    <div className="text-[10px] text-[#a7b0c0] mt-0.5">{terminal.nameAr}</div>
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
                <div className="shrink-0">
                  <span className="text-[10px] text-[#a7b0c0] bg-white/[0.05] px-2 py-0.5 rounded-full">dest.</span>
                </div>
              </div>
            </div>
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
                Destination (42 Irbid)
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <div className="w-10 h-0.5 bg-[#ff2e88] opacity-80" style={{ backgroundImage: "repeating-linear-gradient(90deg,#ff2e88 0,#ff2e88 6px,transparent 6px,transparent 10px)" }} />
                Bus Route
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <span className="text-base leading-none">🚌</span>
                Live Bus Position
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
