import { AlertTriangle, X, Loader2 } from "lucide-react";

interface CancelBookingModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  departureTime?: string;
  date?: string;
}

export function CancelBookingModal({
  open,
  onClose,
  onConfirm,
  isPending,
  departureTime,
  date,
}: CancelBookingModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-[#0f1420] border border-white/[0.1] rounded-2xl shadow-2xl p-6 z-10">
        {/* Close */}
        <button
          onClick={onClose}
          disabled={isPending}
          className="absolute top-4 right-4 text-[#a7b0c0] hover:text-white transition-colors disabled:opacity-50"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 mx-auto mb-4">
          <AlertTriangle size={24} className="text-red-400" />
        </div>

        <h3 className="text-lg font-bold text-white text-center mb-1">Cancel Booking?</h3>
        <p className="text-sm text-[#a7b0c0] text-center mb-1">
          This action cannot be undone.
        </p>
        {departureTime && date && (
          <p className="text-xs text-[#a7b0c0]/70 text-center mb-5 font-mono">
            Trip: {date} · {departureTime}
          </p>
        )}
        {!departureTime && <div className="mb-5" />}

        <div className="flex gap-3 mt-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-lg border border-white/[0.1] text-[#a7b0c0] hover:text-white hover:border-white/20 transition-all text-sm font-medium disabled:opacity-50"
          >
            Keep Booking
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-all text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Cancelling...</>
            ) : (
              "Yes, Cancel"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
