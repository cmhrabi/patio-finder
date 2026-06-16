'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import styles from './LandingNav.module.css';

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: 'Map', href: '/map' },
  { label: 'Patios', href: '#' },
  { label: 'Favourites', href: '#' },
  { label: 'About', href: '#' },
];

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <header className={styles.root}>
      <Link href="/" className={styles.brand} aria-label="Golden Hour — home">
        <Logo size={26} />
      </Link>

      <nav className={styles.links} aria-label="Primary">
        {NAV_LINKS.map((l) => (
          <Link key={l.label} href={l.href} className={styles.link}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={styles.actions}>
        <Link href="/map" className={styles.cta}>
          Open map
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <button
          type="button"
          className={styles.menuButton}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="landing-mobile-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </div>

      {menuOpen ? (
        <>
          <button
            type="button"
            className={styles.drawerBackdrop}
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div id="landing-mobile-menu" className={styles.drawer} role="dialog" aria-modal="true">
            <div className={styles.drawerHead}>
              <span className={styles.drawerLabel}>Menu</span>
              <button
                type="button"
                className={styles.drawerClose}
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <nav className={styles.drawerLinks} aria-label="Primary mobile">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className={styles.drawerLink}
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      ) : null}
    </header>
  );
}
