import { NextResponse } from "next/server";
import { createDemoToken, cookieName } from "@/app/lib/demo-session";
import { DEMO_ACCOUNTS, type DemoRole } from "@/app/lib/demo-types";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("role" in body)) {
    return Response.json({ error: "Choose a demo account." }, { status: 400 });
  }
  const role = (body as { role?: unknown }).role;
  if (typeof role !== "string" || !Object.hasOwn(DEMO_ACCOUNTS, role)) {
    return Response.json({ error: "That demo account is not available." }, { status: 400 });
  }
  const response = NextResponse.json({ account: DEMO_ACCOUNTS[role as DemoRole] });
  response.cookies.set(cookieName, createDemoToken(role as DemoRole), {
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
