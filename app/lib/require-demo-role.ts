import { redirect } from "next/navigation";
import { getDemoIdentity } from "@/app/lib/demo-session";
import type { DemoRole } from "@/app/lib/demo-types";

export async function requireDemoRole(role: DemoRole) {
  const identity = await getDemoIdentity();
  const authorized = role === "admin"
    ? identity?.role === "admin"
    : identity?.role === role || identity?.role === "admin";

  if (!authorized) redirect("/login");
  return identity;
}
