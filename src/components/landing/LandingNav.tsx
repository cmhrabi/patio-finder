import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/Logo';
import styles from './LandingNav.module.css';

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: 'Map', href: '/map' },
  { label: 'Patios', href: '#' },
  { label: 'Favourites', href: '#' },
  { label: 'About', href: '#' },
];

export function LandingNav() {
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
        <button type="button" className={styles.signIn}>
          Sign in
        </button>
        <Link href="/map" className={styles.cta}>
          Open map
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
