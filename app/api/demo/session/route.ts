import { NextResponse } from "next/server";
import { createDemoToken, cookieName, secureStringEquals, verifyPassword } from "@/app/lib/demo-session";
import { getDemoState } from "@/app/lib/demo-store";
import { DEMO_ACCOUNTS, type DemoRole } from "@/app/lib/demo-types";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Valid sign-in details are required." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  let role: DemoRole;
  let accountId: string;
  let account: { id: string; name: string; location: string; verified: boolean };

  if (typeof input.adminSecret === "string") {
    const adminSecret = process.env.DEMO_ADMIN_SECRET;
    if (!adminSecret || adminSecret.length < 16) {
      return Response.json({ error: "Administrator sign-in is not configured. Set DEMO_ADMIN_SECRET to a value with at least 16 characters." }, { status: 503 });
    }
    if (!secureStringEquals(input.adminSecret, adminSecret)) {
      return Response.json({ error: "Administrator credentials are invalid." }, { status: 401 });
    }
    role = "admin";
    account = DEMO_ACCOUNTS.admin;
    accountId = account.id;
  } else if ((typeof input.email === "string" || typeof input.phone === "string") && typeof input.password === "string") {
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const phoneInput = typeof input.phone === "string" ? input.phone.replace(/[\s().-]/g, "") : "";
    const phone = /^\+?[1-9]\d{7,14}$/.test(phoneInput) ? `+${phoneInput.replace(/^\+/, "")}` : "";
    if (input.password.length > 256) return Response.json({ error: "Email or phone number and password are incorrect." }, { status: 401 });
    const registered = (await getDemoState()).accounts.find((item) => email ? item.email === email : phone && item.phone === phone);
    if (!registered || !verifyPassword(input.password, registered.passwordHash)) {
      return Response.json({ error: "Email or phone number and password are incorrect." }, { status: 401 });
    }
    if (registered.status === "Pending Verification") {
      return Response.json({ error: "Complete the simulated verification step before signing in." }, { status: 403 });
    }
    if (registered.status === "Pending Admin Approval") {
      return Response.json({ error: "Your account is Pending Admin Approval. You cannot access a workspace until an administrator approves it." }, { status: 403 });
    }
    if (registered.status === "Rejected") {
      const reason = registered.rejectionReason ? ` Reason: ${registered.rejectionReason}` : "";
      return Response.json({ error: `Your account was Rejected and cannot access the platform.${reason}` }, { status: 403 });
    }
    if (registered.status !== "Approved") {
      return Response.json({ error: "This account status does not allow sign in." }, { status: 403 });
    }
    role = registered.role;
    accountId = registered.id;
    account = { id: registered.id, name: registered.name, location: "", verified: false };
  } else if (typeof input.role === "string" && Object.hasOwn(DEMO_ACCOUNTS, input.role)) {
    const demoRole = input.role as DemoRole;
    if (demoRole === "admin") {
      return Response.json({ error: "Administrator sign-in requires administrator credentials." }, { status: 401 });
    }
    if (process.env.NODE_ENV === "production") {
      return Response.json({ error: "Sample demo accounts are available only in local development." }, { status: 403 });
    }
    role = demoRole;
    account = DEMO_ACCOUNTS[demoRole];
    accountId = account.id;
  } else {
    return Response.json({ error: "Provide registered account credentials or choose a local demo account." }, { status: 400 });
  }

  const response = NextResponse.json({ account: { id: account.id, name: account.name, role } });
  response.cookies.set(cookieName, createDemoToken(role, accountId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(cookieName);
  return response;
}
