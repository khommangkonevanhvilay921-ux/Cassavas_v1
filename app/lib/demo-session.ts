import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDemoState } from "@/app/lib/demo-store";
import { DEMO_ACCOUNTS, type DemoRole } from "@/app/lib/demo-types";

const cookieName = "cassavalink_demo_session";
const signingSecret = process.env.DEMO_SESSION_SECRET ?? process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "development" ? "cassavalink-local-demo-session-secret" : "");

function signature(role: DemoRole, accountId: string) {
  const secret = role === "admin" ? process.env.DEMO_ADMIN_SECRET : signingSecret;
  if (!secret || (role === "admin" && secret.length < 16)) {
    throw new Error(role === "admin"
      ? "Set DEMO_ADMIN_SECRET to a value with at least 16 characters before enabling administrator sessions."
      : "Set DEMO_SESSION_SECRET or AUTH_SECRET before enabling demo sessions in production.");
  }
  return createHmac("sha256", secret).update(`${role}:${accountId}`).digest("hex");
}

export function createDemoToken(role: DemoRole, accountId = DEMO_ACCOUNTS[role].id) {
  return `${role}:${accountId}:${signature(role, accountId)}`;
}

export async function getDemoIdentity() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const [role, accountId, suppliedSignature] = token.split(":");
  if (!role || !Object.hasOwn(DEMO_ACCOUNTS, role) || !accountId || !suppliedSignature) return null;
  const demoRole = role as DemoRole;
  const expected = Buffer.from(signature(demoRole, accountId));
  const actual = Buffer.from(suppliedSignature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  const demoAccount = DEMO_ACCOUNTS[demoRole];
  if (demoAccount.id === accountId) return { role: demoRole, ...demoAccount, status: "Approved" as const };
  if (demoRole === "admin") return null;

  const account = (await getDemoState()).accounts.find((item) => item.id === accountId && item.role === demoRole);
  if (!account || account.status !== "Approved") return null;
  return { role: demoRole, id: account.id, name: account.name, location: "", verified: false, email: account.email, status: account.status };
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");
  if (!salt || !storedHash) return false;
  const expected = Buffer.from(storedHash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function secureStringEquals(value: string, expected: string) {
  const actualBytes = Buffer.from(value);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export { cookieName };
