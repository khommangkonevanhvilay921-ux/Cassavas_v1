"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Handshake, Leaf, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/app/components/site-header";
import { DEMO_OTP_CODE, type DemoRole, type KycDocumentType } from "@/app/lib/demo-types";

type ContactMethod = "email" | "phone";
type KycUpload = { name: string; type: string; size: number; dataUrl: string };
const kycLimits: Record<KycDocumentType, number> = { "Family Book": 6, "National ID Card": 2, Passport: 1 };
const maxKycImageSize = 2 * 1024 * 1024;
const supportedKycTypes = ["image/jpeg", "image/png", "image/webp"];

function isKycDocumentType(value: string): value is KycDocumentType {
  return value === "Family Book" || value === "National ID Card" || value === "Passport";
}

const demoAccounts: { role: "farmer" | "factory" | "middleman"; title: string; person: string; detail: string; icon: typeof Leaf }[] = [
  { role: "farmer", title: "Farmer demo", person: "Phonethip S.", detail: "Bolikhamxay · sample farm owner", icon: Leaf },
  { role: "factory", title: "Factory demo", person: "Green Valley Starch Co.", detail: "Vientiane Province · sample buyer", icon: Building2 },
  { role: "middleman", title: "Middleman demo", person: "Local Middleman Demo", detail: "Vientiane Capital · sample buyer", icon: Handshake },
];

export function DemoLogin({ initialRole = "farmer" }: { initialRole?: DemoRole }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("email");
  const router = useRouter();

  async function signIn(credentials: Record<string, string>, destination: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/demo/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const payload: { error?: string; account?: { role?: DemoRole } } = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not sign in.");
      router.push(destination === "registered" ? `/${payload.account?.role ?? "farmer"}/dashboard` : destination);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  function signInRegistered(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    void signIn({ [contactMethod]: String(values.identifier), password: String(values.password) }, "registered");
  }

  function signInAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    void signIn({ adminSecret: String(values.adminSecret) }, "/admin/dashboard");
  }

  return (
    <>
      <SiteHeader />
      <main className="demo-login container">
        <span className="section-kicker">CassavaLink · secure sign in</span>
        <h1>Sign in to CassavaLink</h1>
        <p>Registered users can sign in after an administrator approves their account.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <section className="panel">
          <h2>Registered account</h2>
          <div className="view-toggle" role="group" aria-label="Sign-in method">
            <button type="button" className={contactMethod === "email" ? "selected" : ""} aria-pressed={contactMethod === "email"} onClick={() => setContactMethod("email")}>Email</button>
            <button type="button" className={contactMethod === "phone" ? "selected" : ""} aria-pressed={contactMethod === "phone"} onClick={() => setContactMethod("phone")}>Phone Number</button>
          </div>
          <form className="form-grid" onSubmit={signInRegistered}>
            <label className="field-span">{contactMethod === "email" ? "Email address" : "Phone number (include country code)"}<input key={contactMethod} name="identifier" type={contactMethod === "email" ? "email" : "tel"} autoComplete={contactMethod === "email" ? "email" : "tel"} pattern={contactMethod === "phone" ? "[+]?[1-9][0-9]{7,14}" : undefined} required /></label>
            <label className="field-span">Password<input name="password" type="password" autoComplete="current-password" required /></label>
            <button className="button button-primary field-span" type="submit" disabled={loading}>Sign in</button>
          </form>
          <p className="muted-copy">New to CassavaLink? <Link href="/register">Create an account</Link></p>
        </section>
        {process.env.NODE_ENV !== "production" && (
          <section className="demo-account-grid" aria-label="Local sample accounts">
            <h2>Local sample workspaces</h2>
            {demoAccounts.map(({ role, title, person, detail, icon: Icon }) => (
              <button className={`demo-account demo-account-${role}`} key={role} onClick={() => void signIn({ role }, `/${role}/dashboard`)} disabled={loading} aria-pressed={initialRole === role}>
                <Icon size={20} />
                <span><strong>{title}</strong><b>{person}</b><small>{detail}</small></span>
                <span className="demo-account-action">Open demo <ArrowRight size={14} /></span>
              </button>
            ))}
            <p className="demo-storage-note">Sample accounts are fictional and available only during local development.</p>
          </section>
        )}
        <section className="panel">
          <div className="record-card-head"><ShieldCheck size={20} /><div><strong>Administrator</strong><span>Restricted access for account and platform management.</span></div></div>
          <form className="inline-form" onSubmit={signInAdmin}>
            <label>Administrator credential<input name="adminSecret" type="password" autoComplete="current-password" required /></label>
            <button className="button button-outline" type="submit" disabled={loading}>Administrator sign in</button>
          </form>
        </section>
      </main>
    </>
  );
}

export function PublicRegister() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [contactMethod, setContactMethod] = useState<ContactMethod>("email");
  const [kycDocumentType, setKycDocumentType] = useState<KycDocumentType>("Family Book");
  const [documents, setDocuments] = useState<KycUpload[]>([]);
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState("");
  const [otp, setOtp] = useState("");
  const [resendNote, setResendNote] = useState("");

  async function addDocuments(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    const remaining = kycLimits[kycDocumentType] - documents.length;
    if (selectedFiles.length > remaining) {
      setError(`${kycDocumentType} supports up to ${kycLimits[kycDocumentType]} image${kycLimits[kycDocumentType] === 1 ? "" : "s"} total. Remove a page or select fewer files.`);
      return;
    }
    try {
      const additions: KycUpload[] = [];
      for (const file of selectedFiles) {
        if (!supportedKycTypes.includes(file.type)) {
          setError(`${file.name} is not supported. Upload a JPG, PNG, or WebP image.`);
          return;
        }
        if (file.size === 0 || file.size > maxKycImageSize) {
          setError(`${file.name} must be no larger than 2 MB.`);
          return;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error(`Could not preview ${file.name}.`));
          reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
          reader.readAsDataURL(file);
        });
        additions.push({ name: file.name, type: file.type, size: file.size, dataUrl });
      }
      setDocuments((current) => [...current, ...additions]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The selected image could not be read.");
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    if (values.password !== values.confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (kycDocumentType !== "Passport" && documents.length === 0) {
      setError("Upload at least one image of the selected KYC document.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/demo/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          contactMethod,
          ...(contactMethod === "email" ? { email: values.email } : { phone: values.phone }),
          password: values.password,
          role: values.role,
          kycDocumentType,
          documents,
        }),
      });
      const payload: { error?: string; accountId?: string; status?: string } = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Registration could not be completed.");
      setAccountId(payload.accountId ?? "");
      setStatus(payload.status ?? "Pending Verification");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/demo/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "verify", accountId, code: otp }),
      });
      const payload: { error?: string; status?: string } = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Verification could not be completed.");
      setStatus(payload.status ?? "Pending Admin Approval");
      setOtp("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verification could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="demo-login container">
        <span className="section-kicker">CassavaLink · account registration</span>
        <h1>Join CassavaLink</h1>
        <p>Create a Farmer, Factory, or Middleman account, complete the simulated verification, and wait for administrator approval.</p>
        {status === "Pending Admin Approval" ? (
          <section className="notice notice-success" role="status">
            <strong>Account status: Pending Admin Approval</strong>
            <p>Your registration and selected KYC document have been submitted. Workspace access remains unavailable until an administrator approves the account.</p>
            <Link className="button button-primary" href="/login">Go to sign in</Link>
          </section>
        ) : status === "Pending Verification" && accountId ? (
          <section className="panel">
            <h2>Simulated OTP verification</h2>
            <p>A verification code would be sent to your registered {contactMethod === "email" ? "email address" : "phone number"}. This prototype does not send real email or SMS messages.</p>
            <p className="notice notice-neutral">Prototype demo code: <strong>{DEMO_OTP_CODE}</strong> · No code has been sent.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <form className="form-grid" onSubmit={verifyRegistration}>
              <label className="field-span">Six-digit verification code<input name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value)} required /></label>
              <button className="button button-primary" type="submit" disabled={loading}>{loading ? "Verifying…" : "Verify"}</button>
              <button className="button button-outline" type="button" onClick={() => setResendNote(`Prototype only: no new message was sent. Use demo code ${DEMO_OTP_CODE}.`)}>Resend Code</button>
            </form>
            {resendNote && <p className="muted-copy" role="status">{resendNote}</p>}
          </section>
        ) : (
          <section className="panel">
            {error && <p className="form-error" role="alert">{error}</p>}
            <form className="form-grid" onSubmit={register}>
              <label className="field-span">Full name or company name<input name="name" autoComplete="name" maxLength={100} required /></label>
              <div className="field-span">
                <span className="field-label">Choose a registration method</span>
                <div className="view-toggle" role="group" aria-label="Registration method">
                  <button type="button" className={contactMethod === "email" ? "selected" : ""} aria-pressed={contactMethod === "email"} onClick={() => setContactMethod("email")}>Email</button>
                  <button type="button" className={contactMethod === "phone" ? "selected" : ""} aria-pressed={contactMethod === "phone"} onClick={() => setContactMethod("phone")}>Phone Number</button>
                </div>
              </div>
              {contactMethod === "email"
                ? <label className="field-span">Email address<input key="email" name="email" type="email" autoComplete="email" maxLength={254} required /></label>
                : <label className="field-span">Phone number (include country code, e.g. +856...)<input key="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" pattern="[+]?[1-9][0-9]{7,14}" required /></label>}
              <label>Requested role<select name="role" defaultValue="farmer"><option value="farmer">Farmer</option><option value="factory">Factory</option><option value="middleman">Middleman</option></select></label>
              <span />
              <label>Password (at least 12 characters)<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
              <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
              <div className="field-span">
                <label>KYC document type<select value={kycDocumentType} onChange={(event) => { if (!isKycDocumentType(event.target.value)) return; setKycDocumentType(event.target.value); setDocuments([]); setError(""); }}>
                  <option value="Family Book">Family Book</option>
                  <option value="National ID Card">National ID Card</option>
                  <option value="Passport">Passport</option>
                </select></label>
                <p className="muted-copy">{kycDocumentType === "Family Book" ? "Upload up to 6 family book pages; one or more pages are accepted." : kycDocumentType === "National ID Card" ? "Upload up to 2 images of the national ID card; one or both sides are accepted." : "Passport upload is optional; upload one passport image if you want to include it."} JPG, PNG, or WebP · 2 MB maximum per image.</p>
                <label className="upload-zone">
                  <b>{kycDocumentType === "Family Book" ? "Choose family book pages" : kycDocumentType === "National ID Card" ? "Choose national ID card images" : "Choose a passport image (optional)"}</b>
                  <span>{documents.length} of {kycLimits[kycDocumentType]} images selected</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple={kycDocumentType !== "Passport"} onChange={(event) => void addDocuments(event)} />
                </label>
                {documents.length > 0 && <div className="preview-grid">{documents.map((document, index) => (
                  <div className="preview-image" key={`${document.name}-${index}`}>
                    <Image src={document.dataUrl} alt={`${kycDocumentType} preview ${index + 1}`} width={240} height={160} unoptimized />
                    <button type="button" aria-label={`Remove ${document.name}`} onClick={() => setDocuments((current) => current.filter((_, currentIndex) => currentIndex !== index))}>Remove</button>
                    <span>{document.name} · {document.size < 1024 ? "<1 KB" : `${(document.size / 1024).toFixed(0)} KB`}</span>
                  </div>
                ))}</div>}
              </div>
              <button className="button button-primary field-span" type="submit" disabled={loading}>{loading ? "Submitting…" : "Submit registration and KYC"}</button>
            </form>
          </section>
        )}
      </main>
    </>
  );
}

export function DemoLogout() {
  const router = useRouter();
  return <button className="plain-action" onClick={async () => { await fetch("/api/demo/session", { method: "DELETE" }); router.push("/login"); }}>Sign out</button>;
}

export function DemoIdentityLabel({ role }: { role: DemoRole }) {
  const demo = demoAccounts.find((item) => item.role === role);
  return <span>{demo?.person ?? "Administrator"}</span>;
}
