import React, { useState, useEffect } from 'react';
import { QuickActionGrid } from './components/QuickActionGrid';
import { getStoredMerchantProfile } from '../merchant-registration';
import styles from './Overview.module.css';

export interface OverviewProps {
  onNavigate?: (screen: string) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getLiveDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export const Overview: React.FC<OverviewProps> = ({ onNavigate }) => {
  const [profile, setProfile] = useState(() => getStoredMerchantProfile());
  const [liveDate, setLiveDate] = useState(getLiveDate());

  useEffect(() => {
    const handleProfileUpdate = () => setProfile(getStoredMerchantProfile());
    window.addEventListener('ereceipt:profile_updated', handleProfileUpdate);
    return () => window.removeEventListener('ereceipt:profile_updated', handleProfileUpdate);
  }, []);

  // Update date at midnight
  useEffect(() => {
    const msUntilMidnight =
      new Date(new Date().toDateString()).getTime() + 86400000 - Date.now();
    const timer = setTimeout(() => setLiveDate(getLiveDate()), msUntilMidnight);
    return () => clearTimeout(timer);
  }, [liveDate]);

  const firstName = profile.fullName
    ? profile.fullName.split(' ')[0]
    : profile.tradeName
    ? profile.tradeName.split(' ')[0]
    : 'Merchant';
  const tradeName = profile.tradeName || profile.sellerLegalName || 'your business';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.dateTag}>{liveDate}</span>
        <h1 className={styles.heading}>{getGreeting()}, {firstName}</h1>
        <p className={styles.subheading}>
          Real-time MoR EIMS clearance is active for {tradeName}.
        </p>
      </div>

      {/* 2x2 Quick Actions Grid */}
      <QuickActionGrid onNavigate={onNavigate} />
    </div>
  );
};

export default Overview;
