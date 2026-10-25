import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import MobileAppHeader from './components/MobileAppHeader';
import MobileBottomNav from './components/MobileBottomNav';
import styles from './DashboardLayout.module.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeScreen?: string;
  onNavigate?: (screen: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeScreen = 'audit',
  onNavigate,
}) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className={styles.layoutContainer}>
      {/* 1. Mobile-First App Header (Visible on screens <= 768px) */}
      <MobileAppHeader
        activeScreen={activeScreen}
        onNavigate={onNavigate}
      />

      {/* 2. Desktop Sidebar (Drawers on mobile if explicitly opened) */}
      <Sidebar
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        activeScreen={activeScreen}
        onNavigate={onNavigate}
      />

      <div className={styles.mainWrapper}>
        {/* 3. Desktop Topbar (Hidden on mobile) */}
        <div className={styles.desktopTopbar}>
          <Topbar
            onToggleMobileMenu={() => setMobileNavOpen(!mobileNavOpen)}
            onNavigate={onNavigate}
          />
        </div>

        {/* 4. Scrollable Main Content Area */}
        <main className={styles.contentArea}>{children}</main>
      </div>

      {/* 5. Mobile Native Bottom Navigation Bar (Fixed bottom on <= 768px) */}
      <MobileBottomNav
        activeScreen={activeScreen}
        onNavigate={onNavigate}
      />
    </div>
  );
};

export default DashboardLayout;
