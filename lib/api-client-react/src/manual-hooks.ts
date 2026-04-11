/**
 * Manually authored hooks for endpoints not covered by the orval-generated client.
 * These follow the same patterns as the generated hooks in generated/api.ts.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import type { UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DriverLoginBody {
  driverId: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface AddDriverBody {
  name: string;
  phone: string;
  driverId: string;
}

export interface AddDriverResponse {
  success: boolean;
  driver: {
    id: number;
    name: string;
    driverId: string;
    phone?: string;
  };
}

// ─── Driver Login ─────────────────────────────────────────────────────────────
// Accepts only a Driver ID — no email or password needed.

export const driverLogin = async (body: DriverLoginBody): Promise<AuthResponse> => {
  return customFetch<AuthResponse>("/api/auth/driver-login", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

export const useDriverLogin = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<AuthResponse, TError, { data: DriverLoginBody }, TContext>;
}): UseMutationResult<AuthResponse, TError, { data: DriverLoginBody }, TContext> => {
  return useMutation<AuthResponse, TError, { data: DriverLoginBody }, TContext>({
    mutationFn: ({ data }) => driverLogin(data),
    ...options?.mutation,
  });
};

// ─── Admin: Add Driver ────────────────────────────────────────────────────────
// Admin-only endpoint to create a new driver account.

export const addDriver = async (body: AddDriverBody): Promise<AddDriverResponse> => {
  return customFetch<AddDriverResponse>("/api/auth/admin/add-driver", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

export const useAddDriver = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<AddDriverResponse, TError, { data: AddDriverBody }, TContext>;
}): UseMutationResult<AddDriverResponse, TError, { data: AddDriverBody }, TContext> => {
  return useMutation<AddDriverResponse, TError, { data: AddDriverBody }, TContext>({
    mutationFn: ({ data }) => addDriver(data),
    ...options?.mutation,
  });
};

// ─── Admin: Custom Pickups History ───────────────────────────────────────────

export interface PickupHotspot {
  coordinates: { lat: number; lng: number };
  totalUsage: number;
  studentsHistory: { name: string; date: string }[];
}

export const getCustomPickupsHistory = async (): Promise<PickupHotspot[]> => {
  return customFetch<PickupHotspot[]>("/api/admin/custom-pickups-history");
};

export const useGetCustomPickupsHistory = <TError = ErrorType<unknown>>(options?: {
  query?: UseQueryOptions<PickupHotspot[], TError>;
}): UseQueryResult<PickupHotspot[], TError> => {
  return useQuery<PickupHotspot[], TError>({
    queryKey: ["admin", "custom-pickups-history"],
    queryFn: getCustomPickupsHistory,
    staleTime: 60_000,
    ...options?.query,
  });
};

// ─── Time Slots ───────────────────────────────────────────────────────────────

export interface TimeSlot {
  id: number;
  timeString: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const getTimeSlots = async (): Promise<TimeSlot[]> => {
  return customFetch<TimeSlot[]>("/api/timeslots");
};

export const useGetTimeSlots = <TError = ErrorType<unknown>>(options?: {
  query?: UseQueryOptions<TimeSlot[], TError>;
}): UseQueryResult<TimeSlot[], TError> => {
  return useQuery<TimeSlot[], TError>({
    queryKey: ["timeslots"],
    queryFn: getTimeSlots,
    staleTime: 30_000,
    ...options?.query,
  });
};

export const addTimeSlot = async (body: { timeString: string }): Promise<TimeSlot> => {
  return customFetch<TimeSlot>("/api/admin/timeslots", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

export const useAddTimeSlot = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<TimeSlot, TError, { timeString: string }, TContext>;
}): UseMutationResult<TimeSlot, TError, { timeString: string }, TContext> => {
  return useMutation<TimeSlot, TError, { timeString: string }, TContext>({
    mutationFn: (data) => addTimeSlot(data),
    ...options?.mutation,
  });
};

export const deleteTimeSlot = async (id: number): Promise<{ success: boolean; id: number }> => {
  return customFetch<{ success: boolean; id: number }>(`/api/admin/timeslots/${id}`, {
    method: "DELETE",
  });
};

export const useDeleteTimeSlot = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<{ success: boolean; id: number }, TError, number, TContext>;
}): UseMutationResult<{ success: boolean; id: number }, TError, number, TContext> => {
  return useMutation<{ success: boolean; id: number }, TError, number, TContext>({
    mutationFn: (id) => deleteTimeSlot(id),
    ...options?.mutation,
  });
};

// ─── Admin: Stat Card Drill-Down ──────────────────────────────────────────────

export type StatCardKey =
  | "totalStudents"
  | "bookingsToday"
  | "confirmedTrips"
  | "pendingTrips"
  | "tripsThisWeek"
  | "avgOccupancy"
  | "peakTime"
  | "efficiency";

export interface StatDetailsResponse {
  columns: string[];
  rows: Record<string, string | number>[];
}

export const getStatDetails = async (card: StatCardKey): Promise<StatDetailsResponse> => {
  return customFetch<StatDetailsResponse>(`/api/admin/stat-details?card=${card}`);
};

export const useGetStatDetails = <TError = ErrorType<unknown>>(
  card: StatCardKey | null,
  options?: { query?: UseQueryOptions<StatDetailsResponse, TError> },
): UseQueryResult<StatDetailsResponse, TError> => {
  return useQuery<StatDetailsResponse, TError>({
    queryKey: ["admin", "stat-details", card],
    queryFn: () => getStatDetails(card!),
    enabled: card !== null,
    staleTime: 30_000,
    ...options?.query,
  });
};
