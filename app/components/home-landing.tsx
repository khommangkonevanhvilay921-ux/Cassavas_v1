"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Building2, ChartNoAxesCombined,
  Sprout, Wheat,
} from "lucide-react";
import { SiteHeader, Brand } from "@/app/components/site-header";
import { useLanguage } from "@/app/components/language-provider";

export function HomeLanding() {
  const { dictionary: t } = useLanguage();

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="container">
            <div className="hero-panel">
              <div className="hero-copy">
                <span className="eyebrow"><span className="eyebrow-dot" />{t.hero.eyebrow}</span>
                <h1>{t.hero.titleFirst} <em>{t.hero.titleEmphasis}</em></h1>
                <p>{t.hero.body}</p>
                <div className="hero-actions">
                  <Link className="button button-primary" href="/farmer/dashboard">{t.hero.farmer}<ArrowRight size={15} /></Link>
                  <Link className="button button-outline" href="/factory/dashboard">{t.hero.factory}<ArrowUpRight size={15} /></Link>
                </div>
                <div className="hero-trust">
                  <span className="avatar-stack" aria-hidden="true"><span>PH</span><span>SK</span><span>VT</span></span>
                  <span>{t.hero.trust}</span>
                </div>
              </div>
              <div className="hero-photo">
                <Image
                  className="hero-image"
                  src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1500&q=85"
                  alt="Cassava-growing fields in a green tropical landscape"
                  fill
                  priority
                  sizes="(max-width: 700px) 100vw, 52vw"
                />
                <div className="photo-caption"><strong>{t.hero.photoTitle}</strong>{t.hero.photoNote}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="container" aria-label="Reference market price">
          <div className="price-strip">
            <div className="price-intro">
              <span className="price-icon"><ChartNoAxesCombined size={19} /></span>
              <span><strong>{t.price.title}</strong><span>{t.price.detail}</span></span>
            </div>
            <div className="price-stat"><strong>1,600 LAK/kg</strong><span>16,000,000 LAK/tonne</span></div>
            <div className="price-stat"><strong className="change">+2.4%</strong><span>{t.price.change}</span></div>
            <div className="price-stat"><strong>{t.price.sample}</strong><span>Sample reference only</span></div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-head">
              <div><span className="section-kicker">{t.how.kicker}</span><h2>{t.how.title}</h2></div>
              <p>{t.how.intro}</p>
            </div>
            <div className="steps-grid">
              <article className="step"><span className="step-number">01</span><h3>{t.how.step1}</h3><p>{t.how.step1Body}</p></article>
              <article className="step"><span className="step-number">02</span><h3>{t.how.step2}</h3><p>{t.how.step2Body}</p></article>
              <article className="step"><span className="step-number">03</span><h3>{t.how.step3}</h3><p>{t.how.step3Body}</p></article>
            </div>
          </div>
        </section>

        <section className="container">
          <div className="benefit-band">
            <article className="benefit">
              <span className="benefit-label">{t.benefits.farmers}</span>
              <h3>{t.benefits.farmerTitle}</h3>
              <p>{t.benefits.farmerBody}</p>
              <Link className="benefit-link" href="/farmer/dashboard">{t.benefits.farmersLink}<ArrowRight size={14} /></Link>
            </article>
            <article className="benefit">
              <span className="benefit-label">{t.benefits.factories}</span>
              <h3>{t.benefits.factoryTitle}</h3>
              <p>{t.benefits.factoryBody}</p>
              <Link className="benefit-link" href="/factory/dashboard">{t.benefits.factoriesLink}<ArrowRight size={14} /></Link>
            </article>
          </div>
        </section>

        <section className="section buyers">
          <div className="container">
            <div className="section-head">
              <div><span className="section-kicker">{t.buyers.kicker}</span><h2>{t.buyers.title}</h2></div>
              <p>{t.buyers.intro}</p>
            </div>
            <div className="buyer-grid">
              <Buyer icon="mill" name="Mekong Roots Processing" location="Bolikhamxay Province" />
              <Buyer icon="factory" name="Green Valley Starch Co." location="Vientiane Province" />
              <Buyer icon="field" name="Nam Ngum Agro Works" location="Xaysomboun Province" />
            </div>
          </div>
        </section>

        <section className="container">
          <div className="cta-band">
            <div><h2>{t.cta.title}</h2><p>{t.cta.body}</p></div>
            <Link className="button button-primary" href="/register">{t.cta.button}<ArrowUpRight size={15} /></Link>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container footer-main">
          <Brand />
          <nav className="footer-links" aria-label="Footer navigation">
            <Link href="/about">{t.footer.about}</Link><Link href="/contact">{t.footer.contact}</Link>
            <Link href="/terms">{t.footer.terms}</Link><Link href="/privacy">{t.footer.privacy}</Link><Link href="/help">{t.footer.help}</Link>
          </nav>
        </div>
        <div className="container footer-bottom"><span>{t.footer.rights}</span><span>LAK · Asia/Vientiane</span></div>
      </footer>
    </>
  );
}

function Buyer({ icon, name, location }: { icon: string; name: string; location: string }) {
  return (
    <article className="buyer">
      <span className="buyer-logo">{icon === "factory" ? <Building2 size={21} /> : icon === "field" ? <Sprout size={21} /> : <Wheat size={21} />}</span>
      <span><strong>{name}</strong><span>{location}</span><span className="verified"><BadgeCheck size={12} /> Demo verified factory</span></span>
    </article>
  );
}