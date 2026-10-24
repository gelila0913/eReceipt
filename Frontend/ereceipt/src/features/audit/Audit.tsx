import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout/DashboardLayout';
import AuditFilterBar from './components/AuditFilterBar';
import MonthlyRecordsTable from './components/MonthlyRecordsTable';
import { getStoredMerchantProfile } from '../merchant-registration';
import { getMerchantAuditRecords } from '../../services/merchantDataStore';
import { TaxInvoicePreview } from '../tax-invoice-preview';
import { OverviewDashboard } from '../dashboard';
import { TransactionsLedger } from '../transactions';
import { SettingsVerticalNav, type SettingsTabId } from '../settings/components/SettingsVerticalNav';
import { BusinessProfileTab } from '../settings/components/tabs/BusinessProfileTab';
import { ReceiptIssuanceContent } from '../receipt-issuance';
import styles from './Audit.module.css';

interface AuditProps {
  initialScreen?: string;
  onNavigate?: (screen: string) => void;
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const Audit: React.FC<AuditProps> = ({ initialScreen = 'dashboard', onNavigate }) => {
  const [activeScreen, setActiveScreen] = useState<string>(initialScreen);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>(() => {
    const saved = window.sessionStorage.getItem('ereceipt_settings_tab') as SettingsTabId | null;
    return saved && ['profile', 'preferences', 'notifications', 'security'].includes(saved)
      ? saved
      : 'profile';
  });

  const handleSettingsTabChange = (tab: SettingsTabId) => {
    setSettingsTab(tab);
    window.sessionStorage.setItem('ereceipt_settings_tab', tab);
  };

  // Authenticated merchant isolation
  const [merchantProfile, setMerchantProfile] = useState(() => getStoredMerchantProfile());
  const merchantTin = merchantProfile.tin;
  const businessName = merchantProfile.sellerLegalName || merchantProfile.tradeName || (merchantTin ? `Merchant (${merchantTin})` : 'Merchant');

  useEffect(() => {
    if (initialScreen) {
      setActiveScreen(initialScreen);
      window.sessionStorage.setItem('ereceipt_active_screen', initialScreen);
    }
  }, [initialScreen]);

  useEffect(() => {
    const handleProfileUpdate = () => {
      setMerchantProfile(getStoredMerchantProfile());
    };
    window.addEventListener('ereceipt:profile_updated', handleProfileUpdate);
    return () => window.removeEventListener('ereceipt:profile_updated', handleProfileUpdate);
  }, []);

  // Audit state
  const [auditStartDate, setAuditStartDate] = useState('2026-01-01');
  const [auditEndDate, setAuditEndDate] = useState('2026-10-31');
  const [calculatedTax, setCalculatedTax] = useState<number | null>(null);
  const [taxApproved, setTaxApproved] = useState(false);

  const [visibleAuditMonths, setVisibleAuditMonths] = useState(() =>
    merchantTin ? getMerchantAuditRecords(merchantTin, auditStartDate, auditEndDate) : []
  );

  useEffect(() => {
    const refreshRecords = () => {
      if (!merchantTin) {
        setVisibleAuditMonths([]);
        return;
      }
      setVisibleAuditMonths(getMerchantAuditRecords(merchantTin, auditStartDate, auditEndDate));
    };

    refreshRecords();

    const handleReceiptsUpdated = () => {
      refreshRecords();
    };

    window.addEventListener('ereceipt:receipts_updated', handleReceiptsUpdated);
    return () => {
      window.removeEventListener('ereceipt:receipts_updated', handleReceiptsUpdated);
    };
  }, [merchantTin, auditStartDate, auditEndDate]);

  const handleCalculateTax = () => {
    const total = visibleAuditMonths.reduce((sum, item) => sum + item.tax, 0);
    setCalculatedTax(total);
    setTaxApproved(false);
  };

  const handleApproveTax = () => {
    setTaxApproved(true);
  };

  const handleDownloadReport = () => {
    if (calculatedTax === null) return;
    const csvRows = [
      ['Month', 'Income ETB', 'Expenses ETB', 'Tax ETB'],
      ...visibleAuditMonths.map((record) => [
        record.month,
        record.income.toFixed(2),
        record.expenses.toFixed(2),
        record.tax.toFixed(2),
      ]),
      ['Total approved tax', '', '', calculatedTax.toFixed(2)],
    ];
    downloadCsv('approved-tax-calculation-report.csv', csvRows);
  };

  const handleSidebarNavigate = (screen: string) => {
    if (screen === 'registration' || screen === 'register') {
      onNavigate?.('registration');
      return;
    }
    if (screen === 'admin') {
      onNavigate?.('admin');
      return;
    }
    if (screen === 'signin' || screen === 'login' || screen === 'signout' || screen === 'logout') {
      window.sessionStorage.removeItem('ereceipt_active_screen');
      onNavigate?.('signin');
      return;
    }
    if (screen === 'landing' || screen === 'home') {
      window.sessionStorage.removeItem('ereceipt_active_screen');
      onNavigate?.('landing');
      return;
    }
    const resolvedScreen = screen === 'receipt-issuance' ? 'pos' : screen;
    setActiveScreen(resolvedScreen);
    window.sessionStorage.setItem('ereceipt_active_screen', resolvedScreen);
    window.sessionStorage.setItem('ereceipt_active_view', 'merchant');
    try {
      window.history.replaceState(
        { view: 'merchant', screen: resolvedScreen },
        '',
        `?view=merchant&screen=${resolvedScreen}`
      );
    } catch {
      // ignore
    }
    onNavigate?.(resolvedScreen);
  };

  return (
    <DashboardLayout activeScreen={activeScreen} onNavigate={handleSidebarNavigate}>
      {activeScreen === 'audit' && (
        <>
          <div className={styles.pageHead}>
            <div>
              <p className={styles.eyebrow}>Monthly tax review</p>
              <h1 className={styles.title}>Audit</h1>
              <p className={styles.copy}>
                Review verified monthly income, expenses, and tax records for {businessName} (TIN: {merchantTin}).
              </p>
            </div>
          </div>

          <AuditFilterBar
            startDate={auditStartDate}
            endDate={auditEndDate}
            onStartDateChange={(val) => {
              setAuditStartDate(val);
              setCalculatedTax(null);
              setTaxApproved(false);
            }}
            onEndDateChange={(val) => {
              setAuditEndDate(val);
              setCalculatedTax(null);
              setTaxApproved(false);
            }}
            onCalculateTax={handleCalculateTax}
            calculatedTax={calculatedTax}
            taxApproved={taxApproved}
            onApproveTax={handleApproveTax}
            onDownloadReport={handleDownloadReport}
            monthCount={visibleAuditMonths.length}
          />

          <MonthlyRecordsTable
            records={visibleAuditMonths}
            startDate={auditStartDate}
            endDate={auditEndDate}
          />
        </>
      )}

      {activeScreen === 'receipt' && (
        <TaxInvoicePreview onNavigate={handleSidebarNavigate} />
      )}

      {activeScreen === 'settings' && (
        <>
          <div className={styles.pageHead}>
            <div>
              <p className={styles.eyebrow}>Account & Organization</p>
              <h1 className={styles.title}>Merchant Settings</h1>
              <p className={styles.copy}>
                Manage your verified tax credentials, company profile, and notification preferences.
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '240px 1fr',
              gap: '32px',
              marginTop: '20px',
              alignItems: 'flex-start',
            }}
          >
            <aside style={{ position: 'sticky', top: '24px' }}>
              <SettingsVerticalNav activeTab={settingsTab} onTabChange={handleSettingsTabChange} />
            </aside>

            <div style={{ minWidth: 0 }}>
              {settingsTab === 'profile' && <BusinessProfileTab />}
              {settingsTab === 'preferences' && (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #DDE3DE',
                    borderRadius: '12px',
                    padding: '32px',
                  }}
                >
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#17201B' }}>
                    System Preferences
                  </h2>
                  <p style={{ margin: 0, fontSize: '14px', color: '#526059' }}>
                    Configure default currency (ETB), fiscal calendar, and language preferences.
                  </p>
                </div>
              )}
              {settingsTab === 'notifications' && (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #DDE3DE',
                    borderRadius: '12px',
                    padding: '32px',
                  }}
                >
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#17201B' }}>
                    Compliance Notifications
                  </h2>
                  <p style={{ margin: 0, fontSize: '14px', color: '#526059' }}>
                    Manage SMS and Email alerts for tax report deadlines and receipt clearances.
                  </p>
                </div>
              )}
              {settingsTab === 'security' && (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #DDE3DE',
                    borderRadius: '12px',
                    padding: '32px',
                  }}
                >
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#17201B' }}>
                    Security & API Keys
                  </h2>
                  <p style={{ margin: 0, fontSize: '14px', color: '#526059' }}>
                    Manage Ministry of Revenue EIMS clearance credentials and digital signature keys.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeScreen === 'dashboard' && (
        <OverviewDashboard onNavigate={handleSidebarNavigate} />
      )}

      {activeScreen === 'pos' && (
        <ReceiptIssuanceContent onNavigate={handleSidebarNavigate} />
      )}

      {activeScreen === 'sales' && (
        <TransactionsLedger />
      )}
    </DashboardLayout>
  );
};

export default Audit;
