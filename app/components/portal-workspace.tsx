"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Bell, Building2, Camera,
  Check, CircleDollarSign, FilePlus2, Filter, Leaf, MapPin,
  MessageCircle, Plus, RefreshCw, Search, Send, Sprout, Trash2,
  Wheat, X,
} from "lucide-react";
import { MetricCard, PortalShell } from "@/app/components/portal-shell";
import { DemoLogout } from "@/app/components/demo-login";
import { calculatePrice, formatLak, getOfficialPrice } from "@/app/lib/pricing";
import { DEMO_ACCOUNTS, type DemoAccount, type DemoRole, type DemoState } from "@/app/lib/demo-types";


type PublicAccount = Omit<DemoAccount, "passwordHash" | "verificationCode">;
type PortalData = Omit<DemoState, "factoryProfiles" | "schemaVersion" | "accounts"> & {
  factories: { id: string; name: string; province: string; district: string; verified: boolean; capacityTonnes: number }[];
  accounts: PublicAccount[];
};
type Identity = { role: DemoRole; id: string; name: string; location: string; verified: boolean };
type Props = { role: "farmer" | "factory" | "admin"; section: string[] };
type ApiResult<T> = { data?: T; error?: string };

const emptyData: PortalData = { farms: [], assessments: [], listings: [], offers: [], accounts: [], prices: [], notifications: [], messages: [], factories: [] };

export function PortalWorkspace({ role, section }: Props) {
  const [data, setData] = useState<PortalData>(emptyData);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [activeListingId, setActiveListingId] = useState("");
  const [activeAssessmentId, setActiveAssessmentId] = useState("");
  const [imageFiles, setImageFiles] = useState<{ name: string; preview: string }[]>([]);
  const [calculatorQuantity, setCalculatorQuantity] = useState("10000");
  const routeKey = section.join("/");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const sessionResponse = await fetch("/api/demo?view=session", { cache: "no-store" });
        const sessionPayload = await sessionResponse.json();
        if (!alive) return;
        setIdentity(sessionPayload.identity ?? null);
        if (!sessionPayload.identity) { setData(emptyData); return; }
        const view = role === "admin" ? "admin" : role;
        const response = await fetch(`/api/demo?view=${view}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Could not load this workspace.");
        if (alive) setData({ ...emptyData, ...payload });
      } catch (cause) {
        if (alive) setLoadError(cause instanceof Error ? cause.message : "Could not load this workspace.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [role, refreshIndex]);

  async function mutate(action: string, values: Record<string, unknown> = {}) {
    setNotice(null);
    try {
      const { action: operation, ...payloadValues } = values;
      const response = await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...payloadValues, ...(operation ? { operation } : {}) }) });
      const payload = await response.json() as ApiResult<unknown>;
      if (!response.ok) throw new Error(payload.error ?? "The change could not be saved.");
      setNotice({ kind: "success", text: successMessage(action) });
      setRefreshIndex((current) => current + 1);
      return payload.data;
    } catch (cause) {
      setNotice({ kind: "error", text: cause instanceof Error ? cause.message : "The change could not be saved." });
      return null;
    }
  }

  async function submit(action: string, event: FormEvent<HTMLFormElement>, extras: Record<string, unknown> = {}) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const saved = await mutate(action, { ...values, ...extras });
    if (saved) form.reset();
  }

  const title = titleFor(routeKey);
  const isCorrectRole = identity?.role === role || identity?.role === "admin";

  if (loading) return <PortalShell role={role} activeHref=""><WorkspaceNotice title="Loading your shared demo data" detail="Connecting to the local CassavaLink store…" /></PortalShell>;
  if (!identity || !isCorrectRole) return <PortalShell role={role} activeHref=""><WorkspaceNotice title={identity ? "This account cannot open that workspace" : "Sign in to your demo workspace"} detail={identity ? `You are signed in as ${identity.role}. Switch demo account to continue.` : "Choose a farmer, verified factory, or administrator demo account. All role changes are checked on the server."} action={<Link className="button button-primary" href="/login">Choose demo account <ArrowRight size={14} /></Link>} /></PortalShell>;
  if (loadError) return <PortalShell role={role} activeHref=""><WorkspaceNotice title="Could not load workspace" detail={loadError} action={<button className="button button-primary" onClick={() => setRefreshIndex((value) => value + 1)}><RefreshCw size={14} /> Retry</button>} /></PortalShell>;

  const navRole = role;
  const activeHref = `/${navRole}/${section[0] ?? "dashboard"}`;
  const dashboardHref = role === "admin" ? "/admin/prices" : `/${role}/dashboard`;

  return (
    <PortalShell role={navRole} activeHref={activeHref}>
      <div className="workspace-topline">
        <div className="portal-heading"><div><h1>{title}</h1><p>{descriptionFor(role, routeKey)}</p></div><span className="demo-note">DEMO DATA · LOCAL WORKSPACE</span></div>
        <div className="workspace-session"><span>{identity.name}</span><DemoLogout /></div>
      </div>
      {notice && <div className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.text}</span><button aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={15} /></button></div>}
      <div className="workspace-tools"><span><Bell size={14} /> {data.notifications.filter((item) => !item.readAt).length} unread alerts</span><button className="plain-action" onClick={() => setRefreshIndex((current) => current + 1)}><RefreshCw size={13} /> Refresh data</button></div>
      {role === "farmer" && renderFarmer({ section, routeKey, data, identity, mutate, submit, search, setSearch, provinceFilter, setProvinceFilter, gradeFilter, setGradeFilter, statusFilter, setStatusFilter, activeAssessmentId, setActiveAssessmentId, imageFiles, setImageFiles, calculatorQuantity, setCalculatorQuantity })}
      {role === "factory" && renderFactory({ section, routeKey, data, identity, mutate, submit, search, setSearch, provinceFilter, setProvinceFilter, gradeFilter, setGradeFilter, statusFilter, setStatusFilter, viewMode, setViewMode, activeListingId, setActiveListingId, calculatorQuantity, setCalculatorQuantity })}
      {role === "admin" && renderAdmin({ section, data, submit, mutate, search, setSearch })}
      {role === "factory" && routeKey === "offers" && <PendingOfferEditor data={data} mutate={mutate} />}
      {role === "admin" && routeKey === "prices" && <AdminPriceEditor data={data} submit={submit} />}
      {role !== "admin" && <p className="workspace-bottom-note"><Link href={dashboardHref}><ArrowLeft size={13} /> Back to dashboard</Link><span>All sample prices and records are fictional demo data.</span></p>}
    </PortalShell>
  );
}

function renderFarmer(p: {
  section: string[]; routeKey: string; data: PortalData; identity: Identity;
  mutate: (action: string, values?: Record<string, unknown>) => Promise<unknown>;
  submit: (action: string, event: FormEvent<HTMLFormElement>, extras?: Record<string, unknown>) => void;
  search: string; setSearch: (value: string) => void; provinceFilter: string; setProvinceFilter: (value: string) => void; gradeFilter: string; setGradeFilter: (value: string) => void;
  statusFilter: string; setStatusFilter: (value: string) => void; activeAssessmentId: string; setActiveAssessmentId: (value: string) => void;
  imageFiles: { name: string; preview: string }[]; setImageFiles: (value: { name: string; preview: string }[]) => void;
  calculatorQuantity: string; setCalculatorQuantity: (value: string) => void;
}) {
  const { section, routeKey, data, identity, mutate, submit } = p;
  const farms = data.farms;
  const listings = data.listings;
  const offers = data.offers;
  if (routeKey === "dashboard" || routeKey === "") {
    const available = listings.reduce((sum, item) => sum + item.availableQuantityKg, 0);
    const area = farms.reduce((sum, item) => sum + item.areaHectares, 0);
    const estimated = farms.reduce((sum, item) => sum + item.estimatedProductionKg, 0);
    const latestPrice = getOfficialPrice(data.prices, "Bolikhamxay", "", "B");
    const metrics = [
      ["Registered farms", farms.length, "/farmer/farms"], ["Cultivated area", `${area.toFixed(1)} ha`, "/farmer/farms"],
      ["Estimated harvest", `${estimated.toLocaleString()} kg`, "/farmer/harvests"], ["Available quantity", `${available.toLocaleString()} kg`, "/farmer/harvests"],
      ["Active buyer offers", offers.filter((offer) => offer.status === "pending" || offer.status === "countered").length, "/farmer/offers"],
    ] as const;
    return <>
      <div className="metric-grid metric-grid-expanded">{metrics.map(([label, value, href]) => <Link className="metric-card metric-link" href={href} key={label}><div className="metric-label">{label}<ArrowRight size={14} /></div><div className="metric-value">{value}</div><div className="metric-sub">View details</div></Link>)}</div>
      <div className="dashboard-price-callout"><span><CircleDollarSign size={18} /><b>Official factory daily price · Bolikhamxay · Grade B</b></span><strong>{latestPrice ? `${latestPrice.pricePerKg.toLocaleString()} LAK/kg` : "Not published"} <small>DEMO DATA</small></strong><Link href="/farmer/prices">View official and regional prices <ArrowRight size={14} /></Link></div>
      <div className="workspace-grid two-col"><section className="panel"><PanelTitle title="Price history · Bolikhamxay grade B" href="/farmer/prices" linkText="Open prices" /><PriceChart prices={data.prices.filter((item) => item.province === "Bolikhamxay" && item.grade === "B")} /></section><section className="panel"><PanelTitle title="Recent buyer offers" href="/farmer/offers" linkText="All offers" />{offers.slice(0, 3).map((offer) => <OfferSummary key={offer.id} offer={offer} data={data} />)}{offers.length === 0 && <EmptyLine text="No offers yet. Publish a harvest listing to invite buyers." />}</section></div>
      <div className="workspace-grid two-col"><section className="panel"><PanelTitle title="Alerts and notifications" href="/farmer/notifications" linkText="View alerts" />{data.notifications.slice(0, 4).map((notification) => <NotificationRow key={notification.id} item={notification} mutate={mutate} />)}</section><section className="panel"><PanelTitle title="Accepted buyer offers" href="/farmer/offers" linkText="Review offers" />{offers.filter((offer) => offer.status === "accepted").slice(0, 3).map((offer) => <OfferSummary key={offer.id} offer={offer} data={data} />)}{offers.every((offer) => offer.status !== "accepted") && <EmptyLine text="Accepted offers are a starting point for direct contact; sales are arranged outside CassavaLink." />}</section></div>
      <div className="workspace-actions"><Link className="button button-primary" href="/farmer/farms/new"><Plus size={15} /> Register farm</Link><Link className="button button-outline" href="/farmer/harvests/new"><Wheat size={15} /> Add harvest</Link><Link className="button button-outline" href="/farmer/quality-check"><Camera size={15} /> Check quality</Link></div>
    </>;
  }
  if (section[0] === "farms") {
    const selected = section.length > 1 && section[1] !== "new" ? farms.find((farm) => farm.id === section[1]) : undefined;
    const editing = section[1] === "new" || section[2] === "edit";
    if (editing) {
      const farm = section[2] === "edit" ? selected : undefined;
      return <div className="workspace-grid two-col"><section className="panel"><PanelTitle title={farm ? "Edit farm details" : "Register a farm"} /><form className="form-grid" onSubmit={(event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); void mutate(farm ? "update-farm" : "create-farm", { ...values, id: farm?.id }); }}>
        <Field name="name" label="Farm name" required defaultValue={farm?.name} /><Field name="variety" label="Cassava variety" required defaultValue={farm?.variety} /><Field name="areaHectares" label="Farm area (hectares)" type="number" step="0.1" required defaultValue={farm?.areaHectares} /><Field name="estimatedProductionKg" label="Estimated production (kg)" type="number" step="1" required defaultValue={farm?.estimatedProductionKg} /><Field name="expectedHarvestDate" label="Expected harvest date" type="date" defaultValue={farm?.expectedHarvestDate} /><Field name="province" label="Province" required defaultValue={farm?.province ?? "Bolikhamxay"} /><Field name="district" label="District" required defaultValue={farm?.district} /><Field name="village" label="Village" defaultValue={farm?.village} /><label className="field-span">Photos <input name="photosText" placeholder="Optional photo URL" defaultValue={farm?.photos?.[0]} /></label><div className="form-actions field-span"><button className="button button-primary" type="submit">{farm ? "Save farm" : "Register farm"}</button><Link className="button button-outline" href="/farmer/farms">Cancel</Link></div>
      </form></section><section className="panel"><h2>Farm location and privacy</h2><p className="muted-copy">Choose province, district, and village. Precise coordinates are not shown to buyers in this prototype.</p><div className="map-placeholder"><MapPin size={24} /><b>Laos farm location</b><span>Approximate area only · exact coordinates private</span></div><h3>Before you submit</h3><ul className="simple-list"><li>Keep production estimates current.</li><li>Photos are optional; you can add harvest photos separately.</li><li>Expected harvest dates help factories plan pickup.</li></ul></section></div>;
    }
    if (selected) return <div className="workspace-grid two-col"><section className="panel"><PanelTitle title={selected.name} /><div className="detail-rows"><Detail label="Location" value={`${selected.village}, ${selected.district}, ${selected.province}`} /><Detail label="Variety" value={selected.variety} /><Detail label="Farm area" value={`${selected.areaHectares} hectares`} /><Detail label="Estimated production" value={`${selected.estimatedProductionKg.toLocaleString()} kg`} /><Detail label="Expected harvest" value={dateLabel(selected.expectedHarvestDate)} /><Detail label="Farm status" value={selected.status} /></div><div className="workspace-actions"><Link className="button button-outline" href={`/farmer/farms/${selected.id}/edit`}>Edit farm</Link><Link className="button button-primary" href={`/farmer/harvests/new?farm=${selected.id}`}>Add harvest</Link><button className="button button-outline" onClick={() => void mutate("update-farm", { id: selected.id, status: selected.status === "active" ? "inactive" : "active" })}>{selected.status === "active" ? "Deactivate" : "Reactivate"}</button></div></section><section className="panel"><PanelTitle title="Farm photos" /><PhotoGallery photos={selected.photos} /><PanelTitle title="Harvests from this farm" />{listings.filter((listing) => listing.farmId === selected.id).map((listing) => <ListingSummary key={listing.id} listing={listing} farm={selected} />)}</section></div>;
    const filtered = farms.filter((farm) => `${farm.name} ${farm.province} ${farm.district} ${farm.variety}`.toLowerCase().includes(p.search.toLowerCase()));
    return <><Toolbar search={p.search} setSearch={p.setSearch} placeholder="Search farm, location, variety" /><div className="record-grid">{filtered.map((farm) => <FarmCard key={farm.id} farm={farm} listings={listings} assessments={data.assessments} mutate={mutate} />)}{filtered.length === 0 && <EmptyPanel title="No matching farms" detail="Change your search or register your first farm." action={<Link className="button button-primary" href="/farmer/farms/new"><Plus size={14} /> Register farm</Link>} />}</div></>;
  }
  if (section[0] === "harvests") {
    const creating = section.length > 1;
    if (creating) return <div className="workspace-grid two-col"><section className="panel"><PanelTitle title="Create harvest listing" /><form className="form-grid" onSubmit={(event) => submit("create-listing", event)}><label className="field-span">Farm<select name="farmId" required defaultValue=""><option value="" disabled>Select one of your farms</option>{farms.filter((farm) => farm.status === "active").map((farm) => <option value={farm.id} key={farm.id}>{farm.name} · {farm.district}</option>)}</select></label><Field name="quantityKg" label="Available quantity (kg)" type="number" min="1" required /><Field name="harvestDate" label="Expected harvest date" type="date" /><Field name="askingPricePerKg" label="Asking price (LAK/kg, optional)" type="number" min="1" /><Field name="expirationDate" label="Listing expires" type="date" /><label>Estimated grade<select name="grade"><option>A</option><option selected>B</option><option>C</option></select></label><label>Pickup preference<select name="pickupPreference"><option value="pickup">Factory pickup</option><option value="delivery">Farmer delivery</option><option value="either">Either</option></select></label><label className="check-field field-span"><input type="checkbox" name="publish" value="true" defaultChecked /> Publish listing immediately</label><div className="form-actions field-span"><button className="button button-primary" type="submit"><Wheat size={14} /> Save harvest listing</button><Link className="button button-outline" href="/farmer/harvests">Cancel</Link></div></form></section><section className="panel"><h2>Listing availability</h2><p className="muted-copy">Available quantities are reserved when you accept an offer. A listing can remain open for partial sales.</p><div className="notice notice-neutral">A harvest above your farm’s production estimate requires an explicit confirmation.</div><Link className="back-link" href="/farmer/farms/new"><Sprout size={14} /> Register a farm first</Link></section></div>;
    const filtered = listings.filter((listing) => { const farm = farms.find((item) => item.id === listing.farmId); return `${farm?.name ?? ""} ${listing.variety} ${listing.status}`.toLowerCase().includes(p.search.toLowerCase()) && (p.statusFilter === "all" || listing.status === p.statusFilter); });
    return <><Toolbar search={p.search} setSearch={p.setSearch} placeholder="Search harvests and varieties"><SelectFilter value={p.statusFilter} setValue={p.setStatusFilter} options={[["all", "All status"], ["available", "Available"], ["paused", "Paused"], ["sold", "Sold"], ["cancelled", "Cancelled"]]} /></Toolbar><div className="panel table-panel"><table><thead><tr><th>Harvest / farm</th><th>Available</th><th>Grade</th><th>Asking price</th><th>Harvest date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map((listing) => <tr key={listing.id}><td><b>{farms.find((farm) => farm.id === listing.farmId)?.name}</b><small>{listing.variety} · listed {dateLabel(listing.createdAt)}</small></td><td>{listing.availableQuantityKg.toLocaleString()} / {listing.totalQuantityKg.toLocaleString()} kg</td><td><Grade value={listing.estimatedGrade} /></td><td>{listing.askingPricePerKg ? `${listing.askingPricePerKg.toLocaleString()} LAK/kg` : "Not set"}</td><td>{dateLabel(listing.harvestDate)}</td><td><Status value={listing.status} /></td><td><button className="plain-action" onClick={() => void mutate("update-listing", { id: listing.id, status: listing.status === "available" ? "paused" : "available" })}>{listing.status === "available" ? "Pause" : "Publish"}</button><button className="plain-action danger-text" onClick={() => window.confirm("Cancel this listing? Offers will no longer be accepted.") && void mutate("update-listing", { id: listing.id, status: "cancelled" })}>Cancel</button></td></tr>)}</tbody></table>{filtered.length === 0 && <EmptyLine text="No harvest listings match those filters." />}</div><div className="workspace-actions"><Link className="button button-primary" href="/farmer/harvests/new"><Plus size={14} /> Add a harvest</Link><Link className="button button-outline" href="/farmer/farms/new">Register farm</Link></div></>;
  }
  if (section[0] === "quality-check") return <QualityCheck data={data} imageFiles={p.imageFiles} setImageFiles={p.setImageFiles} activeAssessmentId={p.activeAssessmentId} setActiveAssessmentId={p.setActiveAssessmentId} mutate={mutate} />;
  if (section[0] === "prices") return <PriceWorkspace data={data} calculatorQuantity={p.calculatorQuantity} setCalculatorQuantity={p.setCalculatorQuantity} search={p.search} setSearch={p.setSearch} provinceFilter={p.provinceFilter} setProvinceFilter={p.setProvinceFilter} gradeFilter={p.gradeFilter} setGradeFilter={p.setGradeFilter} role="farmer" />;
  if (section[0] === "offers") {
    const visibleOffers = offers.filter((offer) => { const factory = data.factories.find((item) => item.id === offer.factoryId); const listing = listings.find((item) => item.id === offer.listingId); return `${factory?.name ?? ""} ${listing?.id ?? ""} ${offer.status}`.toLowerCase().includes(p.search.toLowerCase()) && (p.statusFilter === "all" || offer.status === p.statusFilter); });
    return <><Toolbar search={p.search} setSearch={p.setSearch} placeholder="Search factory, listing, status"><SelectFilter value={p.statusFilter} setValue={p.setStatusFilter} options={[["all", "All offers"], ["pending", "Pending"], ["countered", "Countered"], ["accepted", "Accepted"], ["rejected", "Rejected"], ["expired", "Expired"]]} /></Toolbar><div className="record-grid">{visibleOffers.map((offer) => <OfferCard key={offer.id} offer={offer} data={data} mutate={mutate} farmer />)}{visibleOffers.length === 0 && <EmptyPanel title="No matching offers" detail="New factory offers appear here when buyers respond to available listings." action={<Link className="button button-outline" href="/farmer/harvests">Manage harvests</Link>} />}</div></>;
  }
  if (section[0] === "messages") return <Messages data={data} identity={identity} mutate={mutate} role="farmer" />;
  if (section[0] === "notifications") return <section className="panel"><PanelTitle title="Notifications and alerts" />{data.notifications.map((item) => <NotificationRow key={item.id} item={item} mutate={mutate} />)}</section>;
  if (section[0] === "profile") return <section className="panel"><PanelTitle title="Farmer profile" /><div className="detail-rows"><Detail label="Demo account" value={identity.name} /><Detail label="Region" value={identity.location} /><Detail label="Account type" value="Farmer · local demo profile" /><Detail label="Farm count" value={String(farms.length)} /></div><p className="muted-copy">Profile authentication is a signed local demo session. No password or personal data is collected.</p><DemoLogout /></section>;
  return <NotFoundWorkspace role="farmer" />;
}

function renderFactory(p: {
  section: string[]; routeKey: string; data: PortalData; identity: Identity;
  mutate: (action: string, values?: Record<string, unknown>) => Promise<unknown>; submit: (action: string, event: FormEvent<HTMLFormElement>, extras?: Record<string, unknown>) => void;
  search: string; setSearch: (value: string) => void; provinceFilter: string; setProvinceFilter: (value: string) => void; gradeFilter: string; setGradeFilter: (value: string) => void;
  statusFilter: string; setStatusFilter: (value: string) => void; viewMode: "list" | "map"; setViewMode: (value: "list" | "map") => void;
  activeListingId: string; setActiveListingId: (value: string) => void; calculatorQuantity: string; setCalculatorQuantity: (value: string) => void;
}) {
  const { section, routeKey, data, identity, mutate, submit } = p;
  const listings = data.listings; const offers = data.offers;
  if (routeKey === "dashboard" || routeKey === "") {
    const active = offers.filter((offer) => offer.status === "pending" || offer.status === "countered");
    const accepted = offers.filter((offer) => offer.status === "accepted");
    const metrics = [["Active offers", active.length, "/factory/offers"], ["Accepted offers", accepted.length, "/factory/offers"], ["Available harvests", listings.filter((listing) => listing.status === "available").length, "/factory/marketplace"], ["Nearby regions", new Set(listings.map((listing) => data.farms.find((farm) => farm.id === listing.farmId)?.province)).size, "/factory/marketplace"]] as const;
    return <><div className="metric-grid metric-grid-expanded">{metrics.map(([label, value, href]) => <Link className="metric-card metric-link" href={href} key={label}><div className="metric-label">{label}<ArrowRight size={14} /></div><div className="metric-value">{value}</div><div className="metric-sub">View details</div></Link>)}</div><div className="workspace-grid two-col"><section className="panel"><PanelTitle title="Regional reference prices · sample" href="/factory/prices" linkText="View prices" /><PriceChart prices={data.prices.filter((item) => item.province === "Bolikhamxay" && item.grade === "B")} /></section><section className="panel"><PanelTitle title="Recent farmer listings" href="/factory/marketplace" linkText="Find farms" />{listings.filter((listing) => listing.status === "available").slice(0, 4).map((listing) => <ListingSummary key={listing.id} listing={listing} farm={data.farms.find((farm) => farm.id === listing.farmId)} />)}</section></div><div className="workspace-grid two-col"><section className="panel"><PanelTitle title="Recent offers" href="/factory/offers" linkText="All offers" />{offers.slice(0, 3).map((offer) => <OfferSummary key={offer.id} offer={offer} data={data} />)}{offers.length === 0 && <EmptyLine text="Browse available listings to contact farmers and make an offer." />}</section><section className="panel"><PanelTitle title="Accepted offers" href="/factory/offers" linkText="Review offers" />{accepted.slice(0, 3).map((offer) => <OfferSummary key={offer.id} offer={offer} data={data} />)}{accepted.length === 0 && <EmptyLine text="Coordinate directly with farmers after an offer is accepted." />}</section></div><div className="workspace-actions"><Link className="button button-factory" href="/factory/marketplace"><Search size={15} /> Find farms</Link><Link className="button button-outline" href="/factory/offers">Manage offers</Link></div></>;
  }
  if (section[0] === "marketplace") {
    const detailId = section[1] && section[1] !== "new" ? section[1] : "";
    const detail = detailId ? listings.find((listing) => listing.id === detailId) : undefined;
    const selectedFarm = detail ? data.farms.find((farm) => farm.id === detail.farmId) : undefined;
    if (detail && selectedFarm) return <ListingDetail listing={detail} farm={selectedFarm} data={data} mutate={mutate} activeListingId={p.activeListingId} setActiveListingId={p.setActiveListingId} submit={submit} />;
    const filtered = listings.filter((listing) => {
      const farm = data.farms.find((item) => item.id === listing.farmId);
      return listing.status === "available" && listing.availableQuantityKg > 0 && `${farm?.name ?? ""} ${farm?.province ?? ""} ${farm?.district ?? ""} ${farm?.village ?? ""} ${listing.variety}`.toLowerCase().includes(p.search.toLowerCase()) && (p.provinceFilter === "all" || farm?.province === p.provinceFilter) && (p.gradeFilter === "all" || listing.estimatedGrade === p.gradeFilter);
    });
    return <><Toolbar search={p.search} setSearch={p.setSearch} placeholder="Farm, village, province, variety"><SelectFilter value={p.provinceFilter} setValue={p.setProvinceFilter} options={[["all", "All provinces"], ...Array.from(new Set(data.farms.map((farm) => farm.province))).map((province) => [province, province] as [string, string])]} /><SelectFilter value={p.gradeFilter} setValue={p.setGradeFilter} options={[["all", "All grades"], ["A", "Grade A"], ["B", "Grade B"], ["C", "Grade C"]]} /><div className="view-toggle"><button className={p.viewMode === "list" ? "selected" : ""} onClick={() => p.setViewMode("list")}>List</button><button className={p.viewMode === "map" ? "selected" : ""} onClick={() => p.setViewMode("map")}>Map</button></div></Toolbar><p className="muted-copy">{filtered.length} available harvests · farm locations are approximate; precise coordinates are private.</p>{p.viewMode === "map" && <div className="map-placeholder map-wide"><MapPin size={23} /><b>Approximate listing locations</b><span>OpenStreetMap map integration is not configured in this local demo. Listings remain searchable below.</span></div>}<div className="record-grid">{filtered.map((listing) => <ListingCard key={listing.id} listing={listing} farm={data.farms.find((item) => item.id === listing.farmId)} assessment={data.assessments.find((item) => item.id === listing.assessmentId)} />)}{filtered.length === 0 && <EmptyPanel title="No harvests match these filters" detail="Try another province, variety, or quality grade." />}</div></>;
  }
  if (section[0] === "prices") return <PriceWorkspace data={data} calculatorQuantity={p.calculatorQuantity} setCalculatorQuantity={p.setCalculatorQuantity} search={p.search} setSearch={p.setSearch} provinceFilter={p.provinceFilter} setProvinceFilter={p.setProvinceFilter} gradeFilter={p.gradeFilter} setGradeFilter={p.setGradeFilter} role="factory" submit={submit} factoryId={identity.id} />;
  if (section[0] === "offers" && section[1] === "new" && section[2]) {
    const listing = listings.find((item) => item.id === section[2]);
    const farm = listing ? data.farms.find((item) => item.id === listing.farmId) : undefined;
    if (listing && farm) return <ListingDetail listing={listing} farm={farm} data={data} mutate={mutate} activeListingId={listing.id} setActiveListingId={p.setActiveListingId} submit={submit} />;
  }
  if (section[0] === "offers") {
    const filtered = offers.filter((offer) => `${offer.id} ${offer.status}`.toLowerCase().includes(p.search.toLowerCase()) && (p.statusFilter === "all" || offer.status === p.statusFilter));
    return <><Toolbar search={p.search} setSearch={p.setSearch} placeholder="Search offer ID"><SelectFilter value={p.statusFilter} setValue={p.setStatusFilter} options={[["all", "All offers"], ["pending", "Pending"], ["countered", "Countered"], ["accepted", "Accepted"], ["rejected", "Rejected"], ["expired", "Expired"], ["withdrawn", "Withdrawn"]]} /></Toolbar><div className="record-grid">{filtered.map((offer) => <OfferCard key={offer.id} offer={offer} data={data} mutate={mutate} />)}{filtered.length === 0 && <EmptyPanel title="No offers in this view" detail="Browse available harvests and submit a purchase offer." action={<Link className="button button-factory" href="/factory/marketplace">Find farms</Link>} />}</div></>;
  }
  if (section[0] === "messages") return <Messages data={data} identity={identity} mutate={mutate} role="factory" />;
  if (section[0] === "profile" || section[0] === "settings") return <FactoryProfile data={data} identity={identity} submit={submit} />;
  return <NotFoundWorkspace role="factory" />;
}

function renderAdmin(p: { section: string[]; data: PortalData; submit: (action: string, event: FormEvent<HTMLFormElement>, extras?: Record<string, unknown>) => void; mutate: (action: string, values?: Record<string, unknown>) => Promise<unknown>; search: string; setSearch: (value: string) => void }) {
  const route = p.section[0] ?? "prices";
  if (route === "dashboard") return <>
    <div className="metric-grid">
      {[
        ["Pending verification", p.data.accounts.filter((account) => account.status === "Pending Verification").length, "/admin/registrations"],
        ["Pending admin approval", p.data.accounts.filter((account) => account.status === "Pending Admin Approval").length, "/admin/registrations"],
        ["Factories to review", p.data.factories.filter((factory) => !factory.verified).length, "/admin/factories"],
        ["Active listings", p.data.listings.filter((listing) => listing.status === "available").length, "/admin/marketplace"],
      ].map(([label, value, href]) => <Link className="metric-card metric-link" href={String(href)} key={String(label)}><div className="metric-label">{label}<ArrowRight size={14} /></div><div className="metric-value">{value}</div><div className="metric-sub">Open workspace</div></Link>)}
    </div>
    <div className="workspace-actions"><Link className="button button-primary" href="/admin/registrations">Review account registrations</Link><Link className="button button-outline" href="/admin/prices">Manage reference prices</Link><Link className="button button-outline" href="/admin/factories">Review factories</Link><Link className="button button-outline" href="/admin/audit-logs">Offer audit history</Link></div>
  </>;
  if (route === "marketplace") {
    const listings = p.data.listings.filter((listing) => {
      const farm = p.data.farms.find((item) => item.id === listing.farmId);
      return `${listing.id} ${farm?.name ?? ""} ${farm?.province ?? ""} ${farm?.district ?? ""} ${listing.variety} ${listing.status}`.toLowerCase().includes(p.search.toLowerCase());
    });
    return <><Toolbar search={p.search} setSearch={p.setSearch} placeholder="Listing, farm, location, status" /><div className="panel table-panel"><table><thead><tr><th>Listing / farm</th><th>Location</th><th>Variety / grade</th><th>Available</th><th>Harvest date</th><th>Status</th></tr></thead><tbody>{listings.map((listing) => { const farm = p.data.farms.find((item) => item.id === listing.farmId); return <tr key={listing.id}><td><b>{listing.id}</b><small>{farm?.name ?? "Unknown farm"}</small></td><td>{farm ? `${farm.district}, ${farm.province}` : "Unknown location"}</td><td>{listing.variety} · Grade {listing.estimatedGrade}</td><td>{listing.availableQuantityKg.toLocaleString()} / {listing.totalQuantityKg.toLocaleString()} kg</td><td>{dateLabel(listing.harvestDate)}</td><td><Status value={listing.status} /></td></tr>; })}</tbody></table>{listings.length === 0 && <EmptyLine text="No listings match this search." />}</div></>;
  }
  if (route === "registrations") {
    const accounts = p.data.accounts.filter((account) => `${account.name} ${account.email ?? ""} ${account.phone ?? ""} ${account.role} ${account.status}`.toLowerCase().includes(p.search.toLowerCase()));
    return <>
      <Toolbar search={p.search} setSearch={p.setSearch} placeholder="Name, email, phone, role, status" />
      <div className="panel table-panel"><table><thead><tr><th>Applicant</th><th>Email / phone</th><th>Role</th><th>Registered / submitted</th><th>Verification</th><th>Admin status</th><th>KYC / details</th><th>Review</th></tr></thead><tbody>
        {accounts.map((account) => {
          const awaitingReview = account.status === "Pending Admin Approval";
          return <tr key={account.id}>
            <td><b>{account.name}</b></td>
            <td>{account.email ?? account.phone ?? "Not provided"}</td>
            <td>{account.role}</td>
            <td>{dateLabel(account.createdAt)}<small>{account.submittedAt ? `Submitted ${dateLabel(account.submittedAt)}` : "Not yet verified"}</small></td>
            <td><Status value={account.status === "Pending Verification" ? "Pending Verification" : "Verified"} /></td>
            <td><Status value={account.status} />{account.rejectionReason && <small>Reason: {account.rejectionReason}</small>}</td>
            <td>
              <details className="history-details"><summary>View details</summary>
                <p><b>Document type:</b> {account.kycDocumentType}</p>
                <p><b>Contact method:</b> {account.contactMethod === "email" ? "Email" : "Phone Number"}</p>
                <div className="preview-grid">{account.kycDocuments.map((document, index) => <div className="preview-image" key={`${document.name}-${index}`}><Image src={document.dataUrl} alt={`${account.kycDocumentType} document ${index + 1}`} width={240} height={160} unoptimized /><span>{document.name} · {document.size < 1024 ? "<1 KB" : `${(document.size / 1024).toFixed(0)} KB`}</span></div>)}</div>
                {!account.kycDocuments.length && <p className="muted-copy">No document images were attached.</p>}
              </details>
            </td>
            <td>{awaitingReview ? <div className="record-actions"><button className="button button-primary" onClick={() => void p.mutate("approve-account", { accountId: account.id })}>Approve</button><form className="inline-form" onSubmit={(event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); void p.mutate("reject-account", { accountId: account.id, reason: values.reason }); }}><label>Optional rejection reason<input name="reason" maxLength={400} /></label><button className="button button-outline" type="submit">Reject</button></form></div> : "No action"}</td>
          </tr>;
        })}
      </tbody></table>{accounts.length === 0 && <EmptyLine text="No registrations match this search." />}</div>
    </>;
  }
  if (route === "factories") return <div className="record-grid">{p.data.factories.map((factory) => <article className="record-card" key={factory.id}><div className="record-card-head"><div className="company-mark"><Building2 size={18} /></div><div><strong>{factory.name}</strong><span>{factory.district}, {factory.province} · {factory.capacityTonnes} tonnes/day</span></div><Status value={factory.verified ? "verified" : "pending verification"} /></div><div className="record-actions"><button className="button button-primary" onClick={() => void p.mutate("update-factory-verification", { factoryId: factory.id, verified: true })}>Approve verified status</button>{factory.verified && <button className="button button-outline" onClick={() => window.confirm("Remove this factory’s verified status?") && void p.mutate("update-factory-verification", { factoryId: factory.id, verified: false })}>Unverify</button>}</div></article>)}</div>;
  if (route === "audit-logs") {
    const events = p.data.offers.flatMap((offer) => offer.history.map((item) => ({ id: `${offer.id}-${item.at}`, entity: offer.id, ...item }))).sort((left, right) => right.at.localeCompare(left.at));
    return <section className="panel"><PanelTitle title="Buyer offer audit history" /><div className="panel table-panel"><table><thead><tr><th>Recorded</th><th>Offer</th><th>Actor</th><th>Change</th><th>Details</th></tr></thead><tbody>{events.slice(0, 100).map((event) => <tr key={event.id}><td>{dateLabel(event.at)}</td><td>{event.entity}</td><td>{event.by}</td><td>{event.status}</td><td>{event.note}</td></tr>)}</tbody></table>{events.length === 0 && <EmptyLine text="No offer changes have been recorded yet." />}</div></section>;
  }
  const prices = p.data.prices.filter((price) => `${price.province} ${price.district} ${price.grade} ${price.source}`.toLowerCase().includes(p.search.toLowerCase()));
  return <><div className="metric-grid"><MetricCard label="Regional price records" value={String(p.data.prices.filter((price) => price.priceType !== "official").length)} note="DEMO DATA · Admin managed" /><MetricCard label="Open listings" value={String(p.data.listings.filter((item) => item.status === "available").length)} note="Shared marketplace" /><MetricCard label="Pending registrations" value={String(p.data.accounts.filter((account) => account.status === "Pending Admin Approval").length)} note="Require review" /><MetricCard label="Reviewed accounts" value={String(p.data.accounts.filter((account) => account.status === "Approved" || account.status === "Rejected").length)} note="Approved or rejected" /></div><section className="panel admin-price-form"><PanelTitle title="Add regional reference price" /><form className="form-grid form-grid-tight" onSubmit={(event) => p.submit("save-price", event)}><Field name="province" label="Province" required /><Field name="district" label="District" required /><label>Grade<select name="grade"><option>A</option><option>B</option><option>C</option></select></label><Field name="pricePerKg" label="Price (LAK/kg)" type="number" required min="1" /><Field name="source" label="Source" required defaultValue="Admin demo bulletin" /><Field name="effectiveDate" label="Effective date" type="date" /><button className="button button-primary" type="submit"><Plus size={14} /> Add sample price</button></form></section><Toolbar search={p.search} setSearch={p.setSearch} placeholder="Search price records" /><div className="panel table-panel"><table><thead><tr><th>Region</th><th>Grade</th><th>Price/kg</th><th>Source</th><th>Effective</th><th>Record</th></tr></thead><tbody>{prices.filter((price) => price.priceType !== "official").slice(0, 50).map((price) => <tr key={price.id}><td>{price.province} · {price.district}</td><td><Grade value={price.grade} /></td><td>{price.pricePerKg.toLocaleString()} LAK</td><td>{price.source}</td><td>{dateLabel(price.effectiveDate)}</td><td><Status value="demo" /></td></tr>)}</tbody></table>{prices.length === 0 && <EmptyLine text="No prices match this search." />}</div><section className="panel"><PanelTitle title="Administration preview" /><p className="muted-copy">Account approvals and reference-price management are restricted to the authenticated administrator.</p></section></>;
}

function ListingDetail({ listing, farm, data, mutate, activeListingId, setActiveListingId, submit }: { listing: PortalData["listings"][number]; farm: PortalData["farms"][number]; data: PortalData; mutate: (action: string, values?: Record<string, unknown>) => Promise<unknown>; activeListingId: string; setActiveListingId: (value: string) => void; submit: (action: string, event: FormEvent<HTMLFormElement>, extras?: Record<string, unknown>) => void }) {
  const offerOpen = activeListingId === listing.id;
  return <><Link className="back-link" href="/factory/marketplace"><ArrowLeft size={14} />Back to marketplace</Link><div className="workspace-grid two-col detail-grid"><section className="panel"><PhotoGallery photos={farm.photos} /><div className="detail-heading"><div><h2>{farm.name}</h2><p>{farm.village}, {farm.district}, {farm.province}</p></div><Status value={listing.status} /></div><div className="detail-rows"><Detail label="Cassava variety" value={listing.variety} /><Detail label="Available harvest" value={`${listing.availableQuantityKg.toLocaleString()} kg`} /><Detail label="Expected harvest" value={dateLabel(listing.harvestDate)} /><Detail label="Estimated grade" value={`Grade ${listing.estimatedGrade}`} /><Detail label="Farm area" value={`${farm.areaHectares} ha`} /><Detail label="Farmer reference" value="Farmer profile private; contact the farmer directly" /><Detail label="Preferred terms" value={listing.pickupPreference.replaceAll("-", " ")} /></div><p className="muted-copy">Only approximate district and village are shown. Exact coordinates and private contact details are withheld.</p><div className="workspace-actions"><button className="button button-factory" onClick={() => setActiveListingId(offerOpen ? "" : listing.id)}><FilePlus2 size={15} /> {offerOpen ? "Close offer form" : "Make offer"}</button><button className="button button-outline" onClick={() => void mutate("send-message", { recipientId: listing.farmerId, listingId: listing.id, content: `Hello, I would like to discuss harvest ${listing.id}.` })}><MessageCircle size={15} /> Contact farmer</button></div></section><section className="panel"><PanelTitle title="Quality and reference" /><div className="listing-grade-box"><Grade value={listing.estimatedGrade} /><span>Preliminary grade estimate</span></div>{data.assessments.find((item) => item.id === listing.assessmentId) ? <p className="muted-copy">Simulated visual assessment on {dateLabel(data.assessments.find((item) => item.id === listing.assessmentId)!.createdAt)}. Not a lab result.</p> : <p className="muted-copy">No visual assessment attached.</p>}<Detail label="Reference price · Bolikhamxay" value={`${data.prices.find((price) => price.province === farm.province && price.grade === listing.estimatedGrade)?.pricePerKg ?? 1_600} LAK/kg · DEMO DATA`} /><Detail label="Asking price" value={listing.askingPricePerKg ? `${listing.askingPricePerKg.toLocaleString()} LAK/kg` : "Not specified"} /><div className="notice notice-neutral">Exact transport distance is unavailable without precise coordinates. Confirm logistics directly with the farmer.</div></section></div>{offerOpen && <section className="panel offer-form-panel"><PanelTitle title="Submit a purchase offer" /><OfferForm listing={listing} submit={submit} /></section>}</>;
}

function OfferForm({ listing, submit }: { listing: PortalData["listings"][number]; submit: (action: string, event: FormEvent<HTMLFormElement>, extras?: Record<string, unknown>) => void }) {
  const [price, setPrice] = useState("1600"); const [quantity, setQuantity] = useState(String(Math.min(5000, listing.availableQuantityKg))); const [transport, setTransport] = useState("factory-pickup"); const [cost, setCost] = useState("0");
  const breakdown = calculatePrice({ pricePerKg: Number(price) || 0, quantityKg: Number(quantity) || 0, transportArrangement: transport as "factory-pickup" | "farmer-delivery" | "shared", transportationCost: Number(cost) || 0 });
  return <form className="form-grid" onSubmit={(event) => submit("create-offer", event, { listingId: listing.id })}><label>Offered price (LAK/kg)<input name="pricePerKg" type="number" min="1" required value={price} onChange={(event) => setPrice(event.target.value)} /></label><label>Purchase quantity (kg)<input name="quantityKg" type="number" min="1" max={listing.availableQuantityKg} required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>Transportation arrangement<select name="transportArrangement" value={transport} onChange={(event) => setTransport(event.target.value)}><option value="factory-pickup">Factory pickup</option><option value="farmer-delivery">Farmer delivery</option><option value="shared">Shared transport cost</option></select></label><label>Estimated transport cost (LAK)<input name="transportationCost" type="number" min="0" value={cost} onChange={(event) => setCost(event.target.value)} /></label><Field name="pickupDate" label="Proposed pickup date" type="date" /><Field name="expirationDate" label="Offer expires" type="date" /><label>Payment terms<input name="paymentTerms" required defaultValue="Within 2 business days after inspection" /></label><label>Inspection terms<input name="inspectionTerms" required defaultValue="Visual inspection and weighbridge confirmation" /></label><label className="field-span">Additional conditions<textarea name="additionalConditions" rows={2} placeholder="Optional conditions" /></label><PriceBreakdownView breakdown={breakdown} quantity={Number(quantity) || 0} /><div className="form-actions field-span"><button className="button button-factory" type="submit" onClick={(event) => { if (!window.confirm(`Submit an offer for ${Number(quantity).toLocaleString()} kg at ${Number(price).toLocaleString()} LAK/kg?`)) event.preventDefault(); }}><Send size={14} /> Confirm and submit offer</button></div></form>;
}

/* eslint-disable @next/next/no-img-element */
function QualityCheck({ data, imageFiles, setImageFiles, activeAssessmentId, setActiveAssessmentId, mutate }: { data: PortalData; imageFiles: { name: string; preview: string }[]; setImageFiles: (value: { name: string; preview: string }[]) => void; activeAssessmentId: string; setActiveAssessmentId: (value: string) => void; mutate: (action: string, values?: Record<string, unknown>) => Promise<unknown> }) {
  const [running, setRunning] = useState(false);
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length + imageFiles.length > 8) { window.alert("Upload up to 8 images per assessment."); return; }
    const accepted: { name: string; preview: string }[] = [];
    for (const file of files) {
      if (!(["image/jpeg", "image/png", "image/webp"].includes(file.type)) || file.size > 700_000) { window.alert(`${file.name} must be JPG, PNG, or WebP and under 700 KB.`); continue; }
      accepted.push(await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, preview: String(reader.result) }); reader.readAsDataURL(file); }));
    }
    setImageFiles([...imageFiles, ...accepted]); event.target.value = "";
  }
  async function assess() {
    if (!imageFiles.length) { window.alert("Choose at least one cassava photo first."); return; }
    setRunning(true);
    const result = await mutate("create-assessment", { imageNames: imageFiles.map((file) => file.name) }) as { id?: string } | null;
    if (result?.id) setActiveAssessmentId(result.id);
    setRunning(false);
  }
  const assessment = data.assessments.find((item) => item.id === activeAssessmentId) ?? data.assessments[0];
  return <div className="workspace-grid two-col"><section className="panel"><PanelTitle title="Cassava photo assessment" /><p className="muted-copy">Upload clear photos of several roots in natural light. JPG, PNG, or WebP · up to 700 KB each · 8 images maximum.</p><label className="upload-zone"><Camera size={24} /><b>Choose cassava photos</b><span>Images are kept only in this browser preview; the mock service receives filenames.</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void upload(event)} /></label>{imageFiles.length > 0 && <div className="preview-grid">{imageFiles.map((file, index) => <div className="preview-image" key={`${file.name}-${index}`}><img src={file.preview} alt={file.name} /><button aria-label={`Remove ${file.name}`} onClick={() => setImageFiles(imageFiles.filter((_, current) => current !== index))}><X size={14} /></button><span>{file.name}</span></div>)}</div>}<button className="button button-primary" disabled={!imageFiles.length || running} onClick={() => void assess()}>{running ? "Assessing photos…" : "Run simulated assessment"}</button></section><section className="panel"><PanelTitle title="Latest preliminary assessment" />{assessment ? <><div className="assessment-grade"><Grade value={assessment.grade} /><div><strong>Grade {assessment.grade}</strong><span>Simulated visual result · confidence indicator {assessment.confidence}%</span></div></div><Detail label="Visible damage" value={assessment.damage.join(", ")} /><Detail label="Foreign material" value={assessment.foreignMaterial.join(", ")} /><Detail label="Assessment time" value={dateLabel(assessment.createdAt)} /><label className="field-span">Attach to harvest listing<select id="assessment-listing" defaultValue=""><option value="">Choose your harvest</option>{data.listings.map((listing) => <option value={listing.id} key={listing.id}>{listing.id} · {listing.availableQuantityKg.toLocaleString()} kg</option>)}</select></label><button className="button button-outline" onClick={() => { const listingId = (document.getElementById("assessment-listing") as HTMLSelectElement | null)?.value; if (listingId) void mutate("attach-assessment", { listingId, assessmentId: assessment.id }); else window.alert("Select a harvest listing to attach this assessment."); }}>Attach assessment</button></> : <EmptyLine text="Upload photos and run a simulated assessment to see a result." />}<div className="notice notice-neutral">Simulated AI assessment only; not a scientific measurement. No starch percentage is estimated. Final quality and price must be confirmed by buyer inspection.</div></section></div>;
}
/* eslint-enable @next/next/no-img-element */

function PriceWorkspace(p: { data: PortalData; calculatorQuantity: string; setCalculatorQuantity: (value: string) => void; search: string; setSearch: (value: string) => void; provinceFilter: string; setProvinceFilter: (value: string) => void; gradeFilter: string; setGradeFilter: (value: string) => void; role: "farmer" | "factory"; submit?: (action: string, event: FormEvent<HTMLFormElement>) => void; factoryId?: string }) {
  const [range, setRange] = useState(30);
  const regions = Array.from(new Set(p.data.prices.map((price) => price.province)));
  const prices = p.data.prices.filter((price) => (p.provinceFilter === "all" || price.province === p.provinceFilter) && (p.gradeFilter === "all" || price.grade === p.gradeFilter) && `${price.province} ${price.district} ${price.grade} ${price.source}`.toLowerCase().includes(p.search.toLowerCase()));
  const referencePrices = prices.filter((price) => price.priceType !== "official");
  const latest = [...referencePrices].sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0];
  const officialPrice = getOfficialPrice(p.data.prices, "Bolikhamxay", "", "B");
  const factoryProfile = p.factoryId ? p.data.factories.find((factory) => factory.id === p.factoryId) : undefined;
  const quantity = Number(p.calculatorQuantity) || 0;
  return <>
    <div className="price-summary-row">
      <article className="price-highlight"><span>Official factory daily price · Bolikhamxay · Grade B</span><strong>{officialPrice ? `${officialPrice.pricePerKg.toLocaleString()} LAK/kg` : "Not published"}</strong><span>{officialPrice ? `Effective ${dateLabel(officialPrice.effectiveDate)} · ${officialPrice.source}` : "No official price is available for this region and grade."}</span></article>
      <article className="price-highlight price-highlight-secondary"><span>Reference, official, offer and final prices</span><b>Keep price types separate</b><span>Regional references are not a buyer offer or a final price agreed directly by the parties.</span></article>
    </div>
    {p.role === "factory" && p.submit && <section className="panel admin-price-form">
      <PanelTitle title="Set today&apos;s official factory buying price" />
      <p className="muted-copy">The published price is used by middlemen for matching location and grade. Middlemen cannot change or negotiate it.</p>
      {!factoryProfile?.verified && <p className="notice notice-neutral">Factory verification is required before an official price can be published.</p>}
      <form className="form-grid form-grid-tight" onSubmit={(event) => p.submit?.("set-official-price", event)}>
        <Field name="province" label="Province" required defaultValue={factoryProfile?.province} />
        <Field name="district" label="District" required defaultValue={factoryProfile?.district} />
        <label>Grade<select name="grade" defaultValue="B"><option>A</option><option>B</option><option>C</option></select></label>
        <Field name="pricePerKg" label="Official price (LAK/kg)" type="number" min="1" required />
        <button className="button button-factory" type="submit" disabled={!factoryProfile?.verified}><CircleDollarSign size={14} /> Publish today&apos;s price</button>
      </form>
    </section>}
    <div className="panel price-chart-panel"><PanelTitle title="Regional price history · sample reference series" /><div className="range-tabs">{[7, 30, 90].map((days) => <button className={range === days ? "selected" : ""} key={days} onClick={() => setRange(days)}>{days} days</button>)}</div><PriceChart prices={referencePrices.slice(0, Math.max(7, Math.min(range, 90)))} /><p className="muted-copy">Source: {latest?.source ?? "CassavaLink sample provincial bulletin"} · last updated {latest ? dateLabel(latest.effectiveDate) : "sample date"} · DEMO DATA</p></div>
    <div className="price-calculator"><div><h2>Gross value calculator</h2><p>Estimate gross value only; no transport cost or deductions are included.</p></div><label>Quantity (kg)<input type="number" min="0" value={p.calculatorQuantity} onChange={(event) => p.setCalculatorQuantity(event.target.value)} /></label><div><span>Estimated gross at reference</span><strong>{formatLak((latest?.pricePerKg ?? 1600) * quantity)}</strong></div></div>
    <Toolbar search={p.search} setSearch={p.setSearch} placeholder="Search province, district, source"><SelectFilter value={p.provinceFilter} setValue={p.setProvinceFilter} options={[["all", "All provinces"], ...regions.map((province) => [province, province] as [string, string])]} /><SelectFilter value={p.gradeFilter} setValue={p.setGradeFilter} options={[["all", "All grades"], ["A", "Grade A"], ["B", "Grade B"], ["C", "Grade C"]]} /></Toolbar>
    <div className="panel table-panel"><table><thead><tr><th>Province / district</th><th>Grade</th><th>Price type</th><th>LAK/kg</th><th>LAK/tonne</th><th>Source</th><th>Effective date</th></tr></thead><tbody>{prices.slice(0, 60).map((price) => <tr key={price.id}><td>{price.province} · {price.district}</td><td><Grade value={price.grade} /></td><td>{price.priceType === "official" ? "Official daily" : "Regional reference"}</td><td>{price.pricePerKg.toLocaleString()}</td><td>{(price.pricePerKg * 1000).toLocaleString()}</td><td>{price.source}</td><td>{dateLabel(price.effectiveDate)}</td></tr>)}</tbody></table>{prices.length === 0 && <EmptyLine text="No prices match your filters." />}</div>
    <p className="muted-copy">{p.role === "factory" ? "Compare offers you send and receive with regional price references." : "Asking prices and individual buyer offers are shown separately from official factory prices and regional references."} DEMO DATA: not a live quote.</p>
  </>;
}

function OfferCard({ offer, data, mutate, farmer = false }: { offer: PortalData["offers"][number]; data: PortalData; mutate: (action: string, values?: Record<string, unknown>) => Promise<unknown>; farmer?: boolean }) {
  const [countering, setCountering] = useState(false);
  const factory = data.factories.find((item) => item.id === offer.factoryId);
  const buyerId = offer.middlemanId ?? offer.factoryId ?? "";
  const buyerName = offer.middlemanId ? "Middleman" : factory?.name ?? "Local demo factory";
  const listing = data.listings.find((item) => item.id === offer.listingId);
  const farm = listing ? data.farms.find((item) => item.id === listing.farmId) : undefined;
  const quantity = offer.counterQuantityKg ?? offer.quantityKg;
  const price = offer.counterPricePerKg ?? offer.pricePerKg;
  const breakdown = calculatePrice({ pricePerKg: price, quantityKg: quantity, transportArrangement: offer.transportArrangement, transportationCost: offer.transportationCost });
  const active = offer.status === "pending" || offer.status === "countered";
  return <article className="record-card offer-card"><div className="record-card-head"><div className="company-mark"><Building2 size={19} /></div><div><strong>{buyerName}</strong><span>{offer.middlemanId ? "Middleman · fixed official factory price" : `${factory?.province ?? "Laos"} · ${factory?.verified ? <span className="verified"><BadgeCheck size={12} /> Verified</span> : "Verification pending"}`}</span></div><Status value={offer.status} /></div><div className="offer-price"><strong>{price.toLocaleString()} LAK/kg</strong><span>{quantity.toLocaleString()} kg {offer.middlemanId ? "requested at the official price" : "offered"} · {listing?.id ?? "Harvest"}</span></div><div className="detail-rows compact"><Detail label="Gross amount" value={formatLak(breakdown.grossAmount)} /><Detail label="Arrangement" value={offer.transportArrangement.replaceAll("-", " ")} /><Detail label="Farmer transport share" value={formatLak(breakdown.farmerTransportCost)} /><Detail label="Estimated net" value={formatLak(breakdown.netAmount)} /><Detail label="Proposed payment terms" value={offer.paymentTerms} /><Detail label="Proposed inspection" value={offer.inspectionTerms} /><Detail label="Offer expires" value={dateLabel(offer.expirationDate)} /></div>{offer.middlemanId && <div className="notice notice-neutral">This purchase request is fixed to the official factory price and cannot be negotiated.</div>}{offer.status === "countered" && <div className="notice notice-neutral">Farmer counter: {offer.counterPricePerKg?.toLocaleString()} LAK/kg for {offer.counterQuantityKg?.toLocaleString()} kg.</div>}{active && farmer && <div className="record-actions"><button className="button button-primary" onClick={() => window.confirm(`Accept ${price.toLocaleString()} LAK/kg for ${quantity.toLocaleString()} kg? This confirms the offer terms only. Coordinate any sale and payment directly outside CassavaLink.`) && void mutate("respond-offer", { offerId: offer.id, decision: "accept" })}><Check size={14} /> Accept offer</button><button className="button button-outline" onClick={() => void mutate("respond-offer", { offerId: offer.id, decision: "reject" })}>Reject</button>{!offer.middlemanId && <button className="button button-outline" onClick={() => setCountering(!countering)}>Counteroffer</button>}<button className="button button-outline" onClick={() => void mutate("send-message", { recipientId: buyerId, listingId: offer.listingId, content: `Hello, I have a question about your offer ${offer.id}.` })}><MessageCircle size={14} /> Contact {offer.middlemanId ? "middleman" : "factory"}</button></div>}{active && !farmer && offer.status === "pending" && <div className="record-actions"><button className="button button-outline" onClick={() => window.confirm("Withdraw this pending offer?") && void mutate("respond-offer", { offerId: offer.id, decision: "withdraw" })}>Withdraw offer</button></div>}{active && !farmer && offer.status === "countered" && <div className="record-actions"><button className="button button-factory" onClick={() => window.confirm("Accept the farmer’s counteroffer? This confirms the offer terms only. Coordinate any sale and payment directly outside CassavaLink.") && void mutate("respond-offer", { offerId: offer.id, decision: "accept-counter" })}><Check size={14} /> Accept counteroffer</button><button className="button button-outline" onClick={() => void mutate("respond-offer", { offerId: offer.id, decision: "withdraw" })}>Decline and withdraw</button></div>}{countering && !offer.middlemanId && <form className="inline-form" onSubmit={(event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); void mutate("respond-offer", { offerId: offer.id, decision: "counter", ...values }); setCountering(false); }}><Field name="pricePerKg" label="Counter price (LAK/kg)" type="number" required defaultValue={offer.pricePerKg} /><Field name="quantityKg" label="Counter quantity (kg)" type="number" min="1" max={listing?.availableQuantityKg ?? offer.quantityKg} required defaultValue={offer.quantityKg} /><button className="button button-primary" type="submit">Send counteroffer</button></form>}<details className="history-details"><summary>Offer history ({offer.history.length})</summary>{offer.history.map((item, index) => <p key={`${item.at}-${index}`}>{dateLabel(item.at)} · {item.status} · {item.note}</p>)}</details>{farm && <span className="muted-copy">Farm: {farm.name}, {farm.district}</span>}</article>;
}

function Messages({ data, identity, mutate, role }: { data: PortalData; identity: Identity; mutate: (action: string, values?: Record<string, unknown>) => Promise<unknown>; role: "farmer" | "factory" }) {
  const own = data.messages.filter((message) => message.senderId === identity.id || message.recipientId === identity.id);
  const recipients = role === "farmer" ? data.factories : [{ id: DEMO_ACCOUNTS.farmer.id, name: "Phonethip S.", province: "Bolikhamxay", district: "Pakkading", verified: true, capacityTonnes: 0 }];
  return <div className="workspace-grid two-col"><section className="panel"><PanelTitle title="Conversation messages" />{own.length ? own.slice(0, 30).map((message) => <article className={`message-row ${message.senderId === identity.id ? "message-own" : ""}`} key={message.id}><b>{message.senderId === identity.id ? "You" : recipients.find((item) => item.id === message.senderId)?.name ?? "Marketplace participant"}</b><p>{message.content}</p><small>{dateLabel(message.createdAt)} · listing {message.listingId ?? "general"}</small></article>) : <EmptyLine text="No messages yet. Start a conversation from an offer or listing." />}</section><section className="panel"><PanelTitle title="Send a message" /><form className="form-grid" onSubmit={(event) => submitMessage(event, mutate, identity)}><label>To<select name="recipientId" required>{recipients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Related harvest<select name="listingId"><option value="">General conversation</option>{data.listings.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.availableQuantityKg.toLocaleString()} kg</option>)}</select></label><label className="field-span">Message<textarea name="content" rows={5} minLength={2} maxLength={1000} required placeholder="Write a message" /></label><button className="button button-primary" type="submit"><Send size={14} /> Send message</button></form></section></div>;
}

function submitMessage(event: FormEvent<HTMLFormElement>, mutate: (action: string, values?: Record<string, unknown>) => Promise<unknown>, identity: Identity) {
  event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  if (values.recipientId === identity.id) { window.alert("Choose another participant."); return; }
  void mutate("send-message", values);
}

function FactoryProfile({ data, identity, submit }: { data: PortalData; identity: Identity; submit: (action: string, event: FormEvent<HTMLFormElement>) => void }) {
  const factory = data.factories.find((item) => item.id === identity.id);
  const acceptedOffers = data.offers.filter((offer) => offer.status === "accepted").length;
  return <div className="workspace-grid two-col"><section className="panel"><PanelTitle title="Company profile" /><div className="profile-company"><div className="company-mark company-mark-large"><Building2 size={25} /></div><div><h2>{factory?.name ?? identity.name}</h2><span className="verified"><BadgeCheck size={13} /> {factory?.verified ? "Verified factory" : "Pending verification"}</span></div></div><div className="detail-rows"><Detail label="Factory location" value={`${factory?.district ?? "Thoulakhom"}, ${factory?.province ?? identity.location}`} /><Detail label="Processing capacity" value={`${factory?.capacityTonnes ?? 320} tonnes/day`} /><Detail label="Products" value="Cassava starch · dried chips" /><Detail label="Accepted buyer offers" value={String(acceptedOffers)} /></div><p className="muted-copy">Demo profile records are local and fictional. Verification documents are not uploaded or reviewed in this prototype.</p></section><section className="panel"><PanelTitle title="Update company profile" /><form className="form-grid" onSubmit={(event) => submit("update-profile", event)}><Field name="name" label="Company name" required defaultValue={factory?.name} /><Field name="location" label="Province / district" required defaultValue={`${factory?.district ?? "Thoulakhom"}, ${factory?.province ?? "Vientiane Province"}`} /><Field name="capacityTonnes" label="Capacity (tonnes/day)" type="number" min="1" defaultValue={factory?.capacityTonnes ?? 320} /><label className="field-span">Verification document (demo placeholder)<input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => { if (event.target.files?.[0]) window.alert(`${event.target.files[0].name} selected. Document storage is not configured in local demo mode.`); }} /></label><button className="button button-factory" type="submit">Save profile</button></form></section></div>;
}

function FarmCard({ farm, listings, assessments, mutate }: { farm: PortalData["farms"][number]; listings: PortalData["listings"]; assessments: PortalData["assessments"]; mutate: (action: string, values?: Record<string, unknown>) => Promise<unknown> }) {
  const ownListings = listings.filter((item) => item.farmId === farm.id);
  const available = ownListings.reduce((sum, item) => sum + item.availableQuantityKg, 0);
  const assessment = assessments.find((item) => ownListings.some((listing) => listing.assessmentId === item.id));
  return <article className="record-card farm-card"><PhotoGallery photos={farm.photos} compact /><div className="record-card-head"><div><strong>{farm.name}</strong><span>{farm.village}, {farm.district}, {farm.province}</span></div><Status value={farm.status} /></div><div className="detail-rows compact"><Detail label="Variety" value={farm.variety} /><Detail label="Farm size" value={`${farm.areaHectares} ha`} /><Detail label="Estimated production" value={`${farm.estimatedProductionKg.toLocaleString()} kg`} /><Detail label="Expected harvest" value={dateLabel(farm.expectedHarvestDate)} /><Detail label="Available quantity" value={`${available.toLocaleString()} kg`} /><Detail label="Listing status" value={`${ownListings.filter((item) => item.status === "available").length} active`} /><Detail label="Quality assessment" value={assessment ? `Simulated grade ${assessment.grade}` : "Not assessed"} /></div><div className="record-actions"><Link className="button button-outline" href={`/farmer/farms/${farm.id}`}>View details</Link><Link className="button button-outline" href={`/farmer/farms/${farm.id}/edit`}>Edit</Link><Link className="button button-primary" href={`/farmer/harvests/new?farm=${farm.id}`}>Add harvest</Link><button className="icon-button" title="Deactivate farm" aria-label="Deactivate farm" onClick={() => window.confirm(`Deactivate ${farm.name}?`) && void mutate("update-farm", { id: farm.id, status: farm.status === "active" ? "inactive" : "active" })}><Trash2 size={15} /></button></div></article>;
}

function ListingCard({ listing, farm, assessment }: { listing: PortalData["listings"][number]; farm?: PortalData["farms"][number]; assessment?: PortalData["assessments"][number] }) {
  if (!farm) return null;
  return <article className="record-card listing-card"><PhotoGallery photos={farm.photos} compact /><div className="record-card-head"><div><strong>{farm.name}</strong><span>{farm.district}, {farm.province} · approximate</span></div><Grade value={listing.estimatedGrade} /></div><div className="listing-volume"><b>{listing.availableQuantityKg.toLocaleString()} kg</b><span>available · {listing.variety}</span></div><div className="detail-rows compact"><Detail label="Expected harvest" value={dateLabel(listing.harvestDate)} /><Detail label="Asking price" value={listing.askingPricePerKg ? `${listing.askingPricePerKg.toLocaleString()} LAK/kg` : "Open to offers"} /><Detail label="Assessment" value={assessment ? `Simulated grade ${assessment.grade}` : "Not assessed"} /></div><Link className="button button-factory" href={`/factory/marketplace/${listing.id}`}>View harvest <ArrowRight size={14} /></Link></article>;
}

function PriceChart({ prices }: { prices: PortalData["prices"] }) {
  const selected = [...prices].slice(0, 13).reverse();
  const max = Math.max(1, ...selected.map((item) => item.pricePerKg));
  const min = Math.min(0, ...selected.map((item) => item.pricePerKg));
  return <><div className="price-chart" role="img" aria-label="Sample reference price history chart">{selected.map((item, index) => <div className="price-chart-column" key={item.id} title={`${item.effectiveDate}: ${item.pricePerKg} LAK/kg`}><span style={{ height: `${Math.max(12, (item.pricePerKg / max) * 100)}%` }} /><small>{index % 3 === 0 ? dateLabel(item.effectiveDate, true) : ""}</small></div>)}</div><div className="chart-legend"><span>● DEMO reference data</span><span>{selected.length ? `${Math.min(...selected.map((item) => item.pricePerKg)).toLocaleString()}–${Math.max(...selected.map((item) => item.pricePerKg)).toLocaleString()} LAK/kg` : "No history"}</span></div><span className="visually-hidden">Lowest chart baseline {min}</span></>;
}

function PriceBreakdownView({ breakdown, quantity }: { breakdown: ReturnType<typeof calculatePrice>; quantity: number }) {
  return <div className="calculation-box field-span"><strong>Live purchase estimate</strong><Detail label={`Gross · ${quantity.toLocaleString()} kg`} value={formatLak(breakdown.grossAmount)} /><Detail label="Farmer-paid transport" value={formatLak(breakdown.farmerTransportCost)} /><Detail label="Other agreed deductions" value={formatLak(0)} /><Detail label="Estimated farmer net" value={formatLak(breakdown.netAmount)} /><Detail label="Estimated net/kg" value={`${breakdown.netPricePerKg.toLocaleString()} LAK/kg`} /></div>;
}

function OfferSummary({ offer, data }: { offer: PortalData["offers"][number]; data: PortalData }) {
  const factory = data.factories.find((item) => item.id === offer.factoryId);
  return <div className="activity-item"><span className="activity-dot" /><span><strong>{offer.middlemanId ? "Middleman offer" : factory?.name ?? "Factory offer"} · {offer.pricePerKg.toLocaleString()} LAK/kg</strong><span>{offer.quantityKg.toLocaleString()} kg · {offer.status} · {dateLabel(offer.createdAt)}</span></span></div>;
}

function ListingSummary({ listing, farm }: { listing: PortalData["listings"][number]; farm?: PortalData["farms"][number] }) {
  return <div className="activity-item"><span className="activity-dot" /><span><strong>{farm?.name ?? "Farm listing"} · {listing.availableQuantityKg.toLocaleString()} kg</strong><span>{farm?.district}, {farm?.province} · grade {listing.estimatedGrade} · {dateLabel(listing.harvestDate)}</span></span></div>;
}

function NotificationRow({ item, mutate }: { item: PortalData["notifications"][number]; mutate: (action: string, values?: Record<string, unknown>) => Promise<unknown> }) {
  return <div className={`activity-item ${item.readAt ? "muted-row" : ""}`}><span className="activity-dot" /><span><strong>{item.title}</strong><span>{item.message} · {dateLabel(item.createdAt)}</span></span>{!item.readAt && <button className="plain-action" onClick={() => void mutate("mark-notification-read", { id: item.id })}>Mark read</button>}</div>;
}

function Toolbar({ search, setSearch, placeholder, children }: { search: string; setSearch: (value: string) => void; placeholder: string; children?: React.ReactNode }) {
  return <div className="workspace-toolbar"><label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>{children}</div>;
}

function SelectFilter({ value, setValue, options }: { value: string; setValue: (value: string) => void; options: [string, string][] }) {
  return <label className="select-filter"><Filter size={13} /><select value={value} onChange={(event) => setValue(event.target.value)} aria-label="Filter records">{options.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>;
}

function Field({ name, label, type = "text", required = false, defaultValue, min, max, step }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string | number; min?: string | number; max?: string | number; step?: string | number }) {
  return <label>{label}<input name={name} type={type} required={required} defaultValue={defaultValue} min={min} max={max} step={step} /></label>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="detail-row"><span>{label}</span><b>{value}</b></div>;
}

function PanelTitle({ title, href, linkText }: { title: string; href?: string; linkText?: string }) {
  return <div className="panel-head"><h2>{title}</h2>{href && <Link href={href}>{linkText ?? "View all"}</Link>}</div>;
}

function Grade({ value }: { value: string }) {
  return <span className={`grade-badge grade-${value.toLowerCase()}`}>Grade {value}</span>;
}

function Status({ value }: { value: string }) {
  const style = value.toLowerCase().includes("complete") || value === "accepted" || value === "approved" || value === "available" || value === "verified" || value === "active" ? "good" : value === "rejected" || value === "cancelled" ? "bad" : value === "paused" ? "muted" : "waiting";
  return <span className={`status-badge status-${style}`}>{value.replaceAll("_", " ")}</span>;
}

function PhotoGallery({ photos, compact = false }: { photos?: string[]; compact?: boolean }) {
  return <div className={`photo-gallery${compact ? " photo-gallery-compact" : ""}`}>{photos?.length ? photos.slice(0, compact ? 1 : 4).map((photo, index) => <Image src={photo} width={480} height={240} unoptimized alt={`Cassava farm photo ${index + 1}`} key={`${photo}-${index}`} />) : <div className="photo-empty"><Sprout size={22} /><span>No farm photos uploaded</span></div>}</div>;
}

function EmptyPanel({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <section className="empty-panel"><Sprout size={23} /><h2>{title}</h2><p>{detail}</p>{action}</section>;
}

function EmptyLine({ text }: { text: string }) {
  return <p className="empty-line">{text}</p>;
}

function WorkspaceNotice({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="portal-content"><section className="empty-panel"><Leaf size={24} /><h1>{title}</h1><p>{detail}</p>{action}</section></div>;
}

function NotFoundWorkspace({ role }: { role: string }) {
  return <EmptyPanel title="This workspace route is not available" detail={`Check the ${role} navigation or return to the dashboard.`} action={<Link className="button button-primary" href={`/${role}/dashboard`}>Back to dashboard</Link>} />;
}

function titleFor(routeKey: string) {
  const titles: Record<string, string> = { dashboard: "Dashboard", farms: "My farms", "farms/new": "Register a farm", harvests: "My harvests", "harvests/new": "Create harvest listing", "quality-check": "Quality check", prices: "Market prices", offers: "Buyer offers", marketplace: "Marketplace · Find farms", messages: "Messages", profile: "Company profile", settings: "Company settings", notifications: "Notifications", factories: "Factory verification", registrations: "Account approvals", "audit-logs": "Audit history" };
  if (routeKey.startsWith("farms/")) return routeKey.split("/")[2] === "edit" ? "Edit farm" : "Farm details";
  if (routeKey.startsWith("marketplace/")) return "Harvest listing details";
  return titles[routeKey] ?? routeKey.split("/").map((part) => part.replaceAll("-", " ")).join(" / ");
}

function descriptionFor(role: string, routeKey: string) {
  if (routeKey === "dashboard") return role === "farmer" ? "A current picture of your farms, harvests, offers, and market information." : "Explore harvest listings, regional prices, and buyer offers.";
  if (routeKey === "offers") return "Review terms and compare estimated net proceeds before deciding.";
  if (routeKey === "registrations") return "Review new account requests and approve or reject access to the platform.";
  if (routeKey === "prices") return "Official daily factory buying prices alongside regional sample references.";
  if (routeKey === "marketplace") return "Filter harvest availability without exposing exact farm coordinates or private contact details.";
  return "Manage shared CassavaLink demo records and actions for this workspace.";
}

function successMessage(action: string) {
  return ({ "create-farm": "Farm saved to the shared local demo store.", "update-farm": "Farm changes saved.", "create-listing": "Harvest listing saved.", "update-listing": "Harvest status updated.", "create-assessment": "Simulated assessment is ready.", "attach-assessment": "Assessment attached to harvest.", "create-offer": "Purchase request submitted at the official factory price.", "respond-offer": "Offer response saved and the other account notified.", "approve-account": "Account approved. The user can now sign in.", "reject-account": "Registration rejected.", "save-price": "Regional demo reference price added.", "set-official-price": "Today's official factory buying price was published.", "send-message": "Message sent.", "mark-notification-read": "Notification marked as read.", "update-profile": "Company profile saved." } as Record<string, string>)[action] ?? "Changes saved.";
}

function dateLabel(value: string, short = false) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", short ? { day: "2-digit", month: "short" } : { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Vientiane" }).format(date);
}

function PendingOfferEditor({ data, mutate }: { data: PortalData; mutate: (action: string, values?: Record<string, unknown>) => Promise<unknown> }) {
  const pending = data.offers.filter((offer) => offer.status === "pending");
  return <section className="panel offer-form-panel"><PanelTitle title="Edit eligible pending offers" /><p className="muted-copy">Changes are saved to the same offer record and added to its history. Accepted or expired offers cannot be edited.</p>{pending.length ? pending.map((offer) => <form className="inline-form" key={offer.id} onSubmit={(event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); void mutate("update-offer", { offerId: offer.id, ...values }); }}><strong>{offer.id} · {offer.quantityKg.toLocaleString()} kg</strong><Field name="pricePerKg" label="Offer price (LAK/kg)" type="number" min="1" required defaultValue={offer.pricePerKg} /><Field name="quantityKg" label="Quantity (kg)" type="number" min="1" max={data.listings.find((listing) => listing.id === offer.listingId)?.availableQuantityKg ?? offer.quantityKg} required defaultValue={offer.quantityKg} /><button className="button button-factory" type="submit">Save pending offer</button></form>) : <EmptyLine text="There are no pending offers available to edit." />}</section>;
}

function AdminPriceEditor({ data, submit }: { data: PortalData; submit: (action: string, event: FormEvent<HTMLFormElement>) => void }) {
  const prices = data.prices.filter((price) => price.priceType !== "official").sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate));
  return <section className="panel admin-price-form"><PanelTitle title="Correct an existing reference price" /><form className="form-grid form-grid-tight" onSubmit={(event) => submit("update-price", event)}><label className="field-span">Price record<select name="id" required defaultValue="">{prices.map((price) => <option value={price.id} key={price.id}>{price.province} · {price.district} · Grade {price.grade} · {price.pricePerKg} LAK/kg · {price.effectiveDate}</option>)}</select></label><Field name="province" label="Corrected province (optional)" /><Field name="district" label="Corrected district (optional)" /><Field name="pricePerKg" label="Corrected price (LAK/kg)" type="number" min="1" required /><Field name="source" label="Updated source note" /><Field name="effectiveDate" label="Corrected effective date" type="date" /><button className="button button-outline" type="submit">Save correction</button></form></section>;
}