import React from 'react';
import { Home, History, Plus, Database, Settings } from 'lucide-react';
import styles from './MobileBottomNav.module.css';

interface MobileBottomNavProps {
  activeScreen?: string;
  onNavigate?: (screen: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeScreen = 'dashboard',
  onNavigate,
}) => {
  const isPos = activeScreen === 'pos' || activeScreen === 'receipt-issuance';

  return (
    <nav className={styles.bottomNavContainer} aria-label="Mobile Navigation">
      {/* 1. Home / Overview */}
      <button
        type="button"
        className={`${styles.navItem} ${activeScreen === 'dashboard' ? styles.navItemActive : ''}`}
        onClick={() => onNavigate?.('dashboard')}
        aria-label="Home Dashboard"
      >
        {activeScreen === 'dashboard' && <span className={styles.activeIndicator} />}
        <div className={styles.iconWrapper}>
          <Home size={22} strokeWidth={activeScreen === 'dashboard' ? 2.5 : 1.8} />
        </div>
        <span className={styles.navLabel}>Home</span>
      </button>

      {/* 2. Transactions / Sales */}
      <button
        type="button"
        className={`${styles.navItem} ${activeScreen === 'sales' ? styles.navItemActive : ''}`}
        onClick={() => onNavigate?.('sales')}
        aria-label="Sales Transactions"
      >
        {activeScreen === 'sales' && <span className={styles.activeIndicator} />}
        <div className={styles.iconWrapper}>
          <History size={22} strokeWidth={activeScreen === 'sales' ? 2.5 : 1.8} />
        </div>
        <span className={styles.navLabel}>Sales</span>
      </button>

      {/* 3. Center Hero Action: Issue Receipt */}
      <div className={styles.centerIssueWrapper}>
        <button
          type="button"
          className={`${styles.centerIssueButton} ${isPos ? styles.centerIssueActive : ''}`}
          onClick={() => onNavigate?.('pos')}
          aria-label="Issue New Receipt"
        >
          <Plus size={28} strokeWidth={2.8} />
        </button>
        <span className={styles.centerIssueLabel}>Issue</span>
      </div>

      {/* 4. Fiscal Audit Ledger */}
      <button
        type="button"
        className={`${styles.navItem} ${activeScreen === 'audit' ? styles.navItemActive : ''}`}
        onClick={() => onNavigate?.('audit')}
        aria-label="Fiscal Audit"
      >
        {activeScreen === 'audit' && <span className={styles.activeIndicator} />}
        <div className={styles.iconWrapper}>
          <Database size={22} strokeWidth={activeScreen === 'audit' ? 2.5 : 1.8} />
        </div>
        <span className={styles.navLabel}>Audit</span>
      </button>

      {/* 5. Settings */}
      <button
        type="button"
        className={`${styles.navItem} ${activeScreen === 'settings' ? styles.navItemActive : ''}`}
        onClick={() => onNavigate?.('settings')}
        aria-label="Merchant Settings"
      >
        {activeScreen === 'settings' && <span className={styles.activeIndicator} />}
        <div className={styles.iconWrapper}>
          <Settings size={22} strokeWidth={activeScreen === 'settings' ? 2.5 : 1.8} />
        </div>
        <span className={styles.navLabel}>Settings</span>
      </button>
    </nav>
  );
};

export default MobileBottomNav;
