import React, { useState, useEffect } from 'react';
import { Badge } from './components/Badge';
import { DecisionModal } from './components/DecisionModal';
import { OfficerSignIn } from './components/OfficerSignIn';
import { AdminSidebar } from '../../layouts/AdminLayout/components/AdminSidebar';
import { AdminTopbar } from '../../layouts/AdminLayout/components/AdminTopbar';
import { AdminOverview } from './components/AdminOverview';
import { MerchantApprovals } from './components/MerchantApprovals';
import { MerchantReview } from './components/MerchantReview';
import { MerchantDirectory } from './components/MerchantDirectory';
import { MerchantDetails } from './components/MerchantDetails';
import { SalesRecords } from './components/SalesRecords';
import { TaxReports } from './components/TaxReports';
import { TaxReportReview } from './components/TaxReportReview';
import { TaxRecordsLedger } from './components/TaxRecordsLedger';
import { AdminAuditLog } from './components/AdminAuditLog';
import { AdminSettings } from './components/AdminSettings';
import { API_BASE_URL } from '../../config/api';

import type {
  AdminPage,
  Decision,
  Tone,
  MerchantApplicationItem,
  TaxReportItem,
  DirectoryMerchantItem,
  AuditEventItem,
} from './types';

import styles from './Admin.module.css';

interface AdminProps {
  onReturnToMerchant?: (screen?: string) => void;
}

export const Admin: React.FC<AdminProps> = ({ onReturnToMerchant }) => {
  const [signedIn, setSignedIn] = useState(() => {
    try {
      return Boolean(localStorage.getItem('officer_token'));
    } catch {
      return false;
    }
  });
  const [currentOfficer, setCurrentOfficer] = useState<any>(() => {
    try {
      const stored = localStorage.getItem('officer_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [page, setPage] = useState<AdminPage>('overview');
  const [globalSearch, setGlobalSearch] = useState('');
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryQuery, setDirectoryQuery] = useState('');

  const [decision, setDecision] = useState<Decision | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [selectedMerchantRef, setSelectedMerchantRef] = useState('');
  const [selectedReportRef, setSelectedReportRef] = useState('TR-2026-0918');

  const [applications, setApplications] = useState<MerchantApplicationItem[]>([]);
  const [merchants, setMerchants] = useState<DirectoryMerchantItem[]>([]);
  const [liveReceipts, setLiveReceipts] = useState<any[]>([]);

  const handleSignInSuccess = (officer?: any) => {
    if (officer) {
      setCurrentOfficer(officer);
    } else {
      try {
        const stored = localStorage.getItem('officer_user');
        if (stored) setCurrentOfficer(JSON.parse(stored));
      } catch {}
    }
    setSignedIn(true);
  };

  const handleSignOut = () => {
    const token = localStorage.getItem('officer_token');
    if (token) {
      fetch(`${API_BASE_URL}/api/admin/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {});
    }
    localStorage.removeItem('officer_token');
    localStorage.removeItem('officer_user');
    setCurrentOfficer(null);
    setSignedIn(false);
  };

  const loadAdminData = () => {
    const token = localStorage.getItem('officer_token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`${API_BASE_URL}/api/admin/merchants/applications`, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setApplications(data.data);
          if (data.data.length > 0) {
            setSelectedMerchantRef((prev) => prev || data.data[0].ref);
          }
        }
      })
      .catch(() => {});

    fetch(`${API_BASE_URL}/api/admin/merchants/directory`, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setMerchants(data.data);
        }
      })
      .catch(() => {});

    fetch(`${API_BASE_URL}/api/receipts`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.receipts)) {
          setLiveReceipts(data.receipts);
        }
      })
      .catch(() => {});
  };

  // Synchronize applications, directory, and receipts from backend once authenticated
  useEffect(() => {
    if (!signedIn) return;
    loadAdminData();

    // Live sync polling every 3 seconds so registered merchants and POS receipts appear immediately
    const interval = setInterval(loadAdminData, 3000);
    const handleFocus = () => loadAdminData();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [signedIn, page]);

  const [reports, setReports] = useState<TaxReportItem[]>([]);

  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);

  const pageTitles: Record<AdminPage, string> = {
    overview: 'Overview',
    approvals: 'Merchant Approvals',
    merchantReview: 'Merchant Review',
    directory: 'Merchant Directory',
    merchantDetails: 'Merchant Details',
    sales: 'Sales Records',
    reports: 'Tax Reports',
    reportReview: 'Tax Report Review',
    taxRecords: 'Tax Records',
    audit: 'Audit Log',
    settings: 'Settings',
  };

  const getToneForStatus = (status: string): Tone => {
    if (
      status.includes('Approved') ||
      status === 'Authorized' ||
      status === 'Paid' ||
      status === 'Cleared'
    )
      return 'success';
    if (status.includes('Rejected') || status.includes('Suspended')) return 'error';
    if (
      status.includes('Review') ||
      status.includes('Pending') ||
      status.includes('Information')
    )
      return 'pending';
    return 'info';
  };

  const navigate = (target: string) => {
    setPage(target as AdminPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reviewMerchant = (ref: string) => {
    setSelectedMerchantRef(ref);
    setDecisionReason('');
    navigate('merchantReview');
  };

  const reviewReport = (ref: string) => {
    setSelectedReportRef(ref);
    setDecisionReason('');
    navigate('reportReview');
  };

  const handleToggleMerchantStatus = (merchantId: string, nextStatus: 'Active' | 'Suspended') => {
    const token = localStorage.getItem('officer_token');
    fetch(`${API_BASE_URL}/api/admin/merchants/directory/${merchantId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        status: nextStatus,
        officerName: currentOfficer?.name || 'Revenue Officer',
        reason: `Administrative ${nextStatus === 'Active' ? 'reactivation' : 'suspension'}`,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setMerchants((prev) =>
            prev.map((m) => (m.id === merchantId ? { ...m, ...data.data } : m))
          );
        }
      })
      .catch(() => {});
  };

  const selectedApplication =
    applications.find((item) => item.ref === selectedMerchantRef) ?? applications[0];

  const selectedReport =
    reports.find((item) => item.ref === selectedReportRef) ?? reports[0];

  const directoryResults = merchants.filter(
    (m) =>
      !directoryQuery ||
      `${m.tin} ${m.id} ${m.name}`.toLowerCase().includes(directoryQuery.toLowerCase())
  );

  const selectedDirectoryMerchant =
    merchants.find((m) => m.tin === directorySearch || m.id === directorySearch) ??
    merchants[0];

  const applyDecision = () => {
    if (!decision || (decision.kind !== 'approve' && !decisionReason.trim())) return;

    const nextStatus =
      decision.kind === 'approve'
        ? 'Approved'
        : decision.kind === 'request'
        ? 'Additional Information Required'
        : 'Rejected';

    const nowFormatted = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    if (decision.entity === 'merchant') {
      if (!selectedApplication) return;
      const previous = selectedApplication.status;

      let currentOfficerName = 'Revenue Officer';
      try {
        const activeOfficerRaw = localStorage.getItem('officer_user');
        if (activeOfficerRaw) {
          const parsedOff = JSON.parse(activeOfficerRaw);
          if (parsedOff.name) {
            currentOfficerName = `${parsedOff.name}${parsedOff.badgeNumber ? ` · ${parsedOff.badgeNumber}` : ''}`;
          }
        }
      } catch {}

      // Post decision to live backend
      const token = localStorage.getItem('officer_token');
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      fetch(`${API_BASE_URL}/api/admin/merchants/applications/${selectedApplication.ref}/decision`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          kind: decision.kind,
          reason: decisionReason || (decision.kind === 'approve' ? 'Verification checks completed' : 'Administrative action'),
          officerName: currentOfficerName,
        }),
      })
        .then((res) => res.json())
        .then((resData) => {
          if (resData.success) {
            // refresh directory from live backend
            fetch(`${API_BASE_URL}/api/admin/merchants/directory`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            })
              .then((r) => r.json())
              .then((d) => d.success && Array.isArray(d.data) && setMerchants(d.data))
              .catch(() => {});
          }
        })
        .catch(() => {});

      setApplications((current) =>
        current.map((item) =>
          item.ref === selectedApplication.ref ? { ...item, status: nextStatus } : item
        )
      );

      // Live sync with merchant side local profile
      try {
        const storedProfileRaw = window.localStorage.getItem('ereceipt:merchant_profile');
        if (storedProfileRaw) {
          const stored = JSON.parse(storedProfileRaw);
          if (
            stored.referenceNumber === selectedApplication.ref ||
            stored.tin === selectedApplication.tin ||
            stored.sellerLegalName === selectedApplication.name
          ) {
            stored.status = nextStatus;
            window.localStorage.setItem('ereceipt:merchant_profile', JSON.stringify(stored));
            window.dispatchEvent(new Event('ereceipt:profile_updated'));
          }
        }
      } catch (err) {
        console.warn('Failed to sync merchant profile state:', err);
      }
      setAuditEvents((current) => [
        {
          timestamp: nowFormatted,
          officer: currentOfficerName,
          action: `Merchant ${
            decision.kind === 'approve'
              ? 'approved'
              : decision.kind === 'request'
              ? 'information requested'
              : 'rejected'
          }`,
          reference: selectedApplication.ref,
          statusTransition: `${previous} → ${nextStatus}`,
          notes: decisionReason || 'Verification checks completed',
        },
        ...current,
      ]);
      navigate('approvals');
    } else {
      const previous = selectedReport.status;
      setReports((current) =>
        current.map((item) =>
          item.ref === selectedReport.ref ? { ...item, status: nextStatus } : item
        )
      );
      setAuditEvents((current) => [
        {
          timestamp: nowFormatted,
          officer: 'Hana Alemu · RO-218',
          action: `Tax report ${
            decision.kind === 'approve'
              ? 'approved'
              : decision.kind === 'request'
              ? 'information requested'
              : 'rejected'
          }`,
          reference: selectedReport.ref,
          statusTransition: `${previous} → ${nextStatus}`,
          notes: decisionReason || 'Report reconciliation reviewed',
        },
        ...current,
      ]);
      navigate('reports');
    }

    setDecision(null);
    setDecisionReason('');
  };

  if (!signedIn) {
    return (
      <OfficerSignIn
        onSuccess={handleSignInSuccess}
        onReturnToMerchant={onReturnToMerchant}
      />
    );
  }

  return (
    <div className={styles.rootContainer}>
      {/* Fixed Admin Sidebar */}
      <AdminSidebar
        currentPage={page}
        onNavigate={navigate}
        onSignOut={handleSignOut}
        officer={currentOfficer}
      />

      {/* Main Container */}
      <div className={styles.mainLayout}>
        <AdminTopbar
          title={pageTitles[page]}
          globalSearch={globalSearch}
          onGlobalSearchChange={setGlobalSearch}
          onGlobalSearchSubmit={(e) => {
            e.preventDefault();
            setDirectorySearch(globalSearch);
            setDirectoryQuery(globalSearch);
            navigate('directory');
          }}
          onProfileClick={() => navigate('settings')}
          currentPage={page}
          onNavigate={navigate}
          officer={currentOfficer}
        />

        <main className={styles.mainContent}>
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.headingTitle}>{pageTitles[page]}</h1>
              <p className={styles.headingCopy}>
                Ministry of Revenues Authorized Officer Workspace · Real-time clearance and compliance ledger
              </p>
            </div>
            <Badge tone="success">MoR EIMS Active</Badge>
          </div>

          {page === 'overview' && (
            <AdminOverview
              applications={applications}
              reports={reports}
              auditEvents={auditEvents}
              receipts={liveReceipts}
              onReviewMerchant={reviewMerchant}
              onReviewReport={reviewReport}
              onNavigateToApprovals={() => navigate('approvals')}
              onNavigateToReports={() => navigate('reports')}
              onNavigateToSales={() => navigate('sales')}
              getToneForStatus={getToneForStatus}
            />
          )}

          {page === 'approvals' && (
            <MerchantApprovals
              applications={applications}
              onReviewMerchant={reviewMerchant}
              getToneForStatus={getToneForStatus}
            />
          )}

          {page === 'merchantReview' && (
            <MerchantReview
              application={selectedApplication}
              onBack={() => navigate('approvals')}
              onOpenDecision={setDecision}
              getToneForStatus={getToneForStatus}
            />
          )}

          {page === 'directory' && (
            <MerchantDirectory
              merchants={directoryResults}
              searchQuery={directorySearch}
              onSearchQueryChange={setDirectorySearch}
              onSearchSubmit={() => setDirectoryQuery(directorySearch)}
              onViewDetails={(tin) => {
                setDirectorySearch(tin);
                navigate('merchantDetails');
              }}
              getToneForStatus={getToneForStatus}
            />
          )}

          {page === 'merchantDetails' && (
            <MerchantDetails
              merchant={selectedDirectoryMerchant}
              onBack={() => navigate('directory')}
              onToggleStatus={handleToggleMerchantStatus}
              renderSales={() => <SalesRecords />}
              renderTaxRecords={() => (
                <TaxRecordsLedger
                  onSelectMerchant={(merchantName) => {
                    const match = merchants.find((m) => m.name === merchantName);
                    if (match) {
                      setDirectorySearch(match.tin);
                      navigate('merchantDetails');
                    }
                  }}
                  getToneForStatus={getToneForStatus}
                />
              )}
              getToneForStatus={getToneForStatus}
            />
          )}

          {page === 'sales' && <SalesRecords />}

          {page === 'reports' && (
            <TaxReports
              reports={reports}
              onReviewReport={reviewReport}
              getToneForStatus={getToneForStatus}
            />
          )}

          {page === 'reportReview' && (
            <TaxReportReview
              report={selectedReport}
              onBack={() => navigate('reports')}
              onOpenDecision={setDecision}
            />
          )}

          {page === 'taxRecords' && (
            <TaxRecordsLedger
              onSelectMerchant={(merchantName) => {
                const match = merchants.find((m) => m.name === merchantName);
                if (match) {
                  setDirectorySearch(match.tin);
                  navigate('merchantDetails');
                }
              }}
              getToneForStatus={getToneForStatus}
            />
          )}

          {page === 'audit' && <AdminAuditLog auditEvents={auditEvents} />}

          {page === 'settings' && <AdminSettings />}
        </main>
      </div>

      {/* Decision Modal */}
      {decision && (
        <DecisionModal
          decision={decision}
          reason={decisionReason}
          onReasonChange={setDecisionReason}
          onCancel={() => setDecision(null)}
          onConfirm={applyDecision}
        />
      )}
    </div>
  );
};

export default Admin;
