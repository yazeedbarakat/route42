import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { RouteMap, TERMINALS, DESTINATION } from "@/components/route-map";
import { Bus, Navigation, Clock, Wifi, MapPin, X } from "lucide-react";

export default function MapPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Bus progress / ETA state (driven by RouteMap callback)
  const [busData, setBusData] = useState({ idx: 0, total: 0, stopIndices: [0, 0, 0, 0] });

  // Internal custom pickup (standalone mode — not in booking flow)
  const [customPickup, setCustomPickup] = useState<[number, number] | null>(null);

  useEffect(() => { if (!user) setLocation("/"); }, [user, setLocation]);

  const handleBusMoved = useCallback((idx: number, total: number, stopIndices: number[]) => {
    setBusData({ idx, total, stopIndices });
  }, []);

  const handleLocationSelect = useCallback((coords: [number, number]) => {
    setCustomPickup(coords);
  }, []);

  if (!user) return null;

  const { idx, total, stopIndices } = busData;
  const busProgress = total > 0 ? Math.round((idx / total) * 100) : 0;

  const liveEtas = TERMINALS.map((_, i) => {
    if (total === 0) return "—";
    let away = (stopIndices[i] ?? 0) - idx;
    if (away < 0) away += total;
    return Math.max(1, Math.round((away / total) * 22));
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Route Map</h1>
          <p className="text-[#a7b0c0] text-sm mt-0.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            Irbid, Jordan · OSRM real road routing
          </p>
        </div>
        <div className="sm:ml-auto flex items-center gap-2 px-3 py-1.5 bg-emerald-400/10 border border-emerald-400/20 rounded-lg">
          <Wifi size={13} className="text-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">Live</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Map */}
        <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl">
          <RouteMap
            height="520px"
            showBus
            onBusMoved={handleBusMoved}
            onLocationSelect={handleLocationSelect}
            selectedCoords={customPickup}
          />
        </div>

        {/* Side panel */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          {/* Bus progress */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bus size={15} className="text-[#ff2e88]" />
              <span className="text-sm font-semibold text-white">Bus Status</span>
              <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">OSRM</span>
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
                  <div className="text-xs font-medium text-white">{DESTINATION.name}</div>
                  <div className="text-[10px] text-[#a7b0c0] mt-0.5">Final Destination</div>
                </div>
                <span className="text-[10px] text-[#a7b0c0] bg-white/[0.05] px-2 py-0.5 rounded-full shrink-0">dest.</span>
              </div>
            </div>
          </div>

          {/* Custom pickup card */}
          <div className={`bg-white/[0.03] border rounded-xl p-4 transition-colors ${customPickup ? "border-emerald-500/30" : "border-white/[0.08]"}`}>
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={14} className={customPickup ? "text-emerald-400" : "text-[#a7b0c0]"} />
              <span className="text-sm font-semibold text-white">Custom Pickup</span>
              {customPickup && (
                <button onClick={() => setCustomPickup(null)} className="ml-auto p-1 rounded-md hover:bg-white/10 text-[#a7b0c0] hover:text-white transition-colors">
                  <X size={12} />
                </button>
              )}
            </div>
            {customPickup ? (
              <>
                <p className="text-[10px] font-mono text-emerald-400 mb-1">{customPickup[0].toFixed(5)}, {customPickup[1].toFixed(5)}</p>
                <p className="text-[10px] text-[#a7b0c0]">On-route · Approved</p>
              </>
            ) : (
              <p className="text-[10px] text-[#a7b0c0] leading-relaxed">
                Click anywhere <strong className="text-white">on the pink route</strong> to request a custom pickup.
              </p>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#a7b0c0] mb-3 uppercase tracking-wider">Legend</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <div className="w-3 h-3 rounded-full bg-[#22d3ee] shadow-[0_0_6px_rgba(34,211,238,0.8)]" />Pickup Terminal
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <div className="w-3 h-3 rounded-full bg-[#ff2e88] shadow-[0_0_6px_rgba(255,46,136,0.8)]" />42 Irbid Destination
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <div className="w-3 h-3 rounded-full bg-[#34d399] shadow-[0_0_6px_rgba(52,211,153,0.8)]" />Custom Pickup
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <div className="w-10 h-0.5" style={{ backgroundImage: "repeating-linear-gradient(90deg,#ff2e88 0,#ff2e88 6px,transparent 6px,transparent 10px)" }} />Real Road Route
              </div>
              <div className="flex items-center gap-2 text-xs text-[#a7b0c0]">
                <span className="text-base leading-none">🚌</span>Live Bus (OSRM)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
