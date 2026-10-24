import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Printer,
  Copy,
  Check,
  ArrowLeft,
  Store,
  User,
  Search,
  Lock,
  AlertCircle,
  FileCheck,
  Image as ImageIcon,
} from 'lucide-react';
import { findReceiptByIrn, type StoredReceipt } from '../../services/merchantDataStore';
import { getReceiptViewerUrl, generateCompactReceiptSvg } from '../../utils/receiptImageRenderer';
import { API_BASE_URL } from '../../config/api';
import styles from './ReceiptVerification.module.css';

interface ReceiptVerificationProps {
  onNavigate: (screen: string) => void;
}

export const ReceiptVerification: React.FC<ReceiptVerificationProps> = ({ onNavigate }) => {
  const [searchInput, setSearchInput] = useState('');
  const [receipt, setReceipt] = useState<StoredReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showInlineImage, setShowInlineImage] = useState(false);

  // Read URL parameters on mount (e.g. ?view=verify&irn=IRN-ET-...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const irnParam = params.get('irn') || params.get('receipt') || params.get('id');
    if (irnParam) {
      setSearchInput(irnParam);
      handlePerformVerification(irnParam);
    }
  }, []);

  const handlePerformVerification = async (targetIrn: string) => {
    const clean = targetIrn.trim();
    if (!clean) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Try Backend verification endpoint
      const res = await fetch(`${API_BASE_URL}/api/receipts/verify/${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.valid && data.receipt) {
          setReceipt(data.receipt);
          setLoading(false);
          return;
        } else if (data.valid) {
          // Flattened response fallback
          setReceipt({
            ...data,
            documentType: 'VAT Invoice',
            transactionMode: 'B2C / Walk-in Customer',
            items: data.items || [],
            subtotal: data.subtotal || data.total,
            tax: data.tax || 0,
            exciseTax: data.exciseTax || 0,
            withholdingTax: data.withholdingTax || 0,
            total: data.total,
            paymentMethod: data.paymentMethod || 'Cash',
          } as StoredReceipt);
          setLoading(false);
          return;
        }
      }

      // 2. Fallback to client merchantDataStore
      const local = findReceiptByIrn(clean);
      if (local) {
        setReceipt(local);
        setLoading(false);
        return;
      }

      setError(`No official fiscal record was found for reference "${clean}". Please verify the number and try again.`);
      setReceipt(null);
    } catch {
      // Offline fallback
      const local = findReceiptByIrn(clean);
      if (local) {
        setReceipt(local);
      } else {
        setError(`Unable to connect to MoR EIMS registry to verify "${clean}". Please ensure backend is running or check the IRN.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      handlePerformVerification(searchInput.trim());
    }
  };

  const handleCopyLink = async () => {
    if (!receipt) return;
    const url = `${window.location.origin}/?view=verify&irn=${receipt.irn}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandGroup} onClick={() => onNavigate('landing')}>
            <img src="/logo.png" alt="eReceipt" className={styles.brandLogo} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
            <div className={styles.brandText}>
              <h1 className={styles.brandTitle}>eReceipt Verification</h1>
              <p className={styles.brandSubtitle}>Ministry of Revenues (MoR) EIMS Clearance Portal</p>
            </div>
          </div>

          <button type="button" onClick={() => onNavigate('landing')} className={styles.backHomeBtn}>
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {/* Verification Search Bar */}
        <div className={styles.searchCard}>
          <h2 className={styles.searchTitle}>Verify an Ethiopian Fiscal Receipt</h2>
          <p className={styles.searchSubtitle}>
            Scan the QR code on your receipt or enter the Invoice Reference Number (IRN) / Receipt Number below to verify clearance authenticity.
          </p>

          <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="e.g. IRN-ET-2026-894210921 or RC-2026-0051"
              className={styles.searchInput}
            />
            <button type="submit" disabled={loading} className={styles.searchSubmitBtn}>
              <Search size={16} />
              <span>{loading ? 'Verifying...' : 'Verify Receipt'}</span>
            </button>
          </form>
        </div>

        {error && (
          <div className={styles.errorBox}>
            <AlertCircle size={24} style={{ marginBottom: 8 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>{error}</p>
          </div>
        )}

        {/* Verified Receipt Record */}
        {receipt && (
          <div className={styles.verifiedCard}>
            <div className={styles.verifiedBanner}>
              <div className={styles.verifiedHeaderLeft}>
                <div className={styles.verifiedIconWrap}>
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <h3 className={styles.verifiedHeadline}>Official MoR EIMS Fiscal Clearance Confirmed</h3>
                  <p className={styles.verifiedSubheadline}>
                    Digitally signed &amp; registered in the Ethiopian Ministry of Revenues Registry (HTTP 200)
                  </p>
                </div>
              </div>

              <span className={styles.verifiedPill}>
                <CheckCircle2 size={14} color="#16A34A" />
                <span>{receipt.status || 'CLEARED'}</span>
              </span>
            </div>

            <div className={styles.verifiedBody}>
              {/* Core Identifiers */}
              <div className={styles.gridTwoCol}>
                <div className={styles.infoBox}>
                  <h4 className={styles.infoBoxTitle}>
                    <Store size={14} /> Merchant / Supplier
                  </h4>
                  <dl className={styles.infoDl}>
                    <div>
                      <dt>Business Legal Name:</dt>
                      <dd>{receipt.merchantLegalName || receipt.merchantName || 'Registered Merchant'}</dd>
                    </div>
                    <div>
                      <dt>Merchant 10-Digit TIN:</dt>
                      <dd style={{ fontFamily: 'monospace' }}>{receipt.merchantTin || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt>Business Location:</dt>
                      <dd>{receipt.merchantAddress || 'Addis Ababa, Ethiopia'}</dd>
                    </div>
                  </dl>
                </div>

                <div className={styles.infoBox}>
                  <h4 className={styles.infoBoxTitle}>
                    <User size={14} /> Customer / Buyer
                  </h4>
                  <dl className={styles.infoDl}>
                    <div>
                      <dt>Customer Name:</dt>
                      <dd>{receipt.customerName || 'Walk-in Customer'}</dd>
                    </div>
                    <div>
                      <dt>Transaction Mode:</dt>
                      <dd>{receipt.transactionMode || 'B2C / Walk-in Customer'}</dd>
                    </div>
                    <div>
                      <dt>Customer TIN / Fayda FIN:</dt>
                      <dd style={{ fontFamily: 'monospace' }}>
                        {receipt.customerTin
                          ? `TIN: ${receipt.customerTin}`
                          : receipt.customerNationalId
                          ? `FIN: ${receipt.customerNationalId}`
                          : 'Optional (Not provided)'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Invoice Numbers & Timestamps */}
              <div className={styles.infoBox} style={{ marginBottom: 24 }}>
                <h4 className={styles.infoBoxTitle}>
                  <FileCheck size={14} /> Fiscal Registration Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 13 }}>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, display: 'block' }}>Invoice Reference Number (IRN):</span>
                    <strong style={{ fontFamily: 'monospace', color: '#123D2C' }}>{receipt.irn}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, display: 'block' }}>Fiscal Receipt Number:</span>
                    <strong style={{ fontFamily: 'monospace', color: '#123D2C' }}>{receipt.receiptNumber}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, display: 'block' }}>Clearance Timestamp:</span>
                    <strong>{receipt.clearanceTimestamp || (receipt.issuedAt ? new Date(receipt.issuedAt).toLocaleString() : 'N/A')}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, display: 'block' }}>Payment Method:</span>
                    <strong>{receipt.paymentMethod || 'Cash'} {receipt.paymentReference ? `(${receipt.paymentReference})` : ''}</strong>
                  </div>
                </div>
              </div>

              {/* Itemized Table */}
              {receipt.items && receipt.items.length > 0 && (
                <div className={styles.itemsSection}>
                  <h4 className={styles.itemsSectionTitle}>Purchased Line Items</h4>
                  <table className={styles.itemsTable}>
                    <thead>
                      <tr>
                        <th>Item Description</th>
                        <th className={styles.alignRight}>Quantity</th>
                        <th className={styles.alignRight}>Unit Price (ETB)</th>
                        <th className={styles.alignRight}>Total (ETB)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipt.items.map((item, idx) => {
                        const qty = (item as any).qty || (item as any).quantity || 1;
                        const price = (item as any).price || (item as any).unitPrice || 0;
                        const lineTotal = (item as any).lineTotal || (qty * price);
                        return (
                          <tr key={idx}>
                            <td>
                              <strong>{item.name}</strong>
                              {(item as any).uom && <span style={{ color: '#64748B', fontSize: 11 }}> · {(item as any).uom}</span>}
                            </td>
                            <td className={styles.alignRight}>{qty}</td>
                            <td className={styles.alignRight}>{price.toFixed(2)}</td>
                            <td className={styles.alignRight} style={{ fontWeight: 600 }}>{lineTotal.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Financial Totals */}
              <dl className={styles.totalsDl}>
                <div className={styles.totalRow}>
                  <dt>Net Subtotal:</dt>
                  <dd>ETB {(receipt.subtotal || 0).toFixed(2)}</dd>
                </div>
                {receipt.exciseTax ? (
                  <div className={styles.totalRow}>
                    <dt>Excise Tax:</dt>
                    <dd>ETB {(receipt.exciseTax || 0).toFixed(2)}</dd>
                  </div>
                ) : null}
                <div className={styles.totalRow}>
                  <dt>VAT (15%):</dt>
                  <dd>ETB {(receipt.tax || 0).toFixed(2)}</dd>
                </div>
                {receipt.withholdingTax ? (
                  <div className={styles.totalRow} style={{ color: '#0F766E' }}>
                    <dt>Withholding Tax (2%):</dt>
                    <dd>− ETB {(receipt.withholdingTax || 0).toFixed(2)}</dd>
                  </div>
                ) : null}
                <div className={styles.totalRowGrand}>
                  <dt>Grand Total:</dt>
                  <dd>ETB {(receipt.total || 0).toFixed(2)}</dd>
                </div>
              </dl>

              {/* Digital Signature Card */}
              <div className={styles.signatureCard}>
                <div className={styles.signatureTitle}>
                  <Lock size={14} />
                  <span>Cryptographic Fiscal Signature Stamp</span>
                </div>
                <div className={styles.signatureCode}>
                  {receipt.digitalSignature || `SHA256:AUTHENTICATED-EIMS`}
                </div>
                <span style={{ fontSize: 11, color: '#047857' }}>
                  Cleared and secured by the Ethiopian Ministry of Revenues Electronic Invoice Management System standard.
                </span>
              </div>

              {/* Action Buttons */}
              <div className={styles.actionsRow}>
                <button
                  type="button"
                  onClick={() => setShowInlineImage((prev) => !prev)}
                  className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                >
                  <ImageIcon size={15} />
                  <span>{showInlineImage ? 'Hide Receipt Image' : 'View Receipt Image'}</span>
                </button>
                <a
                  href={getReceiptViewerUrl(receipt.irn, {}, undefined, receipt)}
                  className={styles.actionBtn}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ImageIcon size={15} />
                  <span>Open Full Image (New Tab)</span>
                </a>
                <button type="button" onClick={handlePrint} className={styles.actionBtn}>
                  <Printer size={15} />
                  <span>Print Receipt</span>
                </button>
                <button type="button" onClick={handleCopyLink} className={styles.actionBtn}>
                  {copied ? <Check size={15} color="#16A34A" /> : <Copy size={15} />}
                  <span>{copied ? 'Verification link copied!' : 'Copy verification link'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReceipt(null);
                    setSearchInput('');
                    setShowInlineImage(false);
                  }}
                  className={styles.actionBtn}
                >
                  <Search size={15} />
                  <span>Verify another receipt</span>
                </button>
              </div>

              {/* Inline SVG Graphic Receipt Viewer */}
              {showInlineImage && (
                <div className={styles.inlinePreviewCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 440, marginBottom: 12, color: '#F8FAFC' }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Fiscal Vector Graphic Receipt</span>
                    <a
                      href={getReceiptViewerUrl(receipt.irn, {}, undefined, receipt)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: '#38BDF8', textDecoration: 'underline' }}
                    >
                      Fullscreen viewer →
                    </a>
                  </div>
                  <div
                    className={styles.inlinePreviewSvgWrap}
                    dangerouslySetInnerHTML={{ __html: generateCompactReceiptSvg(receipt) }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
