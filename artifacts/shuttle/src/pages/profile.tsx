import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Camera, Save, CheckCircle, AlertCircle, UserCog, Mail, Phone, User,
  Trash2, Lock, Eye, EyeOff, ShieldCheck
} from "lucide-react";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

// ─── Password strength ────────────────────────────────────────────────────────
function pwStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8)                    score++;
  if (pw.length >= 12)                   score++;
  if (/[A-Z]/.test(pw))                  score++;
  if (/[0-9]/.test(pw))                  score++;
  if (/[^A-Za-z0-9]/.test(pw))          score++;
  if (score <= 1) return { score, label: "Weak",   color: "bg-red-500" };
  if (score <= 2) return { score, label: "Fair",   color: "bg-orange-400" };
  if (score <= 3) return { score, label: "Good",   color: "bg-yellow-400" };
  if (score <= 4) return { score, label: "Strong", color: "bg-emerald-400" };
  return              { score, label: "Very strong", color: "bg-emerald-400" };
}

// ─── Avatar display ───────────────────────────────────────────────────────────
function AvatarDisplay({ src, name, size = 96 }: { src: string | null; name: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="rounded-full object-cover border-2 border-white/10"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-gradient-to-br from-[#ff2e88]/30 to-[#7c3aed]/30 border-2 border-white/10 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <span className="text-white font-bold" style={{ fontSize: size * 0.38 }}>
        {name.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

// ─── Password field with eye toggle ──────────────────────────────────────────
function PasswordInput({
  value, onChange, placeholder, id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-[#4a5568] text-sm focus:outline-none focus:border-[#ff2e88]/50 focus:bg-white/[0.06] transition-all"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a7b0c0] hover:text-white transition-colors"
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Profile info state ──
  const [name, setName]                     = useState(user?.name ?? "");
  const [phone, setPhone]                   = useState(user?.phone ?? "");
  const [preview, setPreview]               = useState<string | null>(user?.profilePicture ?? null);
  const [avatarChanged, setAvatarChanged]   = useState(false);
  const [pendingPicture, setPendingPicture] = useState<string | null | "remove">(null);
  const [saving, setSaving]                 = useState(false);
  const [success, setSuccess]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [sizeError, setSizeError]           = useState<string | null>(null);

  // ── Password state ──
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [pwSaving, setPwSaving]     = useState(false);
  const [pwSuccess, setPwSuccess]   = useState(false);
  const [pwError, setPwError]       = useState<string | null>(null);

  useEffect(() => {
    if (!user) setLocation("/");
  }, [user, setLocation]);

  if (!user) return null;

  // ── Avatar handlers ──
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSizeError(null);
    if (file.size > MAX_SIZE_BYTES) {
      setSizeError(`Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 2 MB.`);
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreview(dataUrl);
      setPendingPicture(dataUrl);
      setAvatarChanged(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveAvatar = () => {
    setPreview(null);
    setPendingPicture("remove");
    setAvatarChanged(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Profile save ──
  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      const token = localStorage.getItem("shuttle_token");
      const body: Record<string, unknown> = {};
      if (name.trim() !== user.name)                          body.name  = name.trim();
      if ((phone.trim() || null) !== (user.phone ?? null))    body.phone = phone.trim() || null;
      if (avatarChanged) {
        body.profilePicture = pendingPicture === "remove" ? null
          : typeof pendingPicture === "string" ? pendingPicture : undefined;
        if (body.profilePicture === undefined) delete body.profilePicture;
      }
      if (Object.keys(body).length === 0) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        return;
      }
      const res = await fetch(`${import.meta.env.BASE_URL}api/student/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to save changes.");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setPendingPicture(null);
      setAvatarChanged(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  // ── Password save ──
  const handlePasswordChange = async () => {
    setPwError(null);
    if (!currentPw) { setPwError("Please enter your current password."); return; }
    if (newPw.length < 6) { setPwError("New password must be at least 6 characters."); return; }
    if (newPw !== confirmPw) { setPwError("Passwords don't match."); return; }
    if (newPw === currentPw) { setPwError("New password must be different from current."); return; }

    setPwSaving(true);
    try {
      const token = localStorage.getItem("shuttle_token");
      const res = await fetch(`${import.meta.env.BASE_URL}api/student/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to update password.");
      }
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setPwSaving(false);
    }
  };

  const hasChanges = name.trim() !== user.name ||
    (phone.trim() || null) !== (user.phone ?? null) ||
    avatarChanged;

  const strength    = pwStrength(newPw);
  const pwReady     = currentPw.length > 0 && newPw.length >= 6 && confirmPw.length > 0;
  const pwMismatch  = confirmPw.length > 0 && newPw !== confirmPw;

  return (
    <div className="max-w-lg mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#ff2e88]/10 border border-[#ff2e88]/20 flex items-center justify-center">
          <UserCog size={19} className="text-[#ff2e88]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">My Profile</h1>
          <p className="text-[#a7b0c0] text-sm">Manage your account settings</p>
        </div>
      </div>

      {/* ── Avatar ── */}
      <div className="bg-[#090d14] border border-white/[0.08] rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#a7b0c0] mb-4">Profile Picture</p>
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative shrink-0">
            <AvatarDisplay src={preview} name={name || user.name} size={88} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#ff2e88] border-2 border-[#090d14] flex items-center justify-center hover:bg-[#e0276e] transition-colors shadow-lg"
            >
              <Camera size={13} className="text-white" />
            </button>
          </div>
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <p className="text-sm text-white font-medium">{user.name}</p>
            <p className="text-xs text-[#a7b0c0]">JPG, PNG or WebP · Max 2 MB</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white rounded-lg transition-colors"
              >
                Change Avatar
              </button>
              {preview && (
                <button
                  onClick={handleRemoveAvatar}
                  className="px-3 py-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={11} />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
        {sizeError && (
          <div className="mt-3 flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle size={13} />{sizeError}
          </div>
        )}
      </div>

      {/* ── Personal Info ── */}
      <div className="bg-[#090d14] border border-white/[0.08] rounded-2xl p-6 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#a7b0c0]">Personal Info</p>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#a7b0c0]">
            <User size={12} />Full Name
          </label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-[#4a5568] text-sm focus:outline-none focus:border-[#ff2e88]/50 focus:bg-white/[0.06] transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#a7b0c0]">
            <Mail size={12} />Email Address
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-white/[0.06] border border-white/[0.08] text-[#a7b0c0] rounded-md">read-only</span>
          </label>
          <input type="email" value={user.email} readOnly
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[#6b7280] text-sm cursor-not-allowed" />
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#a7b0c0]">
            <Phone size={12} />Phone Number
            <span className="ml-1 text-[10px] text-[#4a5568]">optional</span>
          </label>
          <input
            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="+962 7X XXX XXXX"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-[#4a5568] text-sm focus:outline-none focus:border-[#ff2e88]/50 focus:bg-white/[0.06] transition-all"
          />
        </div>
      </div>

      {/* ── Profile feedback + save ── */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-4 py-3">
          <CheckCircle size={15} className="shrink-0" />Profile updated successfully!
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={saving || !hasChanges || !name.trim()}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
          saving || !hasChanges || !name.trim()
            ? "bg-white/[0.04] border border-white/[0.08] text-[#4a5568] cursor-not-allowed"
            : "bg-[#ff2e88] hover:bg-[#e0276e] text-white shadow-lg shadow-[#ff2e88]/20"
        }`}
      >
        {saving ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
        ) : (
          <><Save size={15} />Save Changes</>
        )}
      </button>

      {/* ── Change Password ── */}
      <div className="bg-[#090d14] border border-white/[0.08] rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={15} className="text-[#7c3aed]" />
          <p className="text-xs font-semibold uppercase tracking-wider text-[#a7b0c0]">Change Password</p>
        </div>

        {/* Current password */}
        <div className="space-y-1.5">
          <label htmlFor="cur-pw" className="flex items-center gap-1.5 text-xs font-medium text-[#a7b0c0]">
            <Lock size={12} />Current Password
          </label>
          <PasswordInput id="cur-pw" value={currentPw} onChange={setCurrentPw} placeholder="Enter current password" />
        </div>

        {/* New password + strength */}
        <div className="space-y-1.5">
          <label htmlFor="new-pw" className="flex items-center gap-1.5 text-xs font-medium text-[#a7b0c0]">
            <Lock size={12} />New Password
          </label>
          <PasswordInput id="new-pw" value={newPw} onChange={setNewPw} placeholder="At least 6 characters" />
          {newPw.length > 0 && (
            <div className="space-y-1 pt-0.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      strength.score >= i ? strength.color : "bg-white/[0.08]"
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-[#a7b0c0]">
                Strength: <span className="font-semibold text-white">{strength.label}</span>
                <span className="ml-2 text-[#4a5568]">— use uppercase, numbers &amp; symbols to improve</span>
              </p>
            </div>
          )}
        </div>

        {/* Confirm new password */}
        <div className="space-y-1.5">
          <label htmlFor="confirm-pw" className="flex items-center gap-1.5 text-xs font-medium text-[#a7b0c0]">
            <Lock size={12} />Confirm New Password
          </label>
          <PasswordInput id="confirm-pw" value={confirmPw} onChange={setConfirmPw} placeholder="Re-enter new password" />
          {pwMismatch && (
            <p className="text-[11px] text-red-400 flex items-center gap-1">
              <AlertCircle size={11} />Passwords don't match
            </p>
          )}
          {confirmPw.length > 0 && !pwMismatch && (
            <p className="text-[11px] text-emerald-400 flex items-center gap-1">
              <CheckCircle size={11} />Passwords match
            </p>
          )}
        </div>

        {/* Password feedback */}
        {pwError && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="shrink-0" />{pwError}
          </div>
        )}
        {pwSuccess && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-4 py-3">
            <CheckCircle size={15} className="shrink-0" />Password updated successfully!
          </div>
        )}

        <button
          onClick={handlePasswordChange}
          disabled={pwSaving || !pwReady || pwMismatch}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            pwSaving || !pwReady || pwMismatch
              ? "bg-white/[0.04] border border-white/[0.08] text-[#4a5568] cursor-not-allowed"
              : "bg-[#7c3aed] hover:bg-[#6d28d9] text-white shadow-lg shadow-[#7c3aed]/20"
          }`}
        >
          {pwSaving ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Updating…</>
          ) : (
            <><ShieldCheck size={15} />Update Password</>
          )}
        </button>
      </div>

    </div>
  );
}
