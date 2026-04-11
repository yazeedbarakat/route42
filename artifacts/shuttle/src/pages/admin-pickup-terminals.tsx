import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Navigation, Plus, Search, Shield, Trash2 } from "lucide-react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface PickupTerminal {
  id: number;
  name: string;
  lat: number;
  lng: number;
  routeOrder: number;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

const terminalIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:999px;background:#22d3ee;border:3px solid #0a0e17;box-shadow:0 0 18px rgba(34,211,238,.8);display:flex;align-items:center;justify-content:center;color:#0a0e17;font-weight:900;font-size:14px;">T</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const selectedIcon = L.divIcon({
  className: "",
  html: `<div style="width:34px;height:34px;border-radius:999px;background:#ff2e88;border:3px solid #fff;box-shadow:0 0 22px rgba(255,46,136,.85);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:16px;">+</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function MapClickPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  // Admins can drop a terminal pin manually by clicking anywhere on the map.
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function RecenterMap({ coords }: { coords: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!coords) return;
    // Keep the selected/search result pin visible without forcing a full reload.
    map.flyTo(coords, 15, { duration: 0.6 });
  }, [coords, map]);

  return null;
}

export default function AdminPickupTerminals() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchAbortRef = useRef<AbortController | null>(null);

  const [terminalName, setTerminalName] = useState("");
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "admin") setLocation(user.role === "student" ? "/dashboard" : "/driver");
  }, [user, setLocation]);

  const { data: terminals = [], isLoading } = useQuery<PickupTerminal[]>({
    queryKey: ["pickup-terminals"],
    queryFn: () => customFetch<PickupTerminal[]>("/api/pickup-points"),
    enabled: !!user && user.role === "admin",
  });

  const saveTerminal = useMutation({
    mutationFn: (data: { name: string; lat: number; lng: number }) =>
      customFetch<PickupTerminal>("/api/admin/pickup-points", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickup-terminals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pickup-points"] });
      setTerminalName("");
      setSelectedCoords(null);
      setSearchResults([]);
      toast({ title: "Pickup terminal saved", description: "The terminal now appears on student and driver maps." });
    },
    onError: (err: any) => {
      toast({
        title: "Could not save terminal",
        description: err?.data?.error ?? err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteTerminal = useMutation({
    mutationFn: (id: number) => customFetch(`/api/admin/pickup-points/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickup-terminals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pickup-points"] });
      toast({ title: "Pickup terminal deleted", description: "The map marker has been removed." });
    },
    onError: (err: any) => {
      toast({
        title: "Could not delete terminal",
        description: err?.data?.error ?? err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const sortedTerminals = useMemo(
    () => [...terminals].sort((a, b) => a.routeOrder - b.routeOrder),
    [terminals],
  );

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setIsSearching(true);

    try {
      // Nominatim provides location search without requiring a separate API key.
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=jo&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("Search failed");
      const results = await response.json() as SearchResult[];
      setSearchResults(results);
      if (results[0]) {
        handleResultPick(results[0]);
      } else {
        toast({ title: "No locations found", description: "Try a more specific place name in Irbid.", variant: "destructive" });
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast({ title: "Search failed", description: "Map search is temporarily unavailable.", variant: "destructive" });
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultPick = (result: SearchResult) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    // Use the first part of the search result as a sensible editable terminal name.
    setSelectedCoords([lat, lng]);
    setTerminalName(result.display_name.split(",")[0] ?? result.display_name);
  };

  const handleMapPick = (lat: number, lng: number) => {
    setSelectedCoords([lat, lng]);
    if (!terminalName.trim()) setTerminalName("New Pickup Terminal");
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCoords) {
      toast({ title: "Drop a pin first", description: "Search for a place or click the map to select coordinates.", variant: "destructive" });
      return;
    }

    saveTerminal.mutate({
      name: terminalName.trim(),
      lat: selectedCoords[0],
      lng: selectedCoords[1],
    });
  };

  const handleDelete = (terminal: PickupTerminal) => {
    if (!confirm(`Delete pickup terminal "${terminal.name}"?`)) return;
    deleteTerminal.mutate(terminal.id);
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-[#ff2e88]" />
          <span className="text-xs font-semibold text-[#ff2e88] uppercase tracking-wider">Admin Panel</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Pickup Terminal Management</h1>
        <p className="text-[#a7b0c0] text-sm">Search or click the map to save official shuttle pickup terminals.</p>
      </div>

      <div className="grid xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3 bg-white/[0.03] border border-[#22d3ee]/20 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] space-y-3">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#22d3ee]/60 focus:bg-white/[0.08] transition-all"
                  placeholder="Search for a place in Jordan or Irbid..."
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#22d3ee] hover:bg-[#38bdf8] text-[#0a0e17] text-sm font-bold transition-colors disabled:opacity-50"
              >
                {isSearching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Search
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="space-y-1">
                {searchResults.map((result) => (
                  <button
                    key={`${result.lat}-${result.lon}-${result.display_name}`}
                    type="button"
                    onClick={() => handleResultPick(result)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-xs text-[#a7b0c0] transition-colors"
                  >
                    {result.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-[460px]">
            <MapContainer
              center={[32.535, 35.86]}
              zoom={13}
              style={{ height: "100%", width: "100%" }}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <MapClickPicker onPick={handleMapPick} />
              <RecenterMap coords={selectedCoords} />
              {sortedTerminals.map((terminal) => (
                <Marker
                  key={terminal.id}
                  position={[terminal.lat, terminal.lng]}
                  icon={terminalIcon}
                />
              ))}
              {selectedCoords && (
                <Marker position={selectedCoords} icon={selectedIcon} />
              )}
            </MapContainer>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-5">
          <form onSubmit={handleSave} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ff2e88]/10 border border-[#ff2e88]/20 flex items-center justify-center">
                <MapPin size={18} className="text-[#ff2e88]" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">Save Official Terminal</p>
                <p className="text-xs text-[#a7b0c0]">Pins become available to students and drivers.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#a7b0c0]">Terminal Name</label>
              <input
                required
                value={terminalName}
                onChange={(event) => setTerminalName(event.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#ff2e88]/60 focus:bg-white/[0.08] transition-all"
                placeholder="e.g. Northern Terminal"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                <p className="text-[10px] text-[#a7b0c0] uppercase tracking-wider mb-1">Latitude</p>
                <p className="text-sm font-mono text-white">{selectedCoords ? selectedCoords[0].toFixed(6) : "—"}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                <p className="text-[10px] text-[#a7b0c0] uppercase tracking-wider mb-1">Longitude</p>
                <p className="text-sm font-mono text-white">{selectedCoords ? selectedCoords[1].toFixed(6) : "—"}</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={saveTerminal.isPending}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#ff2e88] hover:bg-[#ff4595] text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saveTerminal.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Save Pickup Terminal
            </button>
          </form>

          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation size={16} className="text-[#22d3ee]" />
                <h2 className="font-semibold text-white text-sm">Official Terminals</h2>
              </div>
              <span className="text-xs text-[#a7b0c0]">{sortedTerminals.length} saved</span>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-3 p-6">
                <Loader2 size={18} className="animate-spin text-[#22d3ee]" />
                <span className="text-[#a7b0c0] text-sm">Loading terminals...</span>
              </div>
            ) : sortedTerminals.length === 0 ? (
              <div className="text-center py-10 px-5">
                <MapPin size={24} className="text-[#a7b0c0] mx-auto mb-3" />
                <p className="text-white font-medium">No pickup terminals yet</p>
                <p className="text-[#a7b0c0] text-sm mt-1">Search or click the map to add the first one.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {sortedTerminals.map((terminal) => (
                  <div key={terminal.id} className="p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#22d3ee]/10 border border-[#22d3ee]/20 flex items-center justify-center shrink-0">
                      <MapPin size={14} className="text-[#22d3ee]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{terminal.name}</p>
                      <p className="text-xs text-[#a7b0c0] font-mono mt-1">
                        {Number(terminal.lat).toFixed(5)}, {Number(terminal.lng).toFixed(5)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(terminal)}
                      disabled={deleteTerminal.isPending}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/20 transition-colors disabled:opacity-50 text-xs font-semibold"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}