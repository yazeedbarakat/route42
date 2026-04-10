import { customFetch, useAddDriver } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Hash, Loader2, Phone, Plus, Shield, Trash2, UserPlus, Users, UsersRound } from "lucide-react";

interface DriverAccount {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  driverId: string | null;
  createdAt: string;
}

export default function AdminDriverManagement() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addDriver = useAddDriver();
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverIdInput, setDriverIdInput] = useState("");

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "admin") setLocation(user.role === "student" ? "/dashboard" : "/driver");
  }, [user, setLocation]);

  const { data: drivers = [], isLoading } = useQuery<DriverAccount[]>({
    queryKey: ["admin", "drivers"],
    queryFn: () => customFetch<DriverAccount[]>("/api/auth/admin/drivers"),
    enabled: !!user && user.role === "admin",
  });

  const deleteDriver = useMutation({
    mutationFn: (id: number) => customFetch(`/api/auth/admin/drivers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "drivers"] });
      toast({ title: "Driver deleted", description: "The driver account has been removed." });
    },
    onError: (err: any) => {
      toast({
        title: "Could not delete driver",
        description: err?.data?.error ?? err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setDriverName("");
    setDriverPhone("");
    setDriverIdInput("");
    setShowAddDriver(false);
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await addDriver.mutateAsync({
        data: { name: driverName, phone: driverPhone, driverId: driverIdInput },
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "drivers"] });
      toast({
        title: "Driver registered",
        description: `${res.driver.name} can now log in with Driver ID: ${res.driver.driverId}`,
      });
      resetForm();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.data?.error ?? err?.message ?? "Failed to register driver.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDriver = (driver: DriverAccount) => {
    if (!confirm(`Delete driver ${driver.name}? This removes their login access.`)) return;
    deleteDriver.mutate(driver.id);
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-[#ff2e88]" />
            <span className="text-xs font-semibold text-[#ff2e88] uppercase tracking-wider">Admin Panel</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Driver Management</h1>
          <p className="text-[#a7b0c0] text-sm mt-0.5">View, register, and remove driver accounts.</p>
        </div>
        <button
          onClick={() => setShowAddDriver(v => !v)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold transition-colors"
        >
          <Plus size={15} />
          Add Driver
        </button>
      </div>

      {showAddDriver && (
        <form onSubmit={handleAddDriver} className="bg-white/[0.03] border border-[#7c3aed]/20 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 flex items-center justify-center">
              <UserPlus size={18} className="text-[#7c3aed]" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Register New Driver</p>
              <p className="text-xs text-[#a7b0c0]">Drivers sign in using their unique Driver ID.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#a7b0c0]">Driver Name</label>
              <div className="relative">
                <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#7c3aed]/60 focus:bg-white/[0.08] transition-all"
                  placeholder="Full name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#a7b0c0]">Phone Number</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                <input
                  type="tel"
                  required
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#7c3aed]/60 focus:bg-white/[0.08] transition-all"
                  placeholder="+962 7X XXX XXXX"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#a7b0c0]">Driver ID</label>
              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                <input
                  type="text"
                  required
                  value={driverIdInput}
                  onChange={(e) => setDriverIdInput(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#7c3aed]/60 focus:bg-white/[0.08] transition-all font-mono tracking-widest"
                  placeholder="e.g. DRV-002"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={addDriver.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {addDriver.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Creating...</>
              ) : (
                <><UserPlus size={14} /> Register Driver</>
              )}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-[#a7b0c0] hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersRound size={16} className="text-[#ff2e88]" />
            <h2 className="font-semibold text-white text-sm">All Registered Drivers</h2>
          </div>
          <span className="text-xs text-[#a7b0c0]">{drivers.length} drivers</span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 p-6">
            <Loader2 size={18} className="animate-spin text-[#ff2e88]" />
            <span className="text-[#a7b0c0] text-sm">Loading drivers...</span>
          </div>
        ) : drivers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
              <UsersRound size={22} className="text-[#a7b0c0]" />
            </div>
            <p className="text-white font-medium">No drivers found</p>
            <p className="text-[#a7b0c0] text-sm mt-1">Add a driver to get started.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Driver", "Driver ID", "Phone", "Created", "Actions"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#a7b0c0] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver, idx) => (
                    <tr key={driver.id} className={`${idx !== drivers.length - 1 ? "border-b border-white/[0.04]" : ""} hover:bg-white/[0.02] transition-colors`}>
                      <td className="px-5 py-4">
                        <div className="font-medium text-white text-sm">{driver.name}</div>
                        <div className="text-xs text-[#a7b0c0]">{driver.email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs text-[#22d3ee] bg-[#22d3ee]/10 border border-[#22d3ee]/20 rounded-full px-2.5 py-1">
                          {driver.driverId ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#a7b0c0]">{driver.phone ?? "—"}</td>
                      <td className="px-5 py-4 text-xs text-[#a7b0c0] font-mono">{new Date(driver.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleDeleteDriver(driver)}
                          disabled={deleteDriver.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/20 transition-colors disabled:opacity-50 text-xs font-semibold"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-white/[0.06]">
              {drivers.map(driver => (
                <div key={driver.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white text-sm">{driver.name}</p>
                      <p className="text-xs text-[#a7b0c0]">{driver.phone ?? "No phone"}</p>
                    </div>
                    <span className="font-mono text-xs text-[#22d3ee] bg-[#22d3ee]/10 border border-[#22d3ee]/20 rounded-full px-2.5 py-1">
                      {driver.driverId ?? "—"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteDriver(driver)}
                    disabled={deleteDriver.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/20 transition-colors disabled:opacity-50 text-xs font-semibold"
                  >
                    <Trash2 size={12} />
                    Delete Driver
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}