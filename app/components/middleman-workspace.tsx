"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CircleDollarSign, Handshake, House, MapPin, MessageCircle, Send, Sprout } from "lucide-react";
import { DemoLogout } from "@/app/components/demo-login";
import { Brand } from "@/app/components/site-header";
import type { DemoFarm, DemoListing, DemoMessage, DemoOffer, DemoPrice, DemoRole } from "@/app/lib/demo-types";
import { getOfficialPrice } from "@/app/lib/pricing";

type Factory = { id: string; name: string; province: string; district: string; verified: boolean; capacityTonnes: number };
type Identity = { role: DemoRole; id: string; name: string; location: string; verified: boolean };
type WorkspaceData = { farms: DemoFarm[]; listings: DemoListing[]; offers: DemoOffer[]; prices: DemoPrice[]; messages: DemoMessage[]; factories: Factory[] };
const emptyData: WorkspaceData = { farms: [], listings: [], offers: [], prices: [], messages: [], factories: [] };
const navigation = [
  ["Dashboard", "/middleman/dashboard", House],
  ["Marketplace", "/middleman/marketplace", MapPin],
  ["My offers", "/middleman/offers", Handshake],
  ["Factories", "/middleman/factories", Building2],
  ["Messages", "/middleman/messages", MessageCircle],
] as const;

export function MiddlemanWorkspace({ section, initialRecipient = "", initialListing = "" }: { section: string[]; initialRecipient?: string; initialListing?: string }) {
  const [data, setData] = useState(emptyData);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const active = section[0] ?? "dashboard";

  async function refresh() {
    const [sessionResponse, dataResponse] = await Promise.all([
      fetch("/api/demo?view=session", { cache: "no-store" }),
      fetch("/api/demo?view=middleman", { cache: "no-store" }),
    ]);
    const session = await sessionResponse.json();
    const payload = await dataResponse.json();
    if (!session.identity || !dataResponse.ok) throw new Error(payload.error ?? "Sign in with an approved Middleman account.");
    setIdentity(session.identity);
    setData({ ...emptyData, ...payload });
  }

  useEffect(() => {
    let activeRequest = true;
    void (async () => {
      try {
        await refresh();
      } catch (cause) {
        if (activeRequest) setError(cause instanceof Error ? cause.message : "Could not load Middleman workspace.");
      } finally {
        if (activeRequest) setLoading(false);
      }
    })();
    return () => { activeRequest = false; };
  }, []);

  async function mutate(action: string, values: Record<string, unknown> = {}) {
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...values }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The request could not be completed.");
      setNotice(action === "create-offer" ? "Purchase request sent at the official factory price. Price negotiation is disabled." : "Message sent.");
      await refresh();
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request could not be completed.");
      return false;
    }
  }

  if (loading) return <div className="portal"><main className="portal-content"><p>Loading Middleman workspace…</p></main></div>;
  if (!identity || identity.role !== "middleman") return <div className="portal"><main className="portal-content"><section className="empty-panel"><h1>Middleman access required</h1><p>{error || "Sign in with an approved Middleman account to continue."}</p><Link className="button button-primary" href="/login">Go to sign in <ArrowRight size={14} /></Link></section></main></div>;

  const offers = data.offers;
  const listings = data.listings;
  const farms = new Map(data.farms.map((farm) => [farm.id, farm]));
  const priceRows = listings.slice(0, 4).map((listing) => {
    const farm = farms.get(listing.farmId);
    return { listing, farm, price: farm ? getOfficialPrice(data.prices, farm.province, farm.district, listing.estimatedGrade) : null };
  });
  const title = ({ dashboard: "Dashboard", marketplace: "Farmer listings", offers: "My offers", factories: "Factory directory", messages: "Messages" } as Record<string, string>)[active] ?? "Middleman workspace";

  return (
    <div className="portal">
      <aside className="portal-sidebar">
        <div className="portal-logo"><Brand /></div>
        <p className="portal-kicker">Middleman workspace</p>
        <nav className="portal-nav" aria-label="Middleman navigation">
          {navigation.map(([label, href, Icon]) => <Link className={href === `/middleman/${active}` ? "active" : ""} href={href} key={href} aria-current={href === `/middleman/${active}` ? "page" : undefined}><Icon size={16} strokeWidth={1.8} />{label}</Link>)}
        </nav>
        <div className="portal-user"><span className="user-avatar">M</span><span><strong>{identity.name}</strong><span>Middleman account</span></span></div>
      </aside>
      <div className="portal-main">
        <header className="portal-topbar"><span className="portal-breadcrumb">CassavaLink / Middleman</span><Link href="/" aria-label="View public homepage"><ArrowRight size={16} /></Link></header>
        <main className="portal-content">
          <div className="workspace-topline"><div className="portal-heading"><div><h1>{title}</h1><p>Connect with farmers and factories; arrange any sale directly outside CassavaLink.</p></div><span className="demo-note">MARKET INFORMATION</span></div><div className="workspace-session"><span>{identity.name}</span><DemoLogout /></div></div>
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          {notice && <div className="notice notice-success" role="status">{notice}</div>}
          <div className="workspace-tools"><span><MessageCircle size={14} /> {data.messages.filter((item) => item.recipientId === identity.id).length} received messages</span><button className="plain-action" onClick={() => void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not refresh workspace."))}>Refresh data</button></div>
          {active === "dashboard" && <section className="panel"><div className="panel-head"><h2>Official factory daily prices</h2><Link href="/middleman/marketplace">View listings</Link></div>{priceRows.map(({ listing, farm, price }) => <div className="activity-item" key={listing.id}><CircleDollarSign size={16} /><span><strong>{farm?.province ?? "Farm location"} · Grade {listing.estimatedGrade}</strong><span>{price ? `${price.pricePerKg.toLocaleString()} LAK/kg · effective ${price.effectiveDate}` : "No official factory price has been published for this grade."}</span></span></div>)}{!priceRows.length && <p className="empty-line">No listing-specific official prices are available yet.</p>}</section>}
          {active === "dashboard" && <section className="workspace-grid two-col">
            <div className="metric-grid"><Link className="metric-card metric-link" href="/middleman/marketplace"><div className="metric-label">Available listings <Sprout size={14} /></div><div className="metric-value">{listings.length}</div><div className="metric-sub">Browse farmer harvests</div></Link><Link className="metric-card metric-link" href="/middleman/offers"><div className="metric-label">My offers <Handshake size={14} /></div><div className="metric-value">{offers.length}</div><div className="metric-sub">Review offer status</div></Link><Link className="metric-card metric-link" href="/middleman/factories"><div className="metric-label">Factories <Building2 size={14} /></div><div className="metric-value">{data.factories.length}</div><div className="metric-sub">View factory information</div></Link></div>
            <section className="panel"><div className="panel-head"><h2>Available farmer listings</h2><Link href="/middleman/marketplace">Browse all</Link></div>{listings.slice(0, 4).map((listing) => <ListingSummary key={listing.id} listing={listing} farm={farms.get(listing.farmId)} />)}{!listings.length && <p className="empty-line">No available listings currently.</p>}</section>
          </section>}
          {active === "marketplace" && <section className="record-grid">{listings.map((listing) => {
            const farm = farms.get(listing.farmId);
            const officialPrice = farm ? getOfficialPrice(data.prices, farm.province, farm.district, listing.estimatedGrade) : null;
            return <article className="record-card" key={listing.id}>
              <div className="record-card-head"><div className="company-mark"><Sprout size={18} /></div><div><strong>{farm?.name ?? "Farmer listing"}</strong><span>{farm?.district}, {farm?.province} · {listing.variety}</span></div></div>
              <div className="detail-rows compact"><Detail label="Available" value={`${listing.availableQuantityKg.toLocaleString()} kg`} /><Detail label="Harvest" value={listing.harvestDate} /><Detail label="Grade" value={`Grade ${listing.estimatedGrade}`} /><Detail label="Farmer reference asking price" value={listing.askingPricePerKg ? `${listing.askingPricePerKg.toLocaleString()} LAK/kg` : "Not provided"} /><Detail label="Official factory buying price" value={officialPrice ? `${officialPrice.pricePerKg.toLocaleString()} LAK/kg · ${officialPrice.effectiveDate}` : "Not published"} /></div>
              <form className="inline-form" onSubmit={(event) => submitPurchaseRequest(event, listing, mutate)}>
                <Field name="quantityKg" label="Requested quantity (kg)" type="number" min="1" max={listing.availableQuantityKg} required />
                <button className="button button-primary" type="submit" disabled={!officialPrice}><Handshake size={14} /> Request at official price</button>
                <Link className="button button-outline" href={`/middleman/messages?farmer=${listing.farmerId}&listing=${listing.id}`}>Contact farmer</Link>
              </form>
              {!officialPrice && <p className="form-error">A purchase request is unavailable until the factory publishes an official price.</p>}
            </article>;
          })}{!listings.length && <section className="empty-panel"><h2>No available listings</h2><p>Check back later for farmer harvest listings.</p></section>}</section>}
          {active === "offers" && <section className="record-grid">{offers.map((offer) => <article className="record-card" key={offer.id}><div className="record-card-head"><div className="company-mark"><Handshake size={18} /></div><div><strong>{farms.get(data.listings.find((listing) => listing.id === offer.listingId)?.farmId ?? "")?.name ?? "Farmer listing"}</strong><span>Official price {offer.pricePerKg.toLocaleString()} LAK/kg · {offer.quantityKg.toLocaleString()} kg</span></div><span className="status-badge status-waiting">{offer.status}</span></div><p className="muted-copy">Purchase requests use the factory&apos;s official price and cannot be negotiated. Contact the farmer directly to coordinate logistics.</p>{(offer.status === "pending" || offer.status === "countered") && <button className="button button-outline" onClick={() => void mutate("respond-offer", { offerId: offer.id, decision: "withdraw" })}>Withdraw request</button>}</article>)}{!offers.length && <section className="empty-panel"><h2>No purchase requests yet</h2><p>Browse listings to request cassava at the official factory price.</p><Link className="button button-primary" href="/middleman/marketplace">Browse listings</Link></section>}</section>}
          {active === "factories" && <section className="record-grid">{data.factories.map((factory) => <article className="record-card" key={factory.id}><div className="record-card-head"><div className="company-mark"><Building2 size={18} /></div><div><strong>{factory.name}</strong><span>{factory.district}, {factory.province} · {factory.capacityTonnes} tonnes/day</span></div><span className={`status-badge ${factory.verified ? "status-good" : "status-waiting"}`}>{factory.verified ? "verified" : "not verified"}</span></div><Link className="button button-outline" href={`/middleman/messages?recipient=${factory.id}`}>Contact factory</Link></article>)}</section>}
          {active === "messages" && <Messages data={data} identity={identity} mutate={mutate} initialRecipient={initialRecipient} initialListing={initialListing} />}
        </main>
      </div>
    </div>
  );
}

function submitPurchaseRequest(event: FormEvent<HTMLFormElement>, listing: DemoListing, mutate: (action: string, values: Record<string, unknown>) => Promise<boolean>) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  void mutate("create-offer", { ...values, listingId: listing.id, transportArrangement: "factory-pickup", transportationCost: 0, expirationDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) });
  event.currentTarget.reset();
}

function Messages({ data, identity, mutate, initialRecipient, initialListing }: { data: WorkspaceData; identity: Identity; mutate: (action: string, values: Record<string, unknown>) => Promise<boolean>; initialRecipient: string; initialListing: string }) {
  const router = useRouter();
  const [preset, setPreset] = useState({ recipientId: initialRecipient, listingId: initialListing });
  const recipients = [
    ...data.factories.map((factory) => ({ id: factory.id, name: factory.name })),
    ...Array.from(new Map(data.farms.map((farm) => [farm.farmerId, { id: farm.farmerId, name: farm.name }])).values()),
  ];
  const own = data.messages.filter((message) => message.senderId === identity.id || message.recipientId === identity.id);
  return <div className="workspace-grid two-col"><section className="panel"><div className="panel-head"><h2>Conversations</h2></div>{own.length ? own.slice(0, 50).map((message) => <article className={`message-row ${message.senderId === identity.id ? "message-own" : ""}`} key={message.id}><b>{message.senderId === identity.id ? "You" : recipients.find((item) => item.id === message.senderId)?.name ?? "CassavaLink participant"}</b><p>{message.content}</p><small>{new Date(message.createdAt).toLocaleString()}</small></article>) : <p className="empty-line">No messages yet. Start a conversation with a farmer or factory.</p>}</section><section className="panel"><div className="panel-head"><h2>Contact a participant</h2></div><form className="form-grid" onSubmit={(event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); void mutate("send-message", values).then((sent) => { if (sent) router.replace("/middleman/messages"); }); }}><label className="field-span">To<select id="middleman-recipient" name="recipientId" required value={preset.recipientId} onChange={(event) => setPreset((current) => ({ ...current, recipientId: event.target.value }))}><option value="">Choose a participant</option>{recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}</select></label><label className="field-span">Related listing<select id="middleman-listing" name="listingId" value={preset.listingId} onChange={(event) => setPreset((current) => ({ ...current, listingId: event.target.value }))}><option value="">General conversation</option>{data.listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.id} · {listing.availableQuantityKg.toLocaleString()} kg</option>)}</select></label><label className="field-span">Message<textarea name="content" rows={5} minLength={2} maxLength={1000} required /></label><button className="button button-primary" type="submit"><Send size={14} /> Send message</button></form></section></div>;
}

function ListingSummary({ listing, farm }: { listing: DemoListing; farm?: DemoFarm }) {
  return <div className="activity-item"><span className="activity-dot" /><span><strong>{farm?.name ?? "Farmer listing"} · {listing.variety}</strong><span>{farm?.district}, {farm?.province} · {listing.availableQuantityKg.toLocaleString()} kg</span></span><Link href="/middleman/marketplace">View</Link></div>;
}

function Field({ name, label, type = "text", ...props }: { name: string; label: string; type?: string; min?: string | number; max?: string | number; required?: boolean }) {
  return <label>{label}<input name={name} type={type} min={props.min} max={props.max} required={props.required} /></label>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="detail-row"><span>{label}</span><b>{value}</b></div>;
}
