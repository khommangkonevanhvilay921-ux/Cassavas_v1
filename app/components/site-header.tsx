"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Languages, Leaf, Menu, X } from "lucide-react";
import { useLanguage } from "@/app/components/language-provider";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="CassavaLink home">
      <span className="brand-mark"><Leaf size={19} strokeWidth={2.2} /></span>
      <span className="brand-copy">
        <span className="brand-name">CassavaLink</span>
        <span className="brand-tagline">Fair Price, Better Future</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { dictionary, language, toggleLanguage } = useLanguage();

  return (
    <header className={`site-header${menuOpen ? " menu-open" : ""}`}>
      <div className="container header-inner">
        <Brand />
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/marketplace">{dictionary.nav.marketplace}</Link>
          <Link href="/prices">{dictionary.nav.prices}</Link>
          <Link href="/about">{dictionary.nav.about}</Link>
          <Link href="/register">{dictionary.nav.join}</Link>
        </nav>
        <div className="header-actions">
          <button className="lang-button" onClick={toggleLanguage} aria-label="Change language">
            <Languages size={15} /> {language === "en" ? "EN / LO" : "LO / EN"}
          </button>
          <Link className="login-link" href="/login">{dictionary.nav.login}</Link>
          <Link className="button button-primary" href="/register">
            {dictionary.nav.join} <ArrowUpRight size={15} />
          </Link>
          <button
            className="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={dictionary.nav.menu}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>
    </header>
  );
}