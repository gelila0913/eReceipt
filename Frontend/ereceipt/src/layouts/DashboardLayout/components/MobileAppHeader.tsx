import React, { useState, useEffect } from 'react';
import { X, LogOut, Settings, History, LayoutDashboard, Database, ShoppingBag, ShieldCheck } from 'lucide-react';
import { getStoredMerchantProfile, clearStoredMerchantProfile } from '../../../features/merchant-registration';
import styles from './MobileAppHeader.module.css';

interface MobileAppHeaderProps {
  activeScreen?: string;
  onNavigate?: (screen: string) => void;
}

export const MobileAppHeader: React.FC<MobileAppHeaderProps> = ({ activeScreen = 'dashboard', onNavigate }) => {
  const [profile, setProfile] = useState(() => getStoredMerchantProfile());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const handleUpdate = () => setProfile(getStoredMerchantProfile());
    window.addEventListener('ereceipt:profile_updated', handleUpdate);
    return () => window.removeEventListener('ereceipt:profile_updated', handleUpdate);
  }, []);

  const merchantInitials = profile.tradeName
    ? profile.tradeName
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'ME';

  const handleNavClick = (screen: string) => {
    setIsDrawerOpen(false);
    onNavigate?.(screen);
  };

  const handleSignOut = () => {
    setIsDrawerOpen(false);
    clearStoredMerchantProfile();
    onNavigate?.('signin');
  };

  return (
    <>
      <header className={styles.mobileHeader}>
        <div className={styles.brandGroup} onClick={() => onNavigate?.('dashboard')}>
          <img
            src="/logo-icon.png"
            alt="eReceipt Logo"
            className={styles.logoImage}
            onError={(e) => {
              // Fallback to text if asset fails
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div className={styles.brandTitles}>
            <span className={styles.appTitle}>eReceipt</span>
            <span className={styles.appSubtitle}>Merchant App</span>
          </div>
        </div>

        <div className={styles.rightGroup}>
          <div className={styles.statusBadge}>
            <span className={styles.statusDot} />
            <span>Active</span>
          </div>

          <button
            type="button"
            className={styles.avatarBtn}
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open merchant menu"
          >
            {merchantInitials}
          </button>
        </div>
      </header>

      {/* Drawer Menu */}
      {isDrawerOpen && (
        <>
          <div
            className={styles.menuBackdrop}
            onClick={() => setIsDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className={styles.mobileDrawer} role="dialog" aria-modal="true">
            <div className={styles.drawerHeader}>
              <h3 className={styles.drawerTitle}>Merchant Profile</h3>
              <button
                type="button"
                className={styles.drawerCloseBtn}
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.merchantSummary}>
              <p className={styles.merchantTrade}>{profile.tradeName || 'Merchant Business'}</p>
              <p className={styles.merchantTin}>TIN: {profile.tin || 'Unverified'}</p>
              <div className={styles.statusBadge}>
                <ShieldCheck size={13} color="#065F46" />
                <span>MoR Accredited Merchant</span>
              </div>
            </div>

            <nav className={styles.drawerNavList}>
              <button
                type="button"
                className={`${styles.drawerNavItem} ${activeScreen === 'dashboard' ? styles.drawerNavItemActive : ''}`}
                onClick={() => handleNavClick('dashboard')}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard Overview</span>
              </button>

              <button
                type="button"
                className={`${styles.drawerNavItem} ${activeScreen === 'pos' ? styles.drawerNavItemActive : ''}`}
                onClick={() => handleNavClick('pos')}
              >
                <ShoppingBag size={18} />
                <span>Issue Receipt (POS)</span>
              </button>

              <button
                type="button"
                className={`${styles.drawerNavItem} ${activeScreen === 'sales' ? styles.drawerNavItemActive : ''}`}
                onClick={() => handleNavClick('sales')}
              >
                <History size={18} />
                <span>Transactions & Sales</span>
              </button>

              <button
                type="button"
                className={`${styles.drawerNavItem} ${activeScreen === 'audit' ? styles.drawerNavItemActive : ''}`}
                onClick={() => handleNavClick('audit')}
              >
                <Database size={18} />
                <span>Fiscal Audit Ledger</span>
              </button>

              <button
                type="button"
                className={`${styles.drawerNavItem} ${activeScreen === 'settings' ? styles.drawerNavItemActive : ''}`}
                onClick={() => handleNavClick('settings')}
              >
                <Settings size={18} />
                <span>Business Settings</span>
              </button>

              <button
                type="button"
                className={`${styles.drawerNavItem} ${styles.drawerSignOut}`}
                onClick={handleSignOut}
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </nav>
          </aside>
        </>
      )}
    </>
  );
};

export default MobileAppHeader;
