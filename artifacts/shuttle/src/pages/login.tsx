import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogin, useRegister, useDriverLogin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Bus, Mail, Lock, User, ChevronRight, Loader2, Phone, Hash } from "lucide-react";

type UserRole = "student" | "admin";

// Only @learner.42.tech addresses are accepted for student registration
const STUDENT_EMAIL_DOMAIN = "@learner.42.tech";

// Three distinct UI modes on this page
type PageMode = "login" | "register" | "driver";

export default function Login() {
  const { user, setToken } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [mode, setMode] = useState<PageMode>("login");

  // Standard login / register fields
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [phone, setPhone]       = useState("");
  const [role, setRole]         = useState<UserRole>("student");
  const [emailError, setEmailError] = useState<string | null>(null);

  // Driver ID login field
  const [driverId, setDriverId] = useState("");

  const loginMutation      = useLogin();
  const registerMutation   = useRegister();
  const driverLoginMutation = useDriverLogin();

  // Redirect once authenticated
  useEffect(() => {
    if (user) {
      if (user.role === "student") setLocation("/dashboard");
      else if (user.role === "admin")  setLocation("/admin");
      else if (user.role === "driver") setLocation("/driver");
    }
  }, [user, setLocation]);

  // Reset form fields when switching modes
  const switchMode = (next: PageMode) => {
    setMode(next);
    setEmailError(null);
    setEmail(""); setPassword(""); setName(""); setPhone(""); setDriverId("");
  };

  // Validate @learner.42.tech domain for student registration
  const validateEmail = (value: string, currentRole: UserRole) => {
    if (currentRole === "student") {
      if (!value.endsWith(STUDENT_EMAIL_DOMAIN)) {
        setEmailError(`Only ${STUDENT_EMAIL_DOMAIN} email addresses are allowed.`);
        return false;
      }
    }
    setEmailError(null);
    return true;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (mode === "register") validateEmail(value, role);
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (mode === "register") validateEmail(email, newRole);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (mode === "driver") {
        // Driver ID-only authentication — no email or password required
        const res = await driverLoginMutation.mutateAsync({ data: { driverId } });
        setToken(res.token);
        toast({ title: "Welcome!", description: "Signed in as driver." });

      } else if (mode === "register") {
        if (!validateEmail(email, role)) return;
        const res = await registerMutation.mutateAsync({
          data: { email, password, name, role, phone: phone || undefined },
        });
        setToken(res.token);
        toast({ title: "Welcome!", description: "Account created successfully." });

      } else {
        // Standard email/password login
        const res = await loginMutation.mutateAsync({ data: { email, password } });
        setToken(res.token);
        toast({ title: "Welcome back!", description: "Signed in successfully." });
      }
    } catch (err: any) {
      const description =
        err?.data?.error ?? err?.message ?? "Please check your credentials.";
      toast({ title: "Authentication failed", description, variant: "destructive" });
    }
  };

  const isPending =
    loginMutation.isPending || registerMutation.isPending || driverLoginMutation.isPending;

  const isDriver   = mode === "driver";
  const isRegister = mode === "register";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#ff2e88]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#22d3ee]/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#7c3aed]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff2e88] to-[#7c3aed] mb-4 shadow-xl glow-pink">
            <Bus size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Smart Shuttle Solution</h1>
          <p className="text-[#a7b0c0] text-sm">42 Irbid — Ride Booking Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 shadow-xl backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-white mb-1">
            {isDriver ? "Driver Sign In" : isRegister ? "Create an account" : "Sign in to continue"}
          </h2>
          <p className="text-sm text-[#a7b0c0] mb-6">
            {isDriver
              ? "Enter your Driver ID to access your dashboard"
              : isRegister
              ? "Fill in your details to get started"
              : "Enter your credentials to access your dashboard"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ── Driver ID login ── */}
            {isDriver && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#a7b0c0]">Driver ID</label>
                <div className="relative">
                  <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#22d3ee]/60 focus:bg-white/[0.08] transition-all font-mono tracking-widest"
                    placeholder="e.g. DRV-001"
                  />
                </div>
                <p className="text-[11px] text-[#a7b0c0]/70">
                  Your Driver ID was assigned by the 42 Irbid admin team.
                </p>
              </div>
            )}

            {/* ── Standard email/password fields ── */}
            {!isDriver && (
              <>
                {isRegister && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[#a7b0c0]">Full Name</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#ff2e88]/60 focus:bg-white/[0.08] transition-all"
                        placeholder="Your full name"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#a7b0c0]">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      className={`w-full bg-white/[0.05] border rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:bg-white/[0.08] transition-all ${
                        emailError
                          ? "border-red-500/60 focus:border-red-500/80"
                          : "border-white/[0.08] focus:border-[#ff2e88]/60"
                      }`}
                      placeholder={isRegister && role === "student" ? "you@learner.42.tech" : "you@42irbid.edu"}
                    />
                  </div>
                  {emailError && (
                    <p className="text-xs text-red-400 mt-1">{emailError}</p>
                  )}
                  {isRegister && role === "student" && !emailError && (
                    <p className="text-[11px] text-[#a7b0c0]/70 mt-1">
                      Only @learner.42.tech addresses are accepted.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#a7b0c0]">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#ff2e88]/60 focus:bg-white/[0.08] transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {/* Phone — optional during registration */}
                {isRegister && (
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
                )}

                {/* Role selector — Students and Admins only. Drivers are admin-created. */}
                {isRegister && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[#a7b0c0]">Role</label>
                    <select
                      value={role}
                      onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff2e88]/60 focus:bg-white/[0.08] transition-all"
                    >
                      <option value="student" className="bg-[#0f1420]">Student</option>
                      <option value="admin"   className="bg-[#0f1420]">Admin</option>
                    </select>
                  </div>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={isPending}
              className={`w-full flex items-center justify-center gap-2 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mt-2 ${
                isDriver
                  ? "bg-gradient-to-r from-[#22d3ee] to-[#06b6d4] hover:from-[#38bdf8] hover:to-[#22d3ee]"
                  : "bg-gradient-to-r from-[#ff2e88] to-[#e0176b] hover:from-[#ff4595] hover:to-[#ff2e88]"
              }`}
            >
              {isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Processing...</>
              ) : (
                <>
                  {isDriver ? "Access Driver Dashboard" : isRegister ? "Create Account" : "Sign In"}
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* ── Mode switcher links ── */}
          <div className="mt-5 space-y-2 text-center">
            {!isDriver && (
              <button
                type="button"
                onClick={() => switchMode(isRegister ? "login" : "register")}
                className="block w-full text-sm text-[#a7b0c0] hover:text-[#22d3ee] transition-colors"
              >
                {isRegister ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            )}

            {/* Driver login toggle */}
            <button
              type="button"
              onClick={() => switchMode(isDriver ? "login" : "driver")}
              className="block w-full text-sm text-[#a7b0c0] hover:text-[#22d3ee] transition-colors"
            >
              {isDriver ? "← Back to student / admin sign in" : "Sign in as a Driver →"}
            </button>
          </div>
        </div>

        {/* Demo hints */}
        <div className="mt-4 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-[#a7b0c0] mb-2 font-medium">Demo credentials:</p>
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-[#ff2e88]">Admin</span>
              <span className="text-white/50">admin@42irbid.com / admin123</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-400">Driver</span>
              <span className="text-white/50">Driver ID: DRV-001</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#22d3ee]">Student</span>
              <span className="text-white/50">ali@learner.42.tech / student123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
