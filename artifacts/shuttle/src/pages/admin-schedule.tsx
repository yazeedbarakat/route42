import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTimeSlots,
  useAddTimeSlot,
  useDeleteTimeSlot,
} from "@workspace/api-client-react";
import {
  CalendarClock, ArrowRight, ArrowLeft, Trash2, Plus,
  AlertCircle, Loader2, ChevronRight
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDateLabel(offset: 0 | 1 | 2): { label: string; iso: string; display: string } {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const iso = d.toISOString().split("T")[0];
  const display = d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  const labels = ["Today", "Tomorrow", "Day After"] as const;
  return { label: labels[offset], iso, display };
}

const DATE_OPTIONS = [getDateLabel(0), getDateLabel(1), getDateLabel(2)];

const STEP = 30; // minutes
const TOTAL_STEPS = (24 * 60) / STEP; // 0..47

function sliderToTime(value: number): string {
  const total = value * STEP;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m.toString().padStart(2, "0");
  return `${displayH}:${displayM} ${period}`;
}

function sliderPct(value: number): number {
  return (value / (TOTAL_STEPS - 1)) * 100;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminSchedule() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // guard
  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  const qc = useQueryClient();

  // form state
  const [selectedDateIdx, setSelectedDateIdx] = useState<0 | 1 | 2>(0);
  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound");
  const [sliderValue, setSliderValue] = useState(16); // default 08:00 AM
  const [addError, setAddError] = useState("");

  const selectedDate = DATE_OPTIONS[selectedDateIdx];
  const selectedTime = sliderToTime(sliderValue);

  // fetch ALL slots so we can group by date / direction in the display
  const { data: allSlots = [], isLoading: slotsLoading } = useGetTimeSlots(undefined, {
    query: { refetchInterval: 15_000 },
  });

  const { mutate: addSlot, isPending: adding } = useAddTimeSlot({
    mutation: {
      onSuccess: () => {
        setAddError("");
        qc.invalidateQueries({ queryKey: ["timeslots"] });
      },
      onError: (err: unknown) => {
        const msg = (err as { message?: string })?.message ?? "Failed to add time slot.";
        setAddError(msg);
      },
    },
  });

  const { mutate: deleteSlot, isPending: deleting } = useDeleteTimeSlot({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["timeslots"] }),
    },
  });

  const handleAdd = () => {
    setAddError("");
    addSlot({ timeString: selectedTime, direction, date: selectedDate.iso });
  };

  // group slots: date → direction → TimeSlot[]
  const grouped = useMemo(() => {
    const map: Record<string, Record<string, typeof allSlots>> = {};
    for (const slot of allSlots) {
      if (!map[slot.date]) map[slot.date] = {};
      if (!map[slot.date][slot.direction]) map[slot.date][slot.direction] = [];
      map[slot.date][slot.direction].push(slot);
    }
    // sort each group
    for (const d of Object.values(map)) {
      for (const arr of Object.values(d)) {
        arr.sort((a, b) => {
          const toMin = (s: string) => {
            const [time, per] = s.split(" ");
            let [h, m] = time.split(":").map(Number);
            if (per === "PM" && h !== 12) h += 12;
            if (per === "AM" && h === 12) h = 0;
            return h * 60 + m;
          };
          return toMin(a.timeString) - toMin(b.timeString);
        });
      }
    }
    return map;
  }, [allSlots]);

  const sortedDates = useMemo(() => {
    return Object.keys(grouped).sort();
  }, [grouped]);

  const pct = sliderPct(sliderValue);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CalendarClock size={24} className="text-[#ff2e88]" />
            Schedule Manager
          </h1>
          <p className="text-sm text-[#a7b0c0] mt-1">
            Define trip time slots by date and direction — students see only what you publish here.
          </p>
        </div>
      </div>

      {/* ── Add Slot Card ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0f1420] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-2">
          <Plus size={15} className="text-[#ff2e88]" />
          <span className="text-sm font-semibold text-white">Add Time Slot</span>
        </div>

        <div className="p-5 space-y-6">
          {/* Date selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#a7b0c0] uppercase tracking-wider">Date</label>
            <div className="flex gap-2 flex-wrap">
              {DATE_OPTIONS.map((opt, idx) => (
                <button
                  key={opt.iso}
                  onClick={() => setSelectedDateIdx(idx as 0 | 1 | 2)}
                  className={`
                    px-4 py-2 rounded-xl text-sm font-medium border transition-all
                    ${selectedDateIdx === idx
                      ? "bg-[#ff2e88]/15 border-[#ff2e88]/40 text-[#ff2e88]"
                      : "bg-white/[0.04] border-white/[0.08] text-[#a7b0c0] hover:bg-white/[0.07] hover:text-white"}
                  `}
                >
                  <span className="font-semibold">{opt.label}</span>
                  <span className="ml-1.5 opacity-60 text-xs">{opt.display}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Direction selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#a7b0c0] uppercase tracking-wider">Direction</label>
            <div className="flex gap-2">
              <button
                onClick={() => setDirection("inbound")}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all
                  ${direction === "inbound"
                    ? "bg-[#22d3ee]/10 border-[#22d3ee]/40 text-[#22d3ee]"
                    : "bg-white/[0.04] border-white/[0.08] text-[#a7b0c0] hover:bg-white/[0.07] hover:text-white"}
                `}
              >
                <ArrowRight size={15} />
                Go to 42 Irbid
              </button>
              <button
                onClick={() => setDirection("outbound")}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all
                  ${direction === "outbound"
                    ? "bg-[#a78bfa]/10 border-[#a78bfa]/40 text-[#a78bfa]"
                    : "bg-white/[0.04] border-white/[0.08] text-[#a7b0c0] hover:bg-white/[0.07] hover:text-white"}
                `}
              >
                <ArrowLeft size={15} />
                Return from 42 Irbid
              </button>
            </div>
          </div>

          {/* Time slider */}
          <div className="space-y-4">
            <label className="text-xs font-semibold text-[#a7b0c0] uppercase tracking-wider">Time</label>

            {/* Glowing time display */}
            <div className="text-center py-2 select-none">
              <span
                className="text-6xl font-black tracking-tight"
                style={{
                  color: "#ff2e88",
                  textShadow: "0 0 24px rgba(255,46,136,0.7), 0 0 48px rgba(255,46,136,0.4)",
                }}
              >
                {selectedTime}
              </span>
              <div className="text-xs text-[#a7b0c0] mt-1">
                {direction === "inbound" ? "→ Go to 42 Irbid" : "← Return from 42 Irbid"}
                {" · "}{selectedDate.label} ({selectedDate.display})
              </div>
            </div>

            {/* Styled slider */}
            <div className="relative px-1">
              <style>{`
                .schedule-slider {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 100%;
                  height: 6px;
                  border-radius: 3px;
                  outline: none;
                  cursor: pointer;
                }
                .schedule-slider::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 26px;
                  height: 26px;
                  border-radius: 50%;
                  background: #ff2e88;
                  border: 3px solid #1a2035;
                  box-shadow: 0 0 0 2px #ff2e88, 0 0 20px rgba(255,46,136,0.55);
                  cursor: grab;
                  margin-top: -10px;
                }
                .schedule-slider::-webkit-slider-thumb:active { cursor: grabbing; }
                .schedule-slider::-moz-range-thumb {
                  width: 26px;
                  height: 26px;
                  border-radius: 50%;
                  background: #ff2e88;
                  border: 3px solid #1a2035;
                  box-shadow: 0 0 0 2px #ff2e88, 0 0 20px rgba(255,46,136,0.55);
                  cursor: grab;
                }
                .schedule-slider::-webkit-slider-runnable-track { border-radius: 3px; }
                .schedule-slider::-moz-range-track { height: 6px; border-radius: 3px; }
              `}</style>
              <input
                type="range"
                min={0}
                max={TOTAL_STEPS - 1}
                step={1}
                value={sliderValue}
                onChange={(e) => setSliderValue(Number(e.target.value))}
                className="schedule-slider"
                style={{
                  background: `linear-gradient(to right, #ff2e88 0%, #ff2e88 ${pct}%, rgba(255,255,255,0.08) ${pct}%, rgba(255,255,255,0.08) 100%)`,
                }}
              />
              {/* hour labels */}
              <div className="flex justify-between mt-2 px-0.5">
                {["12 AM", "6 AM", "12 PM", "6 PM", "11:30 PM"].map((l) => (
                  <span key={l} className="text-[10px] text-[#a7b0c0]/60">{l}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Error + Button */}
          {addError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={15} className="shrink-0" />
              {addError}
            </div>
          )}

          <button
            onClick={handleAdd}
            disabled={adding}
            className="
              w-full flex items-center justify-center gap-2 py-3 rounded-xl
              text-sm font-semibold text-white
              bg-gradient-to-r from-[#ff2e88] to-[#7c3aed]
              hover:from-[#ff2e88]/90 hover:to-[#7c3aed]/90
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all shadow-lg
            "
            style={{ boxShadow: "0 0 24px rgba(255,46,136,0.3)" }}
          >
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {adding ? "Adding Slot…" : `Add ${selectedTime} · ${direction === "inbound" ? "Inbound" : "Outbound"} · ${selectedDate.label}`}
          </button>
        </div>
      </div>

      {/* ── Current Schedule ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-[#a7b0c0]" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Current Schedule</h2>
        </div>

        {slotsLoading ? (
          <div className="flex items-center gap-2 text-[#a7b0c0] text-sm py-4">
            <Loader2 size={16} className="animate-spin" />
            Loading schedule…
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#0f1420] px-6 py-10 text-center">
            <CalendarClock size={28} className="text-[#a7b0c0]/40 mx-auto mb-2" />
            <p className="text-[#a7b0c0] text-sm">No time slots scheduled yet. Add one above.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {sortedDates.map((iso) => {
              const dateLabel = DATE_OPTIONS.find(d => d.iso === iso);
              const displayDate = dateLabel
                ? `${dateLabel.label} · ${dateLabel.display}`
                : new Date(iso).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });

              return (
                <div key={iso} className="rounded-2xl border border-white/[0.07] bg-[#0f1420] overflow-hidden">
                  {/* Date header */}
                  <div className="px-5 py-3 border-b border-white/[0.07] flex items-center gap-2 bg-white/[0.02]">
                    <ChevronRight size={14} className="text-[#ff2e88]" />
                    <span className="text-sm font-semibold text-white">{displayDate}</span>
                    <span className="ml-auto text-xs text-[#a7b0c0]">{iso}</span>
                  </div>

                  <div className="p-4 space-y-4">
                    {(["inbound", "outbound"] as const).map((dir) => {
                      const slots = grouped[iso]?.[dir] ?? [];
                      if (slots.length === 0) return null;

                      const isInbound = dir === "inbound";
                      const accent    = isInbound ? "#22d3ee" : "#a78bfa";
                      const bg        = isInbound ? "bg-[#22d3ee]/5 border-[#22d3ee]/15" : "bg-[#a78bfa]/5 border-[#a78bfa]/15";
                      const chipColor = isInbound ? "bg-[#22d3ee]/10 border-[#22d3ee]/25 text-[#22d3ee]" : "bg-[#a78bfa]/10 border-[#a78bfa]/25 text-[#a78bfa]";

                      return (
                        <div key={dir} className={`rounded-xl border p-4 ${bg}`}>
                          {/* Direction header */}
                          <div className="flex items-center gap-2 mb-3">
                            {isInbound
                              ? <ArrowRight size={14} style={{ color: accent }} />
                              : <ArrowLeft  size={14} style={{ color: accent }} />}
                            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
                              {isInbound ? "Inbound — Go to 42 Irbid" : "Outbound — Return from 42 Irbid"}
                            </span>
                            <span className="ml-auto text-xs text-[#a7b0c0]">{slots.length} slot{slots.length !== 1 ? "s" : ""}</span>
                          </div>

                          {/* Slot chips */}
                          <div className="flex flex-wrap gap-2">
                            {slots.map((slot) => (
                              <div
                                key={slot.id}
                                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-mono font-medium ${chipColor} transition-all`}
                              >
                                <span>{slot.timeString}</span>
                                <button
                                  onClick={() => deleteSlot(slot.id)}
                                  disabled={deleting}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/20 text-[#a7b0c0] hover:text-red-400 disabled:cursor-not-allowed"
                                  title="Delete slot"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
