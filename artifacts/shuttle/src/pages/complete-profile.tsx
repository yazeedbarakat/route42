import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Bus, User, Phone, Lock, ChevronRight, Loader2 } from "lucide-react";

export default function CompleteProfile() {
  const { setToken } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();

  const params = new URLSearchParams(search);
  const tempToken = params.get("token") ?? "";

  const [name, setName]         = useState("");
  const [phone, setPhone]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);

  if (!tempToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-[#a7b0c0] mb-4">Invalid or missing setup link.</p>
          <button
            onClick={() => setLocation("/")}
            className="text-[#22d3ee] text-sm hover:underline"
          >
            ← Return to Sign In
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirm) {
      toast({ title: "Passwords don't match", description: "Please re-enter your password.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/complete-profile", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token: tempToken, name, phone: phone || undefined, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to complete profile setup.");
      }

      setToken(data.token);
      toast({ title: "Welcome to 42 Shuttle!", description: "Your profile is set up. Enjoy your rides." });
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#ff2e88]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#22d3ee]/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#7c3aed]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff2e88] to-[#7c3aed] mb-4 shadow-xl">
            <Bus size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Complete Your Profile</h1>
          <p className="text-[#a7b0c0] text-sm">
            One last step — tell us a bit about yourself.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 shadow-xl backdrop-blur-sm">
          <p className="text-sm text-[#a7b0c0] mb-6">
            Your Google account was verified. Please provide the details below to finish setting up your shuttle account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#a7b0c0]">Full Name</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                <input
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#ff2e88]/60 focus:bg-white/[0.08] transition-all"
                  placeholder="Your full name"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#a7b0c0]">
                Phone Number <span className="text-[#a7b0c0]/50 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#ff2e88]/60 focus:bg-white/[0.08] transition-all"
                  placeholder="+962 7X XXX XXXX"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#a7b0c0]">Create Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#ff2e88]/60 focus:bg-white/[0.08] transition-all"
                  placeholder="Min. 6 characters"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#a7b0c0]">Confirm Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={`w-full bg-white/[0.05] border rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:bg-white/[0.08] transition-all ${
                    confirm && confirm !== password
                      ? "border-red-500/60 focus:border-red-500/80"
                      : "border-white/[0.08] focus:border-[#ff2e88]/60"
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {confirm && confirm !== password && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mt-2 bg-gradient-to-r from-[#ff2e88] to-[#e0176b] hover:from-[#ff4595] hover:to-[#ff2e88]"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Setting up...</>
              ) : (
                <>Finish Setup <ChevronRight size={16} /></>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="text-xs text-[#a7b0c0]/60 hover:text-[#a7b0c0] transition-colors"
            >
              ← Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
