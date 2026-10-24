import React, { useState, useEffect } from 'react';
import { Badge } from './Badge';
import { API_BASE_URL } from '../../../config/api';
import styles from './SalesRecords.module.css';

interface LiveReceipt {
  id?: string;
  irn?: string;
  receiptNumber?: string;
  createdAt?: string;
  clearanceTimestamp?: string;
  total?: number;
  subtotal?: number;
  tax?: number;
  status?: string;
  documentType?: string;
}

export const SalesRecords: React.FC = () => {
  const [searchReceipt, setSearchReceipt] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [liveReceipts, setLiveReceipts] = useState<LiveReceipt[]>([]);

  useEffect(() => {
    const fetchReceipts = () => {
      fetch(`${API_BASE_URL}/api/receipts`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.receipts)) {
            setLiveReceipts(data.receipts);
          }
        })
        .catch(() => {});
    };

    fetchReceipts();
    const interval = setInterval(fetchReceipts, 3000);
    window.addEventListener('focus', fetchReceipts);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchReceipts);
    };
  }, []);

  const baseSalesRows: [string, string, string, string, string, string][] = [
    ['AM2081-REG01-2026-000194', '20 Oct 2026 · 16:01', 'ETB 1,895.20', 'ETB 1,648.00', 'ETB 247.20', 'Cleared'],
    ['AM2081-REG01-2026-000193', '20 Oct 2026 · 15:42', 'ETB 3,450.00', 'ETB 3,000.00', 'ETB 450.00', 'Cleared'],
    ['AM2081-REG01-2026-000192', '20 Oct 2026 · 14:18', 'ETB 875.50', 'ETB 761.30', 'ETB 114.20', 'Cleared'],
    ['AM2081-REG01-2026-000191', '20 Oct 2026 · 13:05', 'ETB 1,940.00', 'ETB 1,686.96', 'ETB 253.04', 'Credit note'],
  ];

  // Map newly issued receipts into table format
  const dynamicRows: [string, string, string, string, string, string][] = liveReceipts.map((r) => {
    const recNum = r.receiptNumber || r.irn || 'REC-CLEARED';
    const dateStr = r.clearanceTimestamp || r.createdAt
      ? new Date(r.clearanceTimestamp || r.createdAt!).toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).replace(',', ' ·')
      : 'Just now';
    const totalStr = `ETB ${(r.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const subtotalStr = `ETB ${(r.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const taxStr = `ETB ${(r.tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const statusStr = r.status === 'CLEARED' ? 'Cleared' : r.documentType?.includes('Credit') ? 'Credit note' : 'Cleared';
    return [recNum, dateStr, totalStr, subtotalStr, taxStr, statusStr];
  });

  const allRows = [...dynamicRows, ...baseSalesRows];

  const filteredRows = allRows.filter((r) =>
    searchReceipt.trim() === '' || r[0].toLowerCase().includes(searchReceipt.toLowerCase())
  );

  const totalSalesVal = 12604300 + liveReceipts.reduce((acc, r) => acc + (r.total || 0), 0);
  const taxableVal = 10960261 + liveReceipts.reduce((acc, r) => acc + (r.subtotal || 0), 0);
  const taxVal = 1644039 + liveReceipts.reduce((acc, r) => acc + (r.tax || 0), 0);

  return (
    <div className={styles.container}>
      {/* 3 Metric Cards */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Recorded sales</p>
          <p className={styles.metricValue}>ETB {totalSalesVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Taxable amount</p>
          <p className={styles.metricValue}>ETB {taxableVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Recorded tax</p>
          <p className={styles.metricValue}>ETB {taxVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Table Card */}
      <div className={styles.tableCard}>
        <div className={styles.controlsRow}>
          <input
            className={styles.searchInput}
            placeholder="Search receipt number"
            value={searchReceipt}
            onChange={(e) => setSearchReceipt(e.target.value)}
          />
          <input
            type="date"
            className={styles.dateInput}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="date"
            className={styles.dateInput}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                {[
                  'Receipt Number',
                  'Transaction Date',
                  'Total Sales',
                  'Taxable Amount',
                  'Tax Amount',
                  'Receipt Status',
                ].map((item) => (
                  <th key={item} className={styles.th}>
                    {item}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td
                      key={cell}
                      className={`${styles.td} ${
                        index > 1 && index < 5 ? styles.tdNumber : ''
                      }`}
                    >
                      {index === 5 ? (
                        <Badge tone={cell === 'Cleared' ? 'success' : 'pending'}>
                          {cell}
                        </Badge>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.noticeBar}>
          Historical receipts are read-only. Any permitted correction requires a documented reason
          and audit event.
        </div>
      </div>
    </div>
  );
};

export default SalesRecords;
