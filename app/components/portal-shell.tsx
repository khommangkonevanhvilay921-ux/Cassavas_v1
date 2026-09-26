import Link from "next/link";
import {
  ArrowDownRight, ArrowUpRight, Bell, ChartNoAxesCombined, CircleDollarSign,
  ClipboardList, Factory, Handshake, House, MapPin, MessageCircle,
  PackageCheck, Settings, ShieldCheck, Sprout, Users, Wheat, type LucideIcon,
} from "lucide-react";
import { Brand } from "@/app/components/site-header";
import type { DemoRole } from "@/app/lib/demo-types";

const portalNavigation: Record<DemoRole, { label: string; href: string; icon: LucideIcon }[]> = {
  farmer: [
    { label: "Dashboard", href: "/farmer/dashboard", icon: House },
    { label: "My farms", href: "/farmer/farms", icon: Sprout },
    { label: "My harvests", href: "/farmer/harvests", icon: Wheat },
    { label: "Quality check", href: "/farmer/quality-check", icon: ChartNoAxesCombined },
    { label: "Market prices", href: "/farmer/prices", icon: CircleDollarSign },
    { label: "Buyer offers", href: "/farmer/offers", icon: Handshake },
    { label: "Messages", href: "/farmer/messages", icon: MessageCircle },
    { label: "Transactions", href: "/farmer/transactions", icon: ClipboardList },
    { label: "Profile", href: "/farmer/profile", icon: Users },
  ],
  factory: [
    { label: "Dashboard", href: "/factory/dashboard", icon: House },
    { label: "Marketplace", href: "/factory/marketplace", icon: MapPin },
    { label: "Find farms", href: "/factory/marketplace", icon: Sprout },
    { label: "Market prices", href: "/factory/prices", icon: CircleDollarSign },
    { label: "My offers", href: "/factory/offers", icon: Handshake },
    { label: "Procurement", href: "/factory/procurement", icon: PackageCheck },
    { label: "Transactions", href: "/factory/transactions", icon: ClipboardList },
    { label: "Messages", href: "/factory/messages", icon: MessageCircle },
    { label: "Company profile", href: "/factory/profile", icon: Factory },
    { label: "Settings", href: "/factory/settings", icon: Settings },
  ],
  admin: [
    { label: "Price management", href: "/admin/prices", icon: CircleDollarSign },
    { label: "Marketplace", href: "/factory/marketplace", icon: MapPin },
    { label: "Transactions", href: "/factory/transactions", icon: ClipboardList },
    { label: "Audit and review", href: "/admin/audit-logs", icon: ShieldCheck },
  ],
};

export function PortalShell({
  role,
  activeHref,
  children,
}: {
  role: DemoRole;
  activeHref: string;
  children: React.ReactNode;
}) {
  const isFactory = role === "factory";

  return (
    <div className={`portal${isFactory ? " factory" : role === "admin" ? " admin" : ""}`}>
      <aside className="portal-sidebar">
        <div className="portal-logo"><Brand /></div>
        <p className="portal-kicker">{isFactory ? "Factory workspace" : role === "admin" ? "Administration" : "Farmer workspace"}</p>
        <nav className="portal-nav" aria-label={`${role} navigation`}>
          {portalNavigation[role].map(({ label, href, icon: Icon }) => (
            <Link className={href === activeHref ? "active" : ""} href={href} key={label}>
              <Icon size={16} strokeWidth={1.8} />{label}
            </Link>
          ))}
        </nav>
        <div className="portal-user">
          <span className="user-avatar">{isFactory ? "GV" : role === "admin" ? "CA" : "PH"}</span>
          <span><strong>{isFactory ? "Green Valley Starch" : role === "admin" ? "CassavaLink Admin" : "Phonethip S."}</strong><span>{isFactory ? "Factory account" : role === "admin" ? "Administrator" : "Farmer account"}</span></span>
        </div>
      </aside>
      <div className="portal-main">
        <header className="portal-topbar">
          <span className="portal-breadcrumb">CassavaLink / {isFactory ? "Factory" : role === "admin" ? "Admin" : "Farmer"}</span>
          <div className="portal-top-actions"><Bell size={17} /><Link href="/" aria-label="View public homepage"><ArrowUpRight size={16} /></Link></div>
        </header>
        <main className="portal-content">{children}</main>
      </div>
    </div>
  );
}

export function MetricCard({ label, value, note, direction = "up" }: {
  label: string;
  value: string;
  note: string;
  direction?: "up" | "down";
}) {
  const DirectionIcon = direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <article className="metric-card">
      <div className="metric-label"><span>{label}</span><DirectionIcon size={15} /></div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{note}</div>
    </article>
  );
}

export function TrendPanel({ factory = false }: { factory?: boolean }) {
  const heights = factory ? [35, 45, 39, 57, 49, 69, 62, 76, 65, 87, 77, 93] : [46, 52, 43, 61, 55, 68, 58, 74, 67, 79, 73, 89];
  return (
    <section className="panel">
      <div className="panel-head"><h2>{factory ? "Monthly procurement" : "Regional price trend"}</h2><Link href={factory ? "/factory/prices" : "/farmer/prices"}>View details</Link></div>
      <div className="chart-bars" aria-label="Illustrative 12-week trend chart">
        {heights.map((height, index) => <span className="chart-bar" style={{ height: `${height}%` }} key={index} />)}
      </div>
      <div className="chart-labels"><span>Jul 06</span><span>Jul 20</span><span>Aug 03</span><span>Aug 17</span><span>Aug 31</span><span>Sep 14</span></div>
    </section>
  );
}

export function ActivityPanel({ factory = false }: { factory?: boolean }) {
  const activities = factory
    ? [["New listing near Bolikhamxay", "Available harvest · 3 hours ago"], ["Offer accepted by farmer", "Harvest #CL-024 · Yesterday"], ["Pickup scheduled", "Green Valley collection · 24 Sep"]]
    : [["New buyer offer received", "Mekong Roots · 2 hours ago"], ["Harvest listing updated", "Farm Ban Na · Yesterday"], ["Sale completed", "Transaction #CL-018 · 24 Sep"]];
  return (
    <section className="panel">
      <div className="panel-head"><h2>Recent activity</h2><Link href={factory ? "/factory/messages" : "/farmer/offers"}>See all</Link></div>
      <div className="activity-list">
        {activities.map(([title, note]) => <div className="activity-item" key={title}><span className="activity-dot" /><span><strong>{title}</strong><span>{note}</span></span></div>)}
      </div>
    </section>
  );
}

export function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return <Link className="quick-action" href={href}><Icon size={18} />{label}</Link>;
}