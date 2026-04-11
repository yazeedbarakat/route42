/**
 * TEST-ONLY: Hardcoded student accounts for development / QA.
 *
 * To replace with real auth later:
 *   1. Delete this file.
 *   2. Remove the POST /auth/test-login route from routes/auth.ts.
 *   3. Remove the negative-id branch from GET /auth/me in routes/auth.ts.
 *   Nothing else needs to change.
 */

export interface TestAccount {
  id: number;
  username: string;
  password: string;
  name: string;
  email: string;
}

// Negative IDs guarantee they never collide with real database auto-increment IDs.
export const TEST_ACCOUNTS: TestAccount[] = [
  { id: -1, username: "s1", password: "s1", name: "Student 1", email: "s1@test.shuttle" },
  { id: -2, username: "s2", password: "s2", name: "Student 2", email: "s2@test.shuttle" },
  { id: -3, username: "s3", password: "s3", name: "Student 3", email: "s3@test.shuttle" },
  { id: -4, username: "s4", password: "s4", name: "Student 4", email: "s4@test.shuttle" },
  { id: -5, username: "s5", password: "s5", name: "Student 5", email: "s5@test.shuttle" },
  { id: -6, username: "s6", password: "s6", name: "Student 6", email: "s6@test.shuttle" },
];

export function findTestAccount(username: string, password: string): TestAccount | null {
  return TEST_ACCOUNTS.find(
    (a) => a.username === username && a.password === password,
  ) ?? null;
}

export function getTestAccountById(id: number): TestAccount | null {
  return TEST_ACCOUNTS.find((a) => a.id === id) ?? null;
}
