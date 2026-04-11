export function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: "#0a0e17" }}
    >
      <div className="flex flex-col items-center gap-6">
        <img
          src="/route42-logo-orig.png"
          alt="route42"
          className="w-48 h-auto object-contain"
          style={{ mixBlendMode: "screen" }}
        />

        <div className="relative flex items-center justify-center">
          <span
            className="block w-10 h-10 rounded-full border-2 border-transparent animate-spin"
            style={{
              borderTopColor: "#ff2e88",
              borderRightColor: "#ff2e88",
              boxShadow: "0 0 16px rgba(255, 46, 136, 0.45)",
            }}
          />
          <span
            className="absolute block w-6 h-6 rounded-full border-2 border-transparent animate-spin"
            style={{
              borderTopColor: "#22d3ee",
              borderRightColor: "#22d3ee",
              animationDirection: "reverse",
              animationDuration: "0.65s",
              boxShadow: "0 0 10px rgba(34, 211, 238, 0.4)",
            }}
          />
        </div>

        <p className="text-xs font-medium tracking-widest uppercase" style={{ color: "#4a5568" }}>
          Verifying session…
        </p>
      </div>
    </div>
  );
}
