import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { TransactionsTable } from './components/TransactionsTable';
import { TransactionDetailsModal } from './components/TransactionDetailsModal';
import type { MonthlyTransactionSummary } from './types/TransactionTypes';
import {
  getMerchantMonthlyLedger,
  syncMerchantReceipts,
} from '../../services/merchantDataStore';
import { getStoredMerchantProfile } from '../merchant-registration';
import styles from './TransactionsView.module.css';

export interface TransactionsViewProps {
  onNavigate?: (screen: string) => void;
}

function computeMerchantRecords(): MonthlyTransactionSummary[] {
  const profile = getStoredMerchantProfile();
  const tin = profile.tin?.trim() || '';
  if (!tin) return [];
  const ledger = getMerchantMonthlyLedger(tin);
  return ledger.map((rec) => ({
    id: rec.id,
    month: rec.month,
    year: String(rec.year),
    totalIncome: rec.totalIncome,
    totalTax: rec.totalTax,
    expenses: rec.expenses,
    receiptCount: rec.invoicesCount,
    clearanceBatch: `MOR-CLR-${rec.monthKey.replace('-', '')}`,
    clearedRate: 100,
  }));
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ onNavigate }) => {
  const [selectedRecord, setSelectedRecord] = useState<MonthlyTransactionSummary | null>(null);
  const currentYearStr = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [records, setRecords] = useState<MonthlyTransactionSummary[]>(computeMerchantRecords);

  useEffect(() => {
    const profile = getStoredMerchantProfile();
    if (profile.tin) {
      syncMerchantReceipts(profile.tin).then(() => {
        setRecords(computeMerchantRecords());
      });
    }

    const handleUpdate = () => setRecords(computeMerchantRecords());
    window.addEventListener('ereceipt:receipts_updated', handleUpdate);
    return () => window.removeEventListener('ereceipt:receipts_updated', handleUpdate);
  }, []);

  // Export CSV handler
  const handleExportMonthlyReport = () => {
    const yearRecords = records.filter((r) => r.year === selectedYear);
    const headers = [
      'Month',
      'Year',
      'Total Income (ETB)',
      'Total Tax (ETB)',
      'Expenses (ETB)',
      'Net Balance (ETB)',
      'Cleared Receipts',
      'Clearance Batch',
      'MoR Status',
    ];

    const rows = yearRecords.map((r: MonthlyTransactionSummary) => [
      r.month,
      r.year,
      r.totalIncome.toFixed(2),
      r.totalTax.toFixed(2),
      r.expenses.toFixed(2),
      (r.totalIncome - r.expenses - r.totalTax).toFixed(2),
      String(r.receiptCount || 0),
      r.clearanceBatch || 'MOR-CLR-REAL',
      'Cleared (Real-Time)',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell: string) => `"${cell.replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monthly-transactions-report-${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Transactions</h1>
          <p className={styles.subtitle}>
            Review monthly income, tax, and expenses from cleared fiscal records.
          </p>
        </div>

        {/* Export monthly report CTA */}
        <button
          type="button"
          onClick={handleExportMonthlyReport}
          className={styles.exportBtn}
          disabled={records.length === 0}
        >
          <Download size={18} className={styles.exportIcon} />
          <span>Export monthly report</span>
        </button>
      </div>

      {/* Main Card with Filter Bar and Table */}
      <TransactionsTable
        records={records}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        onViewDetails={(record) => setSelectedRecord(record)}
      />

      {/* Details Modal on clicking View details */}
      <TransactionDetailsModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onViewInvoice={() => onNavigate?.('receipt')}
      />
    </div>
  );
};

export default TransactionsView;
