"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Leaf, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/app/components/site-header";
import type { DemoRole } from "@/app/lib/demo-types";

const accounts: { role: DemoRole; title: string; person: string; detail: string; icon: typeof Leaf }[] = [
  { role: "farmer", title: "Farmer", person: "Phonethip S.", detail: "Bolikhamxay · sample farm owner", icon: Leaf },
  { role: "factory", title: "Verified factory", person: "Green Valley Starch Co.", detail: "Vientiane Province · verified buyer", icon: Building2 },
  { role: "admin", title: "Administrator", person: "CassavaLink Admin", detail: "Price and platform management", icon: ShieldCheck },
];

export function DemoLogin({ initialRole = "farmer" }: { initialRole?: DemoRole }) {
  const [loading, setLoading] = useState<DemoRole | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function signIn(role: DemoRole) {
    setLoading(role); setError("");
    try {
      const response = await fetch("/api/demo/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not start demo session.");
      router.push(role === "admin" ? "/admin/prices" : `/${role}/dashboard`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start demo session.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="demo-login container">
        <span className="section-kicker">CassavaLink · local demo</span>
        <h1>Choose a demo workspace</h1>
        <p>These sample accounts are fictional. No password or real personal information is used.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="demo-account-grid">
          {accounts.map(({ role, title, person, detail, icon: Icon }) => (
            <button className={`demo-account demo-account-${role}`} key={role} onClick={() => signIn(role)} disabled={loading !== null} aria-pressed={initialRole === role}>
              <Icon size={20} />
              <span><strong>{title}</strong><b>{person}</b><small>{detail}</small></span>
              <span className="demo-account-action">{loading === role ? "Opening..." : "Open workspace"}<ArrowRight size={14} /></span>
            </button>
          ))}
        </div>
        <p className="demo-storage-note">DEMO DATA · Changes are shared between these accounts and saved to this local project.</p>
      </main>
    </>
  );
}

export function PublicRegister() {
  return <DemoLogin />;
}

export function DemoLogout() {
  const router = useRouter();
  return <button className="plain-action" onClick={async () => { await fetch("/api/demo/session", { method: "DELETE" }); router.push("/login"); }}>Switch demo account</button>;
}

export function DemoIdentityLabel({ role }: { role: DemoRole }) {
  return <span>{accounts.find((item) => item.role === role)?.person ?? "Demo account"}</span>;
}
