import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hashPassword } from "@/app/lib/demo-session";
import { updateDemoState } from "@/app/lib/demo-store";
import { DEMO_OTP_CODE, type KycDocumentType } from "@/app/lib/demo-types";

export const runtime = "nodejs";

const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxFileSize = 2 * 1024 * 1024;
const documentLimits: Record<KycDocumentType, number> = {
  "Family Book": 6,
  "National ID Card": 2,
  Passport: 1,
};

function normalizePhone(value: string) {
  const digits = value.replace(/[\s().-]/g, "");
  return /^\+?[1-9]\d{7,14}$/.test(digits) ? `+${digits.replace(/^\+/, "")}` : null;
}

function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Valid registration details are required." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (input.action === "verify") {
    const accountId = typeof input.accountId === "string" ? input.accountId : "";
    const code = typeof input.code === "string" ? input.code.trim() : "";
    if (!accountId || !code) return NextResponse.json({ error: "Enter the prototype verification code." }, { status: 400 });
    try {
      const status = await updateDemoState((state) => {
        const account = state.accounts.find((item) => item.id === accountId);
        if (!account || account.status !== "Pending Verification") throw new Error("This registration is not awaiting verification.");
        if (code !== account.verificationCode || code !== DEMO_OTP_CODE) throw new Error("That demo verification code is incorrect.");
        account.status = "Pending Admin Approval";
        account.submittedAt = new Date().toISOString();
        account.verificationCode = "";
        return account.status;
      });
      return NextResponse.json({ status });
    } catch (cause) {
      return NextResponse.json({ error: cause instanceof Error ? cause.message : "Verification could not be completed." }, { status: 400 });
    }
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const contactMethod = input.contactMethod;
  const role = input.role;
  const password = input.password;
  const kycDocumentType = input.kycDocumentType;
  if (!name || name.length > 100) return NextResponse.json({ error: "Enter your name (up to 100 characters)." }, { status: 400 });
  if (contactMethod !== "email" && contactMethod !== "phone") return NextResponse.json({ error: "Choose email or phone number." }, { status: 400 });
  const email = contactMethod === "email" && typeof input.email === "string" ? input.email.trim().toLowerCase() : null;
  const phone = contactMethod === "phone" && typeof input.phone === "string" ? normalizePhone(input.phone) : null;
  if (contactMethod === "email" && (!email || !validEmail(email))) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (contactMethod === "phone" && !phone) {
    return NextResponse.json({ error: "Enter a valid international phone number, including its country code." }, { status: 400 });
  }
  if (role !== "farmer" && role !== "factory" && role !== "middleman") {
    return NextResponse.json({ error: "Choose Farmer, Factory, or Middleman. Administrator access is assigned separately." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 256) {
    return NextResponse.json({ error: "Choose a password between 12 and 256 characters." }, { status: 400 });
  }
  if (kycDocumentType !== "Family Book" && kycDocumentType !== "National ID Card" && kycDocumentType !== "Passport") {
    return NextResponse.json({ error: "Choose a KYC document type." }, { status: 400 });
  }
  if (!Array.isArray(input.documents) || input.documents.length > documentLimits[kycDocumentType]) {
    return NextResponse.json({ error: `Upload up to ${documentLimits[kycDocumentType]} ${kycDocumentType} image${documentLimits[kycDocumentType] === 1 ? "" : "s"}.` }, { status: 400 });
  }
  if (kycDocumentType !== "Passport" && input.documents.length === 0) {
    return NextResponse.json({ error: "Upload at least one image of the selected document." }, { status: 400 });
  }

  const documents: { name: string; type: string; size: number; dataUrl: string }[] = [];
  for (const item of input.documents) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return NextResponse.json({ error: "Each KYC upload must be an image file." }, { status: 400 });
    }
    const file = item as Record<string, unknown>;
    const name = typeof file.name === "string" ? file.name.trim().slice(0, 160) : "";
    const type = typeof file.type === "string" ? file.type : "";
    const dataUrl = typeof file.dataUrl === "string" ? file.dataUrl : "";
    if (!name || !imageTypes.includes(type) || !dataUrl.startsWith(`data:${type};base64,`)) {
      return NextResponse.json({ error: "KYC uploads must be JPG, PNG, or WebP images." }, { status: 400 });
    }
    const content = dataUrl.slice(dataUrl.indexOf(",") + 1);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(content)) {
      return NextResponse.json({ error: "An uploaded image is not a valid image file." }, { status: 400 });
    }
    const size = Buffer.from(content, "base64").byteLength;
    if (size < 1 || size > maxFileSize || file.size !== size) {
      return NextResponse.json({ error: `${name} exceeds the 2 MB file-size limit or is invalid.` }, { status: 400 });
    }
    documents.push({ name, type, size, dataUrl });
  }

  const passwordHash = hashPassword(password);
  const accountId = `account-${randomUUID()}`;
  try {
    await updateDemoState((state) => {
      if ((email && state.accounts.some((account) => account.email === email)) ||
          (phone && state.accounts.some((account) => account.phone === phone))) {
        throw new Error(`An account with this ${contactMethod === "email" ? "email address" : "phone number"} already exists.`);
      }
      state.accounts.push({
        id: accountId,
        name,
        email,
        phone,
        contactMethod,
        role,
        passwordHash,
        status: "Pending Verification",
        createdAt: new Date().toISOString(),
        submittedAt: null,
        verificationCode: DEMO_OTP_CODE,
        rejectionReason: null,
        kycDocumentType,
        kycDocuments: documents,
      });
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The registration could not be saved.";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ accountId, status: "Pending Verification" }, { status: 201 });
}
