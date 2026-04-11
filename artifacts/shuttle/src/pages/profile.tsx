import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Camera, Save, CheckCircle, AlertCircle, UserCog, Mail, Phone, User, Trash2
} from "lucide-react";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

function AvatarDisplay({ src, name, size = 96 }: { src: string | null; name: string; size?: number }) {
  const initials = name.trim().charAt(0).toUpperCase();
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
      <span className="text-white font-bold" style={{ fontSize: size * 0.38 }}>{initials}</span>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [preview, setPreview] = useState<string | null>(user?.profilePicture ?? null);
  const [pendingPicture, setPendingPicture] = useState<string | null | "remove">(undefined as unknown as null);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  if (!user) {
    setLocation("/");
    return null;
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSizeError(null);

    if (file.size > MAX_SIZE_BYTES) {
      setSizeError(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 2 MB.`);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreview(dataUrl);
      setPendingPicture(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveAvatar = () => {
    setPreview(null);
    setPendingPicture("remove");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      const token = localStorage.getItem("shuttle_token");
      const body: Record<string, unknown> = {};

      if (name.trim() !== user.name) body.name = name.trim();
      if ((phone.trim() || null) !== (user.phone ?? null)) body.phone = phone.trim() || null;

      if (pendingPicture === "remove") {
        body.profilePicture = null;
      } else if (pendingPicture && pendingPicture !== user.profilePicture) {
        body.profilePicture = pendingPicture;
      }

      if (Object.keys(body).length === 0) {
        setSaving(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        return;
      }

      const res = await fetch(`${import.meta.env.BASE_URL}api/student/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to save changes.");
      }

      // Invalidate /auth/me so all components using user data refresh instantly
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setPendingPicture(undefined as unknown as null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    name.trim() !== user.name ||
    (phone.trim() || null) !== (user.phone ?? null) ||
    pendingPicture !== undefined;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#ff2e88]/10 border border-[#ff2e88]/20 flex items-center justify-center">
          <UserCog size={19} className="text-[#ff2e88]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">My Profile</h1>
          <p className="text-[#a7b0c0] text-sm">Update your personal info and avatar</p>
        </div>
      </div>

      {/* Avatar section */}
      <div className="bg-[#090d14] border border-white/[0.08] rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#a7b0c0] mb-4">Profile Picture</p>
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative shrink-0">
            <AvatarDisplay src={preview} name={name || user.name} size={88} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#ff2e88] border-2 border-[#090d14] flex items-center justify-center hover:bg-[#e0276e] transition-colors shadow-lg"
              title="Change avatar"
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {sizeError && (
          <div className="mt-3 flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle size={13} />
            {sizeError}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="bg-[#090d14] border border-white/[0.08] rounded-2xl p-6 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#a7b0c0]">Personal Info</p>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#a7b0c0]">
            <User size={12} />
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-[#4a5568] text-sm focus:outline-none focus:border-[#ff2e88]/50 focus:bg-white/[0.06] transition-all"
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#a7b0c0]">
            <Mail size={12} />
            Email Address
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-white/[0.06] border border-white/[0.08] text-[#a7b0c0] rounded-md">read-only</span>
          </label>
          <input
            type="email"
            value={user.email}
            readOnly
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[#6b7280] text-sm cursor-not-allowed"
          />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#a7b0c0]">
            <Phone size={12} />
            Phone Number
            <span className="ml-1 text-[10px] text-[#4a5568]">optional</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+962 7X XXX XXXX"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-[#4a5568] text-sm focus:outline-none focus:border-[#ff2e88]/50 focus:bg-white/[0.06] transition-all"
          />
        </div>
      </div>

      {/* Feedback banners */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-4 py-3">
          <CheckCircle size={15} className="shrink-0" />
          Changes saved successfully!
        </div>
      )}

      {/* Save button */}
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
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Save size={15} />
            Save Changes
          </>
        )}
      </button>
    </div>
  );
}
