import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { DEMO_ACCOUNTS, type DemoRole } from "@/app/lib/demo-types";

const cookieName = "cassavalink_demo_session";
const signingSecret = process.env.DEMO_SESSION_SECRET ?? process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "development" ? "cassavalink-local-demo-session-secret" : "");

function signature(role: DemoRole, accountId: string) {
  if (!signingSecret) throw new Error("Set DEMO_SESSION_SECRET or AUTH_SECRET before enabling demo sessions in production.");
  return createHmac("sha256", signingSecret).update(`${role}:${accountId}`).digest("hex");
}

export function createDemoToken(role: DemoRole) {
  const accountId = DEMO_ACCOUNTS[role].id;
  return `${role}:${accountId}:${signature(role, accountId)}`;
}

export async function getDemoIdentity() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const [role, accountId, suppliedSignature] = token.split(":");
  if (!(role in DEMO_ACCOUNTS) || !accountId || !suppliedSignature) return null;
  const demoRole = role as DemoRole;
  if (DEMO_ACCOUNTS[demoRole].id !== accountId) return null;
  const expected = Buffer.from(signature(demoRole, accountId));
  const actual = Buffer.from(suppliedSignature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { role: demoRole, ...DEMO_ACCOUNTS[demoRole] };
}

export { cookieName };
