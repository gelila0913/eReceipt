import React, { useState } from 'react';
import { SettingsVerticalNav, type SettingsTabId } from './components/SettingsVerticalNav';
import { BusinessProfileTab } from './components/tabs/BusinessProfileTab';
import styles from './Settings.module.css';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(() => {
    const saved = window.sessionStorage.getItem('ereceipt_settings_tab') as SettingsTabId | null;
    return saved && ['profile', 'preferences', 'notifications', 'security'].includes(saved)
      ? saved
      : 'profile';
  });

  const handleTabChange = (tab: SettingsTabId) => {
    setActiveTab(tab);
    window.sessionStorage.setItem('ereceipt_settings_tab', tab);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Account & Organization</span>
          <h1 className={styles.title}>Merchant Settings</h1>
          <p className={styles.subtitle}>
            Manage your verified tax credentials, company profile, and notification preferences.
          </p>
        </div>
      </header>

      <div className={styles.contentGrid}>
        <aside className={styles.navColumn}>
          <SettingsVerticalNav activeTab={activeTab} onTabChange={handleTabChange} />
        </aside>

        <main className={styles.mainColumn}>
          {activeTab === 'profile' && <BusinessProfileTab />}
          {activeTab === 'preferences' && (
            <div className={styles.placeholderCard}>
              <h2>System Preferences</h2>
              <p>Configure default currency (ETB), fiscal calendar, and language preferences.</p>
            </div>
          )}
          {activeTab === 'notifications' && (
            <div className={styles.placeholderCard}>
              <h2>Compliance Notifications</h2>
              <p>Manage SMS and Email alerts for tax report deadlines and receipt clearances.</p>
            </div>
          )}
          {activeTab === 'security' && (
            <div className={styles.placeholderCard}>
              <h2>Security & API Keys</h2>
              <p>Manage Ministry of Revenue EIMS clearance credentials and digital signature keys.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Settings;
