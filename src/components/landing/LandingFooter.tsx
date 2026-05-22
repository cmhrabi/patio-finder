import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import styles from './LandingFooter.module.css';

export function LandingFooter() {
  return (
    <footer className={styles.root}>
      <span className={styles.brandLine}>
        Golden Hour · made for sunny Toronto
      </span>
      <nav className={styles.links} aria-label="Footer">
        <Link href="https://github.com" target="_blank" rel="noreferrer noopener" className={styles.link}>
          GitHub <ArrowUpRight size={12} aria-hidden="true" />
        </Link>
        <Link href="#" className={styles.link}>Patio data</Link>
        <Link href="#" className={styles.link}>Privacy</Link>
      </nav>
    </footer>
  );
}
