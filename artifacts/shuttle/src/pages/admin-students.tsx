import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Loader2, Mail, Plus, Shield, Trash2,
  UserPlus, Users, UsersRound, X, Lock, User,
} from "lucide-react";
import { getGetDashboardStatsQueryKey } from "@workspace/api-client-react";

interface StudentAccount {
  id: number;
  name: string;
  email: string;
  username: string | null;
  createdAt: string;
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative bg-[#0f1117] border border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-md">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#a7b0c0] hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

export default function AdminStudents() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentAccount | null>(null);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "admin") setLocation(user.role === "student" ? "/dashboard" : "/driver");
  }, [user, setLocation]);

  const { data: students = [], isLoading } = useQuery<StudentAccount[]>({
    queryKey: ["admin", "students"],
    queryFn: () => customFetch<StudentAccount[]>("/api/admin/students"),
    enabled: !!user && user.role === "admin",
  });

  const addStudent = useMutation({
    mutationFn: (body: { name: string; email: string; password: string }) =>
      customFetch<StudentAccount>("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      toast({ title: "Student added", description: `${created.name} can now log in with their email.` });
      setShowAddModal(false);
      setFormName(""); setFormEmail(""); setFormPassword("");
    },
    onError: (err: any) => {
      toast({
        title: "Could not add student",
        description: err?.data?.error ?? err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteStudent = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/admin/students/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      toast({ title: "Student deleted", description: "The student and all their bookings have been removed." });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({
        title: "Could not delete student",
        description: err?.data?.error ?? err?.message ?? "Please try again.",
        variant: "destructive",
      });
      setDeleteTarget(null);
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addStudent.mutate({ name: formName, email: formEmail, password: formPassword });
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* ── Add Student Modal ── */}
      {showAddModal && (
        <Modal onClose={() => { setShowAddModal(false); setFormName(""); setFormEmail(""); setFormPassword(""); }}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#22d3ee]/10 border border-[#22d3ee]/20 flex items-center justify-center">
                <UserPlus size={18} className="text-[#22d3ee]" />
              </div>
              <div>
                <p className="font-semibold text-white">Add New Student</p>
                <p className="text-xs text-[#a7b0c0]">Students log in with their email and password.</p>
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#a7b0c0]">Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. Sara Al-Hassan"
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#22d3ee]/60 focus:bg-white/[0.08] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#a7b0c0]">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="student@learner.42.tech"
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#22d3ee]/60 focus:bg-white/[0.08] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#a7b0c0]">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b0c0]" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-[#a7b0c0]/50 text-sm focus:outline-none focus:border-[#22d3ee]/60 focus:bg-white/[0.08] transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={addStudent.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#22d3ee] hover:bg-[#06b6d4] text-black text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {addStudent.isPending
                    ? <><Loader2 size={14} className="animate-spin" /> Adding...</>
                    : <><UserPlus size={14} /> Add Student</>}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setFormName(""); setFormEmail(""); setFormPassword(""); }}
                  className="text-sm text-[#a7b0c0] hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-400/10 border border-red-400/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Delete Student</p>
                <p className="text-xs text-[#a7b0c0]">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <div className="bg-red-400/[0.06] border border-red-400/20 rounded-xl p-4">
              <p className="text-sm text-white font-medium">{deleteTarget.name}</p>
              <p className="text-xs text-[#a7b0c0] mt-0.5">{deleteTarget.email}</p>
              <p className="text-xs text-red-400 mt-2">
                All bookings and notifications tied to this account will also be permanently deleted.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => deleteStudent.mutate(deleteTarget.id)}
                disabled={deleteStudent.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {deleteStudent.isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Deleting...</>
                  : <><Trash2 size={14} /> Yes, Delete</>}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-sm text-[#a7b0c0] hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-[#ff2e88]" />
            <span className="text-xs font-semibold text-[#ff2e88] uppercase tracking-wider">Admin Panel</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Student Management</h1>
          <p className="text-[#a7b0c0] text-sm mt-0.5">Add and remove student accounts.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#22d3ee] hover:bg-[#06b6d4] text-black text-sm font-semibold transition-colors"
        >
          <Plus size={15} />
          Add Student
        </button>
      </div>

      {/* ── Students Table ── */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersRound size={16} className="text-[#22d3ee]" />
            <h2 className="font-semibold text-white text-sm">All Students</h2>
          </div>
          <span className="text-xs text-[#a7b0c0]">{students.length} students</span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 p-6">
            <Loader2 size={18} className="animate-spin text-[#22d3ee]" />
            <span className="text-[#a7b0c0] text-sm">Loading students...</span>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-14">
            <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
              <Users size={22} className="text-[#a7b0c0]" />
            </div>
            <p className="text-white font-medium">No students found</p>
            <p className="text-[#a7b0c0] text-sm mt-1">Click "Add Student" to register one.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Student", "Email", "Username", "Joined", "Actions"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#a7b0c0] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => (
                    <tr
                      key={student.id}
                      className={`${idx !== students.length - 1 ? "border-b border-white/[0.04]" : ""} hover:bg-white/[0.02] transition-colors`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#22d3ee]/10 border border-[#22d3ee]/20 flex items-center justify-center shrink-0">
                            <span className="text-[#22d3ee] text-xs font-bold">
                              {student.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-white">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#a7b0c0]">{student.email}</td>
                      <td className="px-5 py-4">
                        {student.username ? (
                          <span className="font-mono text-xs text-[#22d3ee] bg-[#22d3ee]/10 border border-[#22d3ee]/20 rounded-full px-2.5 py-1">
                            {student.username}
                          </span>
                        ) : (
                          <span className="text-[#a7b0c0] text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-[#a7b0c0] font-mono">
                        {new Date(student.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setDeleteTarget(student)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/20 transition-colors text-xs font-semibold"
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

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-white/[0.06]">
              {students.map(student => (
                <div key={student.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#22d3ee]/10 border border-[#22d3ee]/20 flex items-center justify-center shrink-0">
                        <span className="text-[#22d3ee] text-sm font-bold">
                          {student.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">{student.name}</p>
                        <p className="text-xs text-[#a7b0c0]">{student.email}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-[#a7b0c0] font-mono mt-1">
                      {new Date(student.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setDeleteTarget(student)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/20 transition-colors text-xs font-semibold"
                  >
                    <Trash2 size={12} />
                    Delete Student
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
