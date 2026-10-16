import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/app/components/site-header";
import { DemoLogin, PublicRegister } from "@/app/components/demo-login";
import { getDemoState } from "@/app/lib/demo-store";

const content: Record<string, { eyebrow: string; title: string; intro: string; heading: string; body: string }> = {
  about: {
    eyebrow: "About CassavaLink",
    title: "A clearer view of the cassava market.",
    intro: "CassavaLink helps farmers and processing factories find one another, compare information, and discuss sale terms directly.",
    heading: "More information for better decisions",
    body: "When reliable market information is hard to find, farmers can have limited visibility into available buyers and current reference prices. CassavaLink brings regional reference prices and buyer offers into one place so farmers can compare terms and choose what works for them. It does not guarantee higher prices or remove every intermediary; it is a practical tool for making the selling process more transparent.",
  },
  marketplace: {
    eyebrow: "Marketplace preview",
    title: "See what’s available across the network.",
    intro: "Public visitors can explore a limited preview of sample harvest listings. Farmer contact information and precise farm locations stay private.",
    heading: "Sample listings · DEMO DATA",
    body: "Bolikhamxay · Fresh cassava · 12,400 kg available · estimated harvest in October.\nVientiane Province · Cassava roots · 8,000 kg available · pickup preferred.\nXaysomboun · Fresh roots · 5,500 kg available · delivery can be discussed.",
  },
  prices: {
    eyebrow: "Market prices",
    title: "Reference prices, with the source in view.",
    intro: "Reference prices are separate from individual buyer offers and prices agreed directly by farmers and factories.",
    heading: "DEMO DATA · Regional reference price",
    body: "Bolikhamxay · Fresh roots · 1,600 LAK/kg · Example source: Provincial market bulletin · Effective 26 Sep 2026. This sample is not a live market quote and should not be used as a guaranteed selling price.",
  },
  contact: {
    eyebrow: "Contact",
    title: "We’re here to help you get connected.",
    intro: "Questions about the CassavaLink demo or interested in joining the pilot? Send the team a note.",
    heading: "Get in touch",
    body: "Email: hello@cassavalink.la · Support hours: Monday–Friday, 08:30–17:00 Asia/Vientiane. Demo contact details are illustrative and should be replaced before launch.",
  },
  help: {
    eyebrow: "Help",
    title: "A little help with getting started.",
    intro: "CassavaLink is being developed to make farm discovery and offer comparison simpler for people on both sides of the market.",
    heading: "Using the demo",
    body: "Choose a farmer or factory portal to explore its dashboard. All sample accounts, listings, and prices are fictional. New registrations require administrator approval before account access is enabled.",
  },
  terms: {
    eyebrow: "Terms",
    title: "Terms of use",
    intro: "This prototype is provided for product evaluation and demonstration only.",
    heading: "Demo content",
    body: "All sample users, businesses, listings, and prices are fictional. This prototype does not constitute an offer to buy or sell cassava and does not provide legal, financial, or agricultural advice. CassavaLink does not process sales or payments.",
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Your farm location should stay yours.",
    intro: "The platform is designed to keep precise farm coordinates and private contact details out of public marketplace views.",
    heading: "Prototype privacy notice",
    body: "Registration details and password hashes are stored in the existing local project data file. Do not use real personal information in this prototype; a production privacy policy and database remain necessary before public launch.",
  },
  login: {
    eyebrow: "Sign in",
    title: "Sign in to your account.",
    intro: "Sign in after your account has been approved by an administrator.",
    heading: "Explore the portal previews",
    body: "Registered Farmer and Factory accounts can access the platform after administrator approval.",
  },
  register: {
    eyebrow: "Join CassavaLink",
    title: "Request a CassavaLink account.",
    intro: "Register as a Farmer or Factory and wait for administrator review before signing in.",
    heading: "Administrator approval required",
    body: "New accounts remain pending until an administrator approves them. Sales and payments take place outside CassavaLink.",
  },
};

export default async function PublicInfoPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const page = content[slug];
  if (!page) notFound();
  if (slug === "login") return <DemoLogin />;
  if (slug === "register") return <PublicRegister />;
  if (slug === "marketplace") {
    const state = await getDemoState();
    const listings = state.listings.filter((listing) => listing.status === "available" && listing.availableQuantityKg > 0);
    return (
      <>
        <SiteHeader />
        <main>
          <section className="info-hero"><div className="container"><span className="section-kicker">{page.eyebrow} · DEMO DATA</span><h1>{page.title}</h1><p>{page.intro}</p></div></section>
          <section className="container info-content"><div className="section-head"><div><span className="section-kicker">{listings.length} available sample harvests</span><h2>Public listing preview</h2></div><p>Exact coordinates, farmer contact details, and private offers are not shown here.</p></div><div className="public-listings">{listings.map((listing) => {
            const farm = state.farms.find((item) => item.id === listing.farmId);
            if (!farm) return null;
            return <article className="public-listing" key={listing.id}><Image src={farm.photos[0] ?? "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=640&q=70"} alt="Sample cassava farm" width={320} height={180} unoptimized /><div><span className="section-kicker">{farm.district}, {farm.province}</span><h3>{farm.name}</h3><p>{listing.variety} · {listing.availableQuantityKg.toLocaleString()} kg available · Grade {listing.estimatedGrade}</p><p>Expected harvest {listing.harvestDate} · {listing.askingPricePerKg ? `${listing.askingPricePerKg.toLocaleString()} LAK/kg asking` : "Open to offers"}</p><Link className="back-link" href="/login">Sign in to contact buyers or farmers</Link></div></article>;
          })}</div></section>
        </main>
      </>
    );
  }
  if (slug === "prices") {
    const state = await getDemoState();
    const latestByRegionGrade = new Map<string, (typeof state.prices)[number]>();
    for (const price of [...state.prices].sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))) {
      const key = `${price.province}-${price.district}-${price.grade}`;
      if (!latestByRegionGrade.has(key)) latestByRegionGrade.set(key, price);
    }
    const prices = [...latestByRegionGrade.values()].sort((left, right) => left.province.localeCompare(right.province) || left.district.localeCompare(right.district) || left.grade.localeCompare(right.grade));
    return (
      <>
        <SiteHeader />
        <main>
          <section className="info-hero"><div className="container"><span className="section-kicker">{page.eyebrow} · DEMO DATA</span><h1>{page.title}</h1><p>{page.intro}</p></div></section>
          <section className="container info-content"><div className="notice notice-neutral">Sample admin-managed reference entries. These are not live quotes, individual buyer offers, or final prices agreed directly by the parties.</div><div className="panel table-panel"><table><thead><tr><th>Province / district</th><th>Grade</th><th>LAK/kg</th><th>LAK/tonne</th><th>Source</th><th>Effective date</th></tr></thead><tbody>{prices.map((price) => <tr key={price.id}><td>{price.province} · {price.district}</td><td>Grade {price.grade}</td><td>{price.pricePerKg.toLocaleString()}</td><td>{(price.pricePerKg * 1000).toLocaleString()}</td><td>{price.source}</td><td>{price.effectiveDate}</td></tr>)}</tbody></table></div><p className="muted-copy">Last updated date is shown for each sample record. Compare a reference price with actual buyer offers before making a selling decision.</p></section>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main>
        <section className="info-hero"><div className="container"><span className="section-kicker">{page.eyebrow}</span><h1>{page.title}</h1><p>{page.intro}</p></div></section>
        <section className="container info-content">
          <h2>{page.heading}</h2>
          <p>{page.body.split("\n").map((line) => <span key={line}>{line}<br /></span>)}</p>
          {(slug === "register" || slug === "login" || slug === "marketplace") && (
            <p><Link className="button button-primary" href="/farmer/dashboard">Explore farmer portal</Link> <Link className="button button-factory" href="/factory/dashboard">Explore factory portal</Link></p>
          )}
        </section>
      </main>
    </>
  );
}