/**
 * Manually authored hooks for endpoints not covered by the orval-generated client.
 * These follow the same patterns as the generated hooks in generated/api.ts.
 */
import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
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
