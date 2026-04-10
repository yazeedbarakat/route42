import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Bus, Mail, Lock, User, ChevronRight, Loader2, Phone } from "lucide-react";

type UserRole = "student" | "admin" | "driver";

// Only @learner.42.tech addresses are accepted for student registration
const STUDENT_EMAIL_DOMAIN = "@learner.42.tech";

export default function Login() {
  const { user, setToken } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [emailError, setEmailError] = useState<string | null>(null);

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  useEffect(() => {
    if (user) {
      if (user.role === "student") setLocation("/dashboard");
      else if (user.role === "admin") setLocation("/admin");
      else if (user.role === "driver") setLocation("/driver");
    }
  }, [user, setLocation]);

  // Validate email domain when registering as a student
  const validateEmail = (value: string, currentRole: UserRole) => {
    if (isRegistering && currentRole === "student") {
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
    if (isRegistering) validateEmail(value, role);
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (isRegistering) validateEmail(email, newRole);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Re-run email validation before submitting
    if (isRegistering && !validateEmail(email, role)) return;
    try {
      if (isRegistering) {
        const res = await registerMutation.mutateAsync({
          data: { email, password, name, role, phone: phone || undefined },
        });
        setToken(res.token);
        toast({ title: "Welcome!", description: "Account created successfully." });
      } else {
        const res = await loginMutation.mutateAsync({ data: { email, password } });
        setToken(res.token);
        toast({ title: "Welcome back!", description: "Signed in successfully." });
      }
    } catch (err: any) {
      toast({ title: "Authentication failed", description: err?.message || "Please check your credentials.", variant: "destructive" });
    }
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;

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
            {isRegistering ? "Create an account" : "Sign in to continue"}
          </h2>
          <p className="text-sm text-[#a7b0c0] mb-6">
            {isRegistering ? "Fill in your details to get started" : "Enter your credentials to access your dashboard"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
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
                    emailError ? "border-red-500/60 focus:border-red-500/80" : "border-white/[0.08] focus:border-[#ff2e88]/60"
                  }`}
                  placeholder={isRegistering && role === "student" ? "you@learner.42.tech" : "you@42irbid.edu"}
                />
              </div>
              {/* Email domain validation error */}
              {emailError && (
                <p className="text-xs text-red-400 mt-1">{emailError}</p>
              )}
              {/* Domain hint for student registration */}
              {isRegistering && role === "student" && !emailError && (
                <p className="text-[11px] text-[#a7b0c0]/70 mt-1">Only @learner.42.tech addresses are accepted.</p>
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

            {isRegistering && (
              <div className="space-y-1.5">
                {/* Phone number — required at registration */}
                <label className="text-sm font-medium text-[#a7b0c0]">Phone Number</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#ff2e88]/60 focus:bg-white/[0.08] transition-all"
                    placeholder="+962 7X XXX XXXX"
                  />
                </div>
              </div>
            )}

            {isRegistering && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#a7b0c0]">Role</label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff2e88]/60 focus:bg-white/[0.08] transition-all"
                >
                  <option value="student" className="bg-[#0f1420]">Student</option>
                  <option value="driver" className="bg-[#0f1420]">Driver</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#ff2e88] to-[#e0176b] hover:from-[#ff4595] hover:to-[#ff2e88] text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mt-2"
            >
              {isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Processing...</>
              ) : (
                <>{isRegistering ? "Create Account" : "Sign In"}<ChevronRight size={16} /></>
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-sm text-[#a7b0c0] hover:text-[#22d3ee] transition-colors"
            >
              {isRegistering ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
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
              <span className="text-white/50">driver@42irbid.com / driver123</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#22d3ee]">Student</span>
              <span className="text-white/50">ali@42irbid.com / student123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
