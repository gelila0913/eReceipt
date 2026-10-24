import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Landmark,
  Store,
  MapPin,
  ShieldCheck,
  Printer,
  Copy,
  Check,
  Languages,
  Plus,
  Image as ImageIcon,
  Download,
  ExternalLink,
  FileText,
} from 'lucide-react';
import type { IssuedReceipt } from '../types';
import {
  formatMoney,
  amountInWords,
  amountInAmharic,
  netLineAmount,
  lineExcise,
} from '../types';
import { getStoredMerchantProfile } from '../../merchant-registration';
import { QRCodeSVG } from 'qrcode.react';
import {
  downloadReceiptAsPng,
  getReceiptImageUrl,
  getReceiptViewerUrl,
  generateReceiptDataUri,
} from '../../../utils/receiptImageRenderer';
import { getScannableHostUrl } from '../api';
import styles from './IssuedReceiptModal.module.css';

interface IssuedReceiptModalProps {
  receipt: IssuedReceipt;
  onClose: () => void;
  onReset: () => void;
}

export const IssuedReceiptModal: React.FC<IssuedReceiptModalProps> = ({
  receipt,
  onClose,
  onReset,
}) => {
  const [language, setLanguage] = useState<'en' | 'am'>('en');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'document' | 'image'>('document');
  const [imageTheme, setImageTheme] = useState<'modern' | 'thermal'>('modern');
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [qrMode, setQrMode] = useState<'image' | 'data-uri' | 'info'>('image');
  const [scannableHost, setScannableHost] = useState<string>(
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  );

  useEffect(() => {
    let isMounted = true;
    getScannableHostUrl().then((host) => {
      if (isMounted && host) {
        setScannableHost(host);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const profile = getStoredMerchantProfile();
  const sellerName =
    (receipt as any).merchantLegalName ||
    (receipt as any).merchantName ||
    profile.sellerLegalName ||
    profile.tradeName ||
    'Registered Merchant';
  const sellerTrade =
    (receipt as any).merchantTradeName ||
    (receipt as any).merchantName ||
    profile.tradeName ||
    profile.sellerLegalName ||
    'Registered Merchant';
  const sellerTin = (receipt as any).merchantTin || profile.tin || '';
  const sellerAddress =
    (receipt as any).merchantAddress ||
    [profile.buildingName, profile.subCity, profile.city].filter(Boolean).join(', ') ||
    'Addis Ababa, Ethiopia';
  const cashierName = (receipt as any).cashierName || profile.fullName || 'Cashier / Operator';
  const operatorId = (receipt as any).operatorId || `CASH-014 / ${receipt.registerCode}`;

  const words =
    language === 'en'
      ? amountInWords(receipt.total)
      : amountInAmharic(receipt.total);

  const verificationUrl = `${scannableHost}/?view=verify&irn=${encodeURIComponent(receipt.irn)}`;
  const receiptImageViewerUrl = getReceiptViewerUrl(
    receipt.irn,
    { theme: imageTheme, lang: language },
    scannableHost,
    receipt
  );
  const backendHost = scannableHost.includes(':5173')
    ? scannableHost.replace(':5173', ':5000')
    : scannableHost;
  const receiptDirectImageUrl = getReceiptImageUrl(
    receipt.irn,
    { theme: imageTheme, lang: language },
    backendHost,
    receipt
  );
  const receiptDataUri = generateReceiptDataUri(receipt, {
    lang: language,
  });
  const renderedReceiptImageUrl = receiptDataUri;

  const handleDownloadPng = async () => {
    try {
      setIsDownloadingImage(true);
      await downloadReceiptAsPng(receipt.irn, { theme: imageTheme, lang: language });
    } catch (err) {
      console.error('Failed to download receipt as PNG:', err);
      window.open(receiptDirectImageUrl, '_blank');
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const customerReceiptQrText = [
    `=== eReceipt MoR Digital Fiscal Receipt ===`,
    `Receipt No: ${receipt.receiptNumber}`,
    `IRN: ${receipt.irn}`,
    `Date: ${receipt.clearanceTimestamp || new Date(receipt.issuedAt).toLocaleString()}`,
    `Merchant: ${sellerName} (TIN: ${sellerTin})`,
    `Customer: ${receipt.customerName || 'Walk-in Customer'}`,
    receipt.customerTin ? `Customer TIN: ${receipt.customerTin}` : null,
    receipt.customerNationalId ? `Fayda FIN: ${receipt.customerNationalId}` : null,
    `----------------------------------------`,
    `Items:`,
    ...receipt.items.map(
      (item, idx) =>
        `${idx + 1}. ${item.name} (${item.qty} ${item.uom}) - ETB ${formatMoney(
          netLineAmount(item) + lineExcise(item)
        )}`
    ),
    `----------------------------------------`,
    `Subtotal: ETB ${formatMoney(receipt.subtotal)}`,
    receipt.exciseTax > 0 ? `Excise Tax: ETB ${formatMoney(receipt.exciseTax)}` : null,
    `VAT (15%): ETB ${formatMoney(receipt.tax)}`,
    receipt.withholdingTax > 0 ? `Withholding (2%): -ETB ${formatMoney(receipt.withholdingTax)}` : null,
    `Grand Total: ETB ${formatMoney(receipt.total)}`,
    `Payment: ${receipt.paymentMethod}${receipt.paymentReference ? ` (${receipt.paymentReference})` : ''}`,
    `Status: CLEARED (MoR EIMS Verified)`,
    `Digital Signature: ${receipt.digitalSignature}`,
    `View Image: ${receiptImageViewerUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const qrValue =
    qrMode === 'image'
      ? receiptImageViewerUrl
      : qrMode === 'data-uri'
      ? (receiptDataUri && receiptDataUri.length < 2000 ? receiptDataUri : receiptImageViewerUrl)
      : customerReceiptQrText;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handlePrintThermal = () => {
    const printWindow = window.open('', '_blank', 'width=420,height=760');
    if (!printWindow) return;

    const qrSvgEl = document.getElementById('receipt-qr-svg');
    const qrSvgHtml = qrSvgEl ? qrSvgEl.outerHTML : '';

    const lines = receipt.items
      .map(
        (item) =>
          `<tr><td>${item.name}<br><small>${item.qty} ${item.uom} × ${formatMoney(
            item.price
          )} · VAT ${item.vatCategory}</small></td><td style="text-align:right">${formatMoney(
            netLineAmount(item) + lineExcise(item)
          )}</td></tr>`
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>MoR EIMS Cleared - ${receipt.irn}</title>
          <style>
            body {
              width: 72mm;
              margin: 0 auto;
              padding: 4mm;
              font-family: monospace, sans-serif;
              font-size: 11px;
              color: #111;
            }
            h1 { font-size: 15px; text-align: center; margin: 0; }
            p { text-align: center; margin: 3px 0; }
            .rule { border-top: 1px dashed #333; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 3px 0; vertical-align: top; }
            .total { font-weight: bold; font-size: 13px; }
            .qr-wrap {
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 10px 0;
            }
            .qr-wrap svg {
              width: 32mm;
              height: 32mm;
            }
          </style>
        </head>
        <body>
          <h1>${sellerName}</h1>
          <p>MoR EIMS CLEARED<br>TIN: ${sellerTin} · VAT: VAT-ET-${sellerTin}</p>
          <div class="rule"></div>
          <p><b>IRN:</b> ${receipt.irn}<br><b>RRN:</b> ${receipt.rrn}<br>${receipt.clearanceTimestamp}</p>
          <div class="rule"></div>
          <table>${lines}</table>
          <div class="rule"></div>
          <table>
            <tr><td>Net subtotal:</td><td style="text-align:right">ETB ${formatMoney(receipt.subtotal)}</td></tr>
            <tr><td>Excise tax:</td><td style="text-align:right">ETB ${formatMoney(receipt.exciseTax)}</td></tr>
            <tr><td>VAT (15%):</td><td style="text-align:right">ETB ${formatMoney(receipt.tax)}</td></tr>
            ${receipt.withholdingTax > 0 ? `<tr><td>Withholding (2%):</td><td style="text-align:right">-ETB ${formatMoney(receipt.withholdingTax)}</td></tr>` : ''}
            <tr class="total"><td>GRAND TOTAL:</td><td style="text-align:right">ETB ${formatMoney(receipt.total)}</td></tr>
          </table>
          <div class="rule"></div>
          <div class="qr-wrap">
            ${qrSvgHtml}
          </div>
          <p>Scan QR code with any smartphone to inspect customer receipt &amp; verify clearance on MoR EIMS.<br>የሰነዱን ትክክለኛነት በMoR ያረጋግጡ</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 350);
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <h2 className={styles.modalTitle}>Tax invoice clearance record</h2>
            <span className={styles.clearedPill}>
              <CheckCircle2 size={14} /> MoR Cleared
            </span>
          </div>

          <div className={styles.modalTabs}>
            <button
              type="button"
              className={`${styles.modalTabBtn} ${activeTab === 'document' ? styles.modalTabBtnActive : ''}`}
              onClick={() => setActiveTab('document')}
            >
              <FileText size={14} />
              <span>Fiscal Document</span>
            </button>
            <button
              type="button"
              className={`${styles.modalTabBtn} ${activeTab === 'image' ? styles.modalTabBtnActive : ''}`}
              onClick={() => setActiveTab('image')}
            >
              <ImageIcon size={14} />
              <span>Receipt Image</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.scrollArea}>
          {activeTab === 'image' ? (
            <div className={styles.imagePreviewWrapper}>
              <div className={styles.imagePreviewToolbar}>
                <div className={styles.imageThemeSelector}>
                  <button
                    type="button"
                    className={`${styles.imageThemeBtn} ${imageTheme === 'modern' ? styles.imageThemeBtnActive : ''}`}
                    onClick={() => setImageTheme('modern')}
                  >
                    Standard Invoice
                  </button>
                  <button
                    type="button"
                    className={`${styles.imageThemeBtn} ${imageTheme === 'thermal' ? styles.imageThemeBtnActive : ''}`}
                    onClick={() => setImageTheme('thermal')}
                  >
                    Thermal Slip (80mm)
                  </button>
                </div>

                <div className={styles.imagePreviewActions}>
                  <button
                    type="button"
                    onClick={handleDownloadPng}
                    disabled={isDownloadingImage}
                    className={styles.downloadPngBtn}
                  >
                    <Download size={14} />
                    <span>{isDownloadingImage ? 'Generating PNG...' : 'Download PNG'}</span>
                  </button>
                  <a
                    href={renderedReceiptImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.openVectorBtn}
                  >
                    <ExternalLink size={14} />
                    <span>Open Vector SVG</span>
                  </a>
                </div>
              </div>

              <div className={styles.imageCanvas}>
                <img
                  src={renderedReceiptImageUrl}
                  alt={`Official Electronic Receipt ${receipt.receiptNumber}`}
                  className={styles.previewReceiptImg}
                />
              </div>
            </div>
          ) : (
            <div className={styles.receiptDoc}>
            {/* MoR Banner */}
            <div className={styles.morBanner}>
              <div className={styles.morLeft}>
                <div className={styles.morIconWrapper}>
                  <Landmark size={22} />
                </div>
                <div>
                  <p className={styles.morEyebrow}>Ministry of Revenues · EIMS</p>
                  <h3 className={styles.morHeading}>Official real-time clearance confirmed</h3>
                </div>
              </div>
              <span className={styles.clearedBadgeWhite}>
                <CheckCircle2 size={16} /> MoR CLEARED
              </span>
            </div>

            <div className={styles.receiptBody}>
              {/* Seller details */}
              <div className={styles.sellerGrid}>
                <div className={styles.sellerInfo}>
                  <div className={styles.sellerHeader}>
                    <div className={styles.sellerIcon}>
                      <Store size={22} />
                    </div>
                    <div>
                      <h4 className={styles.sellerTitle}>{sellerName}</h4>
                      <p className={styles.sellerTradeName}>Trade name: {sellerTrade}</p>
                    </div>
                  </div>

                  <div className={styles.sellerMetaGrid}>
                    <p>
                      <b>Seller TIN:</b> {sellerTin || 'N/A'}<br />
                      <b>VAT No:</b> {sellerTin ? `VAT-ET-${sellerTin}` : 'N/A'}
                    </p>
                    <p>
                      <b>Branch:</b> {receipt.branchCode ? `Branch (${receipt.branchCode})` : 'Main'}<br />
                      <b>Address:</b> {sellerAddress}<br />
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} /> {sellerAddress}
                      </span>
                    </p>
                    <p>
                      <b>Cashier:</b> {cashierName}<br />
                      <b>Operator ID:</b> {operatorId}
                    </p>
                    <p>
                      <b>Receipt No:</b> {receipt.receiptNumber}<br />
                      <b>Series:</b> {receipt.fiscalYear} / #{receipt.sequence}
                    </p>
                  </div>
                </div>

                <div className={styles.fiscalBox}>
                  <p className={styles.fiscalDocType}>{receipt.documentType}</p>
                  <dl className={styles.fiscalDl}>
                    <dt>Invoice Registration Number (IRN)</dt>
                    <dd>{receipt.irn}</dd>
                    <dt>Receipt Registration Number (RRN)</dt>
                    <dd>{receipt.rrn}</dd>
                    <dt>Clearance timestamp</dt>
                    <dd>{receipt.clearanceTimestamp}</dd>
                  </dl>
                </div>
              </div>

              {/* Buyer details */}
              <div className={styles.buyerBox}>
                <div>
                  <p className={styles.buyerLabel}>Buyer / {receipt.transactionMode}</p>
                  <p className={styles.buyerName}>{receipt.customerName || 'Walk-in customer'}</p>
                  <p className={styles.buyerMeta}>
                    TIN: {receipt.customerTin || (receipt.transactionMode?.startsWith('B2C') ? 'Optional (Not provided)' : 'Not provided')}<br />
                    Fayda FIN: {receipt.customerNationalId || (receipt.transactionMode?.startsWith('B2C') ? 'Optional (Not provided)' : 'Not provided')}<br />
                    VAT: {receipt.customerVat || 'Not provided'}<br />
                    Contact: {receipt.customerPhone || 'Not provided'}
                  </p>
                </div>

                {receipt.originalIrn && (
                  <div>
                    <p className={styles.buyerLabel}>Original IRN &amp; Reason</p>
                    <p className={styles.buyerName} style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {receipt.originalIrn}
                    </p>
                    <p className={styles.buyerMeta}>{receipt.adjustmentReason}</p>
                  </div>
                )}
              </div>

              {/* Line items table */}
              <div className={styles.itemsTableWrapper}>
                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th>Code / Item or service</th>
                      <th>Qty / UoM</th>
                      <th style={{ textAlign: 'right' }}>Unit price</th>
                      <th style={{ textAlign: 'right' }}>Discount</th>
                      <th>VAT category</th>
                      <th>Excise</th>
                      <th style={{ textAlign: 'right' }}>Net + excise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span
                            style={{
                              display: 'block',
                              fontFamily: 'monospace',
                              fontSize: 11,
                              color: 'var(--color-primary-active, #0F766E)',
                            }}
                          >
                            {item.code}
                          </span>
                          <span style={{ fontWeight: 600, color: '#1F2937' }}>{item.name}</span>
                        </td>
                        <td>
                          {item.qty} {item.uom}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatMoney(item.price)}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatMoney(item.discount)}
                        </td>
                        <td>{item.vatCategory}</td>
                        <td>
                          {item.exciseRate}%
                          {item.exciseRate > 0 && (
                            <span style={{ display: 'block', fontSize: 10, color: '#64748B' }}>
                              ETB {formatMoney(lineExcise(item))}
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--color-navy, #123D2C)',
                          }}
                        >
                          {formatMoney(netLineAmount(item) + lineExcise(item))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial summary + Amount in words */}
              <div className={styles.summarySection}>
                <div>
                  <div className={styles.amountWordsCard}>
                    <p className={styles.amountWordsLabel}>
                      Total amount in words ({language === 'en' ? 'English' : 'አማርኛ'})
                    </p>
                    <p className={styles.amountWordsText}>{words}</p>
                  </div>

                  <div style={{ marginTop: 12, fontSize: 12, color: '#64748B' }}>
                    <b>Payment:</b> {receipt.paymentMethod} ·{' '}
                    {receipt.paymentReference || 'Cash settlement'}
                    {receipt.withholdingTax > 0 && (
                      <p style={{ marginTop: 4, color: 'var(--color-primary-active, #0F766E)', fontWeight: 600 }}>
                        Buyer withholding reference: {receipt.withholdingReference}
                      </p>
                    )}
                  </div>
                </div>

                <dl className={styles.totalsDl}>
                  <div className={styles.totalDlRow}>
                    <dt>Net subtotal:</dt>
                    <dd>ETB {formatMoney(receipt.subtotal)}</dd>
                  </div>
                  <div className={styles.totalDlRow}>
                    <dt>Excise tax:</dt>
                    <dd>ETB {formatMoney(receipt.exciseTax)}</dd>
                  </div>
                  <div className={styles.totalDlRow}>
                    <dt>VAT (15%):</dt>
                    <dd>ETB {formatMoney(receipt.tax)}</dd>
                  </div>
                  {receipt.withholdingTax > 0 && (
                    <div className={styles.totalDlRow} style={{ color: '#0F766E' }}>
                      <dt>Withholding (2%):</dt>
                      <dd>− ETB {formatMoney(receipt.withholdingTax)}</dd>
                    </div>
                  )}
                  <div className={styles.totalDlRowGrand}>
                    <dt>Grand total:</dt>
                    <dd>ETB {formatMoney(receipt.total)}</dd>
                  </div>
                </dl>
              </div>

              {/* MoR Verified Scannable QR code */}
              <div className={styles.qrBox}>
                <div className={styles.qrGraphic} aria-label="Official MoR verification QR code">
                  <QRCodeSVG
                    id="receipt-qr-svg"
                    value={qrValue}
                    size={144}
                    level={qrMode === 'data-uri' ? 'L' : 'M'}
                    includeMargin={false}
                    fgColor="#123D2C"
                  />
                </div>

                <div className={styles.qrInfo}>
                  <div className={styles.qrModeSelector}>
                    <button
                      type="button"
                      className={`${styles.qrModeBtn} ${qrMode === 'image' ? styles.qrModeBtnActive : ''}`}
                      onClick={() => setQrMode('image')}
                      title="QR code opens customer's visual receipt image with full tools"
                    >
                      Receipt Image Web
                    </button>
                    <button
                      type="button"
                      className={`${styles.qrModeBtn} ${qrMode === 'data-uri' ? styles.qrModeBtnActive : ''}`}
                      onClick={() => setQrMode('data-uri')}
                      title="QR code holds complete offline vector SVG receipt image directly"
                    >
                      Offline SVG Image
                    </button>
                    <button
                      type="button"
                      className={`${styles.qrModeBtn} ${qrMode === 'info' ? styles.qrModeBtnActive : ''}`}
                      onClick={() => setQrMode('info')}
                      title="QR code encodes customer text summary"
                    >
                      Text Summary
                    </button>
                  </div>

                  <p className={styles.qrTitle}>
                    <ShieldCheck size={18} /> Official MoR-verified QR code
                  </p>
                  <p className={styles.qrCopy}>
                    {qrMode === 'image'
                      ? "Scan with any smartphone camera to immediately load and display the authentic visual receipt graphic on your mobile device."
                      : qrMode === 'data-uri'
                      ? "Scans directly as an authentic vector SVG receipt image document without requiring internet or server access."
                      : "Scan to read customer receipt details and fiscal clearance metadata in plain text format."}
                  </p>
                  <p className={styles.sigCode}>
                    Digital signature: {receipt.digitalSignature}
                  </p>

                  <div className={styles.qrImageActionBanner}>
                    <div className={styles.qrImageThumbnail}>
                      <img src={renderedReceiptImageUrl} alt="Receipt Graphic Thumbnail" />
                    </div>
                    <div className={styles.qrImageActionInfo}>
                      <span className={styles.qrImageActionHeading}>Visual Receipt Graphic Ready</span>
                      <p className={styles.qrImageActionSub}>
                        Scan QR code with smartphone camera or launch image directly.
                      </p>
                      <div className={styles.qrImageBtnGroup}>
                        <a
                          href={receiptImageViewerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.qrImageActionBtn}
                        >
                          <ExternalLink size={13} />
                          <span>Open Receipt Image</span>
                        </a>
                        <button
                          type="button"
                          onClick={handleDownloadPng}
                          disabled={isDownloadingImage}
                          className={styles.qrImageActionBtnSecondary}
                        >
                          <Download size={13} />
                          <span>Save PNG</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.modalFooter}>
        <div className={styles.footerLeft}>
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isDownloadingImage}
            className={styles.actionBtn}
          >
            <Download size={15} />
            <span>{isDownloadingImage ? 'Generating PNG...' : 'Save image (.png)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setLanguage((l) => (l === 'en' ? 'am' : 'en'))}
            className={styles.actionBtn}
          >
            <Languages size={15} />
            <span>{language === 'en' ? 'Show in አማርኛ' : 'Show in English'}</span>
          </button>

            <button
              type="button"
              onClick={handlePrintThermal}
              className={styles.actionBtn}
            >
              <Printer size={15} />
              <span>Print 80mm receipt</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className={styles.actionBtn}
            >
              {copied ? <Check size={15} color="#16A34A" /> : <Copy size={15} />}
              <span>{copied ? 'Link copied!' : 'Copy MoR verify link'}</span>
            </button>
          </div>

          <div className={styles.footerRight}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onReset();
              }}
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            >
              <Plus size={15} />
              <span>Create another receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IssuedReceiptModal;
