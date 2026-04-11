import { useEffect, useRef } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { useGetStatDetails, type StatCardKey } from "@workspace/api-client-react";

const CARD_META: Record<StatCardKey, { title: string; icon: string; color: string }> = {
  totalStudents:  { title: "Total Students",   icon: "👥", color: "#22d3ee" },
  bookingsToday:  { title: "Bookings Today",   icon: "📅", color: "#ff2e88" },
  confirmedTrips: { title: "Confirmed Trips",  icon: "✅", color: "#34d399" },
  pendingTrips:   { title: "Pending Trips",    icon: "⏳", color: "#fbbf24" },
  tripsThisWeek:  { title: "Trips This Week",  icon: "📊", color: "#a78bfa" },
  avgOccupancy:   { title: "Avg Occupancy",    icon: "💺", color: "#60a5fa" },
  peakTime:       { title: "Peak Time",        icon: "⚡", color: "#fbbf24" },
  efficiency:     { title: "Efficiency",       icon: "📈", color: "#34d399" },
};

function statusBadge(value: string): JSX.Element {
  const v = String(value).toLowerCase();
  if (v === "confirmed") return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">confirmed</span>
  );
  if (v === "pending") return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/10 text-amber-400 border border-amber-400/20">pending</span>
  );
  if (v === "canceled" || v === "cancelled") return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-400/10 text-red-400 border border-red-400/20">canceled</span>
  );
  if (v === "waiting") return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-400/10 text-blue-400 border border-blue-400/20">waiting</span>
  );
  return <span className="text-white text-xs">{value}</span>;
}

function CellValue({ value, colKey }: { value: string | number; colKey: string }) {
  const str = String(value);
  const lower = colKey.toLowerCase();

  if (lower === "status") return statusBadge(str);

  if (str.endsWith("%")) {
    const num = parseFloat(str);
    const color = num >= 75 ? "#34d399" : num >= 40 ? "#fbbf24" : "#f87171";
    return (
      <span className="font-mono font-bold text-xs" style={{ color }}>
        {str}
      </span>
    );
  }

  if (typeof value === "number" || /^\d+$/.test(str)) {
    return <span className="font-mono text-xs text-white">{value}</span>;
  }

  if (/^\d{2}:\d{2}$/.test(str)) {
    return <span className="font-mono text-xs text-[#22d3ee] font-semibold">{str}</span>;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str + "T00:00:00");
    return (
      <span className="text-xs text-[#a7b0c0]">
        {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
      </span>
    );
  }

  if (lower.includes("direction") || str === "→ Campus" || str === "← Home") {
    const color = str === "→ Campus" ? "#22d3ee" : "#fb923c";
    return <span className="text-xs font-medium" style={{ color }}>{str}</span>;
  }

  return <span className="text-xs text-[#e2e8f0]">{str}</span>;
}

interface StatDetailsModalProps {
  card: StatCardKey | null;
  onClose: () => void;
}

export function StatDetailsModal({ card, onClose }: StatDetailsModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError } = useGetStatDetails(card);
  const meta = card ? CARD_META[card] : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (card) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [card]);

  if (!card || !meta) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0d1117 0%, #0f1520 100%)",
          border: `1px solid ${meta.color}30`,
          boxShadow: `0 0 0 1px ${meta.color}15, 0 24px 80px rgba(0,0,0,0.7), 0 0 60px ${meta.color}08`,
        }}
      >
        {/* Glow accent top bar */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${meta.color}80, transparent)` }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}
            >
              {meta.icon}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: meta.color }}>
                Drill-Down Analytics
              </p>
              <h2 className="text-lg font-bold text-white leading-tight">{meta.title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#a7b0c0] hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={24} className="animate-spin" style={{ color: meta.color }} />
              <p className="text-[#a7b0c0] text-sm">Loading data…</p>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-400">
              <AlertCircle size={24} />
              <p className="text-sm">Failed to load data. Please try again.</p>
            </div>
          )}

          {data && !isLoading && (
            <>
              {data.rows.length === 0 ? (
                <div className="text-center py-16 text-[#a7b0c0] text-sm">
                  No data available for this metric.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {data.columns.map((col) => (
                          <th
                            key={col}
                            className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#a7b0c0]"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row, i) => {
                        const rowValues = Object.values(row);
                        const rowKeys = Object.keys(row);
                        return (
                          <tr
                            key={i}
                            className="hover:bg-white/[0.025] transition-colors"
                            style={{
                              borderBottom:
                                i !== data.rows.length - 1
                                  ? "1px solid rgba(255,255,255,0.04)"
                                  : undefined,
                            }}
                          >
                            {rowValues.map((val, j) => (
                              <td key={j} className="px-6 py-3.5">
                                <CellValue value={val} colKey={rowKeys[j]} />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {data && !isLoading && (
          <div
            className="px-6 py-3 shrink-0 flex items-center justify-between"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span className="text-[10px] text-[#a7b0c0] uppercase tracking-wider">
              {data.rows.length} record{data.rows.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[10px] text-[#a7b0c0]">Click outside or press Esc to close</span>
          </div>
        )}
      </div>
    </div>
  );
}
