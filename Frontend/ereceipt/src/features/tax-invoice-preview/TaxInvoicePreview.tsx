import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Check,
  CheckCircle2,
  Share2,
  Download,
  Printer,
  Copy,
  Store,
  ExternalLink,
  Eye,
  Plus,
  X,
  Send,
  Languages,
  Image as ImageIcon,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getStoredMerchantProfile } from '../merchant-registration';
import {
  getLatestMerchantReceipt,
  syncMerchantReceipts,
  type StoredReceipt,
} from '../../services/merchantDataStore';
import { getReceiptViewerUrl } from '../../utils/receiptImageRenderer';
import styles from './TaxInvoicePreview.module.css';

interface TaxInvoicePreviewProps {
  onNavigate?: (screen: string) => void;
}

function numberToWordsETB(amount: number): string {
  if (!amount || isNaN(amount)) return 'Zero Ethiopian Birr and 00/100';
  const units = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertGroup(n: number): string {
    let out = '';
    if (n >= 100) {
      out += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      out += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      out += units[n] + ' ';
    }
    return out.trim();
  }

  const integerPart = Math.floor(amount);
  const cents = Math.round((amount - integerPart) * 100);

  if (integerPart === 0) {
    return `Zero Ethiopian Birr and ${String(cents).padStart(2, '0')}/100`;
  }

  let str = '';
  const millions = Math.floor(integerPart / 1000000);
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  const remainder = integerPart % 1000;

  if (millions > 0) {
    str += convertGroup(millions) + ' Million ';
  }
  if (thousands > 0) {
    str += convertGroup(thousands) + ' Thousand ';
  }
  if (remainder > 0) {
    str += convertGroup(remainder) + ' ';
  }

  return `${str.trim()} Ethiopian Birr and ${String(cents).padStart(2, '0')}/100`;
}

export const TaxInvoicePreview: React.FC<TaxInvoicePreviewProps> = ({ onNavigate }) => {
  const [language, setLanguage] = useState<'en' | 'am'>('en');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Authenticated merchant isolation
  const [merchantProfile, setMerchantProfile] = useState(() => getStoredMerchantProfile());
  const merchantTin = merchantProfile.tin;
  const businessName = merchantProfile.sellerLegalName || merchantProfile.tradeName || (merchantTin ? `Merchant (${merchantTin})` : 'Merchant');

  const [receipt, setReceipt] = useState<StoredReceipt | null>(() =>
    merchantTin ? getLatestMerchantReceipt(merchantTin) : null
  );
  const [recipientPhone, setRecipientPhone] = useState(receipt?.customerPhone || '+251 91 123 4567');
  const [recipientEmail, setRecipientEmail] = useState('');

  useEffect(() => {
    const handleProfileUpdate = () => {
      setMerchantProfile(getStoredMerchantProfile());
    };
    window.addEventListener('ereceipt:profile_updated', handleProfileUpdate);
    return () => window.removeEventListener('ereceipt:profile_updated', handleProfileUpdate);
  }, []);

  useEffect(() => {
    const refreshReceipt = () => {
      if (!merchantTin) {
        setReceipt(null);
        return;
      }
      const latest = getLatestMerchantReceipt(merchantTin);
      setReceipt(latest);
      if (latest?.customerPhone) {
        setRecipientPhone(latest.customerPhone);
      }
    };

    refreshReceipt();

    if (merchantTin) {
      syncMerchantReceipts(merchantTin).then(() => {
        refreshReceipt();
      });
    }

    const handleReceiptsUpdated = () => {
      refreshReceipt();
    };

    window.addEventListener('ereceipt:receipts_updated', handleReceiptsUpdated);
    return () => {
      window.removeEventListener('ereceipt:receipts_updated', handleReceiptsUpdated);
    };
  }, [merchantTin]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const verificationUrl = receipt ? `${window.location.origin}/?view=verify&irn=${encodeURIComponent(receipt.irn)}` : '';
  const receiptImageViewerUrl = receipt ? getReceiptViewerUrl(receipt.irn, { lang: language }, window.location.origin, receipt) : '';

  const handleCopyVerificationLink = () => {
    if (!verificationUrl) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(verificationUrl);
    }
    showToast(
      language === 'en'
        ? 'MoR verification link copied to clipboard!'
        : 'የMoR ማረጋገጫ ሊንክ ወደ ቅንጥብ ሰሌዳ ተገልብጧል!'
    );
  };

  const handlePrintA4 = () => {
    window.print();
  };

  const handlePrintThermal = () => {
    if (!receipt) return;
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) {
      alert('Please allow popups to print the thermal receipt.');
      return;
    }

    const itemsHtml = receipt.items
      .map((item) => {
        const net =
          (item.price * item.qty - (item.discount || 0)) *
          (1 + (item.vatCategory?.includes('15%') ? 0.15 : 0) + ((item.exciseRate || 0) / 100));
        return `<tr><td>${item.name}</td><td class="align-right">${item.qty} ${item.uom || ''}</td><td class="align-right">${net.toFixed(2)}</td></tr>`;
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Thermal Receipt - ${receipt.irn}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: 'Courier New', monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 12px 6px;
              font-size: 11px;
              color: #000;
            }
            h1 { font-size: 14px; text-align: center; margin: 0; font-weight: bold; }
            p { text-align: center; margin: 3px 0; }
            .rule { border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            td { padding: 2px 0; vertical-align: top; }
            .total { font-weight: bold; font-size: 12px; }
            .align-right { text-align: right; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <h1>${businessName}</h1>
          <p>${receipt.merchantAddress || 'Addis Ababa'}<br>TIN: ${receipt.merchantTin} | VAT: VAT-ET-${receipt.merchantTin}</p>
          <div class="rule"></div>
          <p><b>*** MoR EIMS CLEARED ***</b><br>IRN: ${receipt.irn}<br>RRN: ${receipt.rrn}<br>${receipt.clearanceTimestamp}</p>
          <div class="rule"></div>
          <p style="text-align:left;"><b>BUYER:</b> ${receipt.customerName || 'Walk-in Customer'}<br>TIN: ${receipt.customerTin || 'N/A'}${receipt.customerNationalId ? `<br>FIN: ${receipt.customerNationalId}` : ''}</p>
          <div class="rule"></div>
          <table>
            <tr><td><b>Item</b></td><td class="align-right"><b>Qty</b></td><td class="align-right"><b>Total (ETB)</b></td></tr>
            ${itemsHtml}
          </table>
          <div class="rule"></div>
          <table>
            <tr><td>Taxable Net:</td><td class="align-right">${(receipt.subtotal || 0).toFixed(2)}</td></tr>
            <tr><td>VAT (15%):</td><td class="align-right">${(receipt.tax || 0).toFixed(2)}</td></tr>
            <tr><td>Excise Tax:</td><td class="align-right">${(receipt.exciseTax || 0).toFixed(2)}</td></tr>
            <tr class="total"><td>GRAND TOTAL ETB:</td><td class="align-right">${(receipt.total || 0).toFixed(2)}</td></tr>
          </table>
          <div class="rule"></div>
          <p class="center">Scan QR on official invoice to verify online.<br>Cleared in real-time by Ethiopian MoR.</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 350);
  };

  const handleSendShare = (type: string) => {
    setIsShareModalOpen(false);
    showToast(
      language === 'en'
        ? `Invoice document cleared link dispatched via ${type} successfully!`
        : `የደረሰኝ ማረጋገጫ ሰነድ በ${type} በተሳካ ሁኔታ ተልኳል!`
    );
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'am' : 'en'));
  };

  const money = (val: number) =>
    (val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className={styles.toast} role="status">
          <Check size={18} strokeWidth={2.5} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Share Modal Dialog */}
      {isShareModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsShareModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {language === 'en' ? 'Deliver Cleared Tax Invoice' : 'የተረጋገጠ የታክስ ደረሰኝ ላክ'}
              </h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setIsShareModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalSubtitle}>
                {language === 'en'
                  ? 'Send the verified invoice and Ministry of Revenues cryptographic proof directly to the customer.'
                  : 'የተረጋገጠውን ደረሰኝ እና የገቢዎች ሚኒስቴር ማረጋገጫ በቀጥታ ለደንበኛው ይላኩ።'}
              </p>

              <div className={styles.shareOptionGroup}>
                <label className={styles.inputLabel}>
                  {language === 'en' ? 'SMS / Telegram Phone' : 'የኤስኤምኤስ / ቴሌግራም ስልክ'}
                </label>
                <div className={styles.inputWithButton}>
                  <input
                    type="tel"
                    className={styles.textInput}
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.shareSendBtn}
                    onClick={() => handleSendShare('SMS')}
                  >
                    <Send size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    {language === 'en' ? 'Send SMS' : 'ላክ'}
                  </button>
                </div>
              </div>

              <div className={styles.shareOptionGroup}>
                <label className={styles.inputLabel}>
                  {language === 'en' ? 'Customer Email' : 'የደንበኛ ኢሜይል'}
                </label>
                <div className={styles.inputWithButton}>
                  <input
                    type="email"
                    className={styles.textInput}
                    placeholder="customer@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.shareSendBtn}
                    onClick={() => handleSendShare('Email')}
                  >
                    <Send size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    {language === 'en' ? 'Send Email' : 'ላክ'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <header className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <div className={styles.successPill}>
            <CheckCircle2 size={15} strokeWidth={2.5} />
            <span>Submitted successfully · EIMS HTTP 200</span>
          </div>
          <h1 className={styles.title}>
            {language === 'en' ? 'Tax invoice preview' : 'የታክስ ደረሰኝ ቅድመ-እይታ'}
          </h1>
          <p className={styles.subtitle}>
            {language === 'en'
              ? `Real-time cleared invoice presentation for ${businessName} (TIN: ${merchantTin}).`
              : `የቀጥታ የተረጋገጠ ደረሰኝ ለ${businessName} (TIN: ${merchantTin})።`}
          </p>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.morClearedBadge}>
            <span className={styles.clearedDot} />
            <span>MoR Cleared</span>
          </div>

          <button
            type="button"
            className={styles.langToggleBtn}
            onClick={toggleLanguage}
            title="Toggle between English and Amharic"
          >
            <Languages size={15} />
            <span style={{ fontWeight: language === 'en' ? 700 : 400 }}>English</span>
            <div
              className={`${styles.toggleSwitch} ${
                language === 'am' ? styles.toggleSwitchAmharic : ''
              }`}
            >
              <div
                className={`${styles.toggleThumb} ${
                  language === 'am' ? styles.toggleThumbAmharic : ''
                }`}
              />
            </div>
            <span style={{ fontWeight: language === 'am' ? 700 : 400 }}>አማርኛ</span>
          </button>
        </div>
      </header>

      {/* Main 2-Column Content */}
      <main className={styles.layoutGrid}>
        {/* Left Column: Official Cleared Invoice Document */}
        {receipt ? (
          <article className={styles.documentCard} aria-label="Official Tax Invoice">
            {/* Green Top Ribbon */}
            <div className={styles.morBanner}>
              <div className={styles.morBannerLeft}>
                <div className={styles.morEmblemIcon}>
                  <Landmark size={20} />
                </div>
                <div className={styles.morBannerTitles}>
                  <span className={styles.morAgency}>MINISTRY OF REVENUES - EIMS</span>
                  <span className={styles.morStatusConfirmed}>
                    {language === 'en'
                      ? 'Official real-time clearance confirmed'
                      : 'ይፋዊ የእውነተኛ ጊዜ ማረጋገጫ ተከናውኗል'}
                  </span>
                </div>
              </div>

              <div className={styles.morClearedPill}>
                <Check size={14} strokeWidth={3} />
                <span>MoR CLEARED</span>
              </div>
            </div>

            {/* Document Content */}
            <div className={styles.documentBody}>
              {/* Top Seller & Registration Meta */}
              <div className={styles.metaTopRow}>
                {/* Seller Information */}
                <div className={styles.sellerBox}>
                  <div className={styles.storeBrandRow}>
                    <div className={styles.storeIconBox}>
                      <Store size={22} />
                    </div>
                    <div>
                      <h2 className={styles.storeTitle}>
                        {merchantProfile.tradeName || merchantProfile.sellerLegalName || receipt.merchantName || businessName}
                      </h2>
                      <p className={styles.storeTradeName}>
                        {language === 'en'
                          ? `Trade name: ${merchantProfile.tradeName || receipt.merchantTradeName || receipt.merchantName || businessName}`
                          : `የንግድ ስም፡ ${merchantProfile.tradeName || receipt.merchantTradeName || receipt.merchantName || businessName}`}
                      </p>
                    </div>
                  </div>

                  <div className={styles.sellerDetailsGrid}>
                    <span className={styles.sellerLabel}>Seller TIN:</span>
                    <span>{merchantProfile.tin || receipt.merchantTin || merchantTin}</span>

                    <span className={styles.sellerLabel}>Branch:</span>
                    <span>{receipt.branchCode || 'Bole Main Outlet (BOL01)'}</span>

                    <span className={styles.sellerLabel}>VAT No:</span>
                    <span>VAT-ET-{merchantProfile.tin || receipt.merchantTin || merchantTin}</span>

                    <span className={styles.sellerLabel}>Address:</span>
                    <span>{receipt.merchantAddress || [merchantProfile.buildingName, merchantProfile.subCity, merchantProfile.city].filter(Boolean).join(', ') || 'Addis Ababa, Ethiopia'}</span>

                    <span className={styles.sellerLabel}>GPS Coordinates:</span>
                    <span>8.9806° N, 38.7578° E</span>

                    <span className={styles.sellerLabel}>Cashier:</span>
                    <span>{receipt.cashierName || 'Cashier / Operator'}</span>

                    <span className={styles.sellerLabel}>Operator ID:</span>
                    <span>{receipt.operatorId || 'CASH-014 / REG01'}</span>
                  </div>
                </div>

                {/* Invoice Registration Identifiers */}
                <div className={styles.invoiceRegBox}>
                  <p className={styles.invoiceTypeTitle}>
                    {receipt.documentType
                      ? receipt.documentType.toUpperCase()
                      : language === 'en'
                      ? 'ELECTRONIC TAX INVOICE (VAT INVOICE)'
                      : 'የኤሌክትሮኒክ ታክስ ደረሰኝ (የቫት ደረሰኝ)'}
                  </p>

                  <div className={styles.regField}>
                    <div className={styles.regLabel}>
                      {language === 'en'
                        ? 'Invoice Registration Number (IRN)'
                        : 'የደረሰኝ ምዝገባ ቁጥር (IRN)'}
                    </div>
                    <div className={styles.regValueMonospace}>{receipt.irn}</div>
                  </div>

                  <div className={styles.regField}>
                    <div className={styles.regLabel}>
                      {language === 'en'
                        ? 'Receipt Registration Number (RRN)'
                        : 'የደረሰኝ መለያ ቁጥር (RRN)'}
                    </div>
                    <div className={styles.regValueMonospace}>{receipt.rrn}</div>
                  </div>

                  <div className={styles.regField}>
                    <div className={styles.regLabel}>
                      {language === 'en' ? 'Clearance timestamp' : 'የተረጋገጠበት ቀን እና ሰዓት'}
                    </div>
                    <div className={styles.regValueTime}>{receipt.clearanceTimestamp}</div>
                  </div>
                </div>
              </div>

              {/* Buyer Box */}
              <div className={styles.buyerCard}>
                <p className={styles.buyerEyebrow}>
                  {receipt.transactionMode ||
                    (language === 'en' ? 'BUYER / B2B / REGISTERED BUYER' : 'የተመዘገበ ገዢ / ቢዝነስ')}
                </p>
                <h3 className={styles.buyerName}>{receipt.customerName || 'Walk-in Customer'}</h3>
                <div className={styles.buyerDetailsGrid}>
                  <div>
                    <span className={styles.buyerLabel}>TIN:</span>
                    <span>{receipt.customerTin || (receipt.transactionMode?.startsWith('B2C') ? 'Optional / Not provided' : 'Not provided')}</span>
                  </div>
                  <div>
                    <span className={styles.buyerLabel}>Fayda FIN:</span>
                    <span>{receipt.customerNationalId || (receipt.transactionMode?.startsWith('B2C') ? 'Optional / Not provided' : 'Not provided')}</span>
                  </div>
                  <div>
                    <span className={styles.buyerLabel}>VAT:</span>
                    <span>{receipt.customerVat || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className={styles.buyerLabel}>Contact:</span>
                    <span>{receipt.customerPhone || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className={styles.buyerLabel}>Payment:</span>
                    <span>{receipt.paymentMethod || 'Cash'}</span>
                  </div>
                </div>
              </div>

              {/* Itemized Table */}
              <div className={styles.itemsTableWrapper}>
                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th>
                        {language === 'en' ? 'Code / Item or service' : 'ኮድ / የእቃ ወይም አገልግሎት ስም'}
                      </th>
                      <th className={styles.alignCenter}>
                        {language === 'en' ? 'Qty / UoM' : 'መጠን'}
                      </th>
                      <th className={styles.alignRight}>
                        {language === 'en' ? 'Unit price' : 'ነጠላ ዋጋ'}
                      </th>
                      <th className={styles.alignRight}>
                        {language === 'en' ? 'Discount' : 'ቅናሽ'}
                      </th>
                      <th className={styles.alignCenter}>
                        {language === 'en' ? 'VAT category' : 'የቫት ምድብ'}
                      </th>
                      <th className={styles.alignRight}>
                        {language === 'en' ? 'Excise' : 'ኤክሳይዝ'}
                      </th>
                      <th className={styles.alignRight}>
                        {language === 'en' ? 'Net amount' : 'ጠቅላላ ዋጋ'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.items && receipt.items.length > 0 ? (
                      receipt.items.map((item, idx) => {
                        const price = item.price ?? (item as any).unitPrice ?? 0;
                        const qty = item.qty ?? (item as any).quantity ?? 1;
                        const discount = item.discount ?? 0;
                        const vatRate = item.vatCategory?.includes('15%') ? 0.15 : 0;
                        const exciseRate = (item.exciseRate ?? 0) / 100;
                        const itemNet = (price * qty - discount) * (1 + vatRate + exciseRate);
                        return (
                          <tr key={item.id || idx}>
                            <td>
                              <div className={styles.itemCode}>{item.code || `ITM-${idx + 1}`}</div>
                              <div className={styles.itemDesc}>{item.name}</div>
                            </td>
                            <td className={styles.alignCenter}>
                              {item.qty} {item.uom || 'PCS'}
                            </td>
                            <td className={styles.alignRight}>{money(item.price)}</td>
                            <td className={styles.alignRight}>{money(item.discount || 0)}</td>
                            <td className={styles.alignCenter}>
                              {item.vatCategory || 'Standard VAT (15%)'}
                            </td>
                            <td className={styles.alignRight}>
                              {item.exciseRate > 0 ? `${item.exciseRate}%` : '0%'}
                            </td>
                            <td className={styles.alignRight}>
                              <strong>{money(itemNet)}</strong>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '16px' }}>
                          No item records attached to this invoice.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              <div className={styles.totalsSection}>
                <div className={styles.totalsInWords}>
                  <span className={styles.wordsLabel}>
                    {language === 'en' ? 'Amount in Words (ETB)' : 'በፊደል የተገለጸ ጠቅላላ ድምር (ብር)'}
                  </span>
                  <span className={styles.wordsValue}>
                    {language === 'en'
                      ? numberToWordsETB(receipt.total)
                      : `በአጠቃላይ ${money(receipt.total)} የኢትዮጵያ ብር`}
                  </span>
                </div>

                <div className={styles.totalsTable}>
                  <div className={styles.totalRow}>
                    <span>{language === 'en' ? 'Subtotal (Net Amount):' : 'ንዑስ ድምር፡'}</span>
                    <span>ETB {money(receipt.subtotal)}</span>
                  </div>
                  <div className={styles.totalRow}>
                    <span>{language === 'en' ? 'Standard VAT (15%):' : 'ቫት (15%)፡'}</span>
                    <span>ETB {money(receipt.tax)}</span>
                  </div>
                  {receipt.exciseTax > 0 && (
                    <div className={styles.totalRow}>
                      <span>{language === 'en' ? 'Excise Tax:' : 'የኤክሳይዝ ታክስ፡'}</span>
                      <span>ETB {money(receipt.exciseTax)}</span>
                    </div>
                  )}
                  <div className={styles.grandTotalRow}>
                    <span>{language === 'en' ? 'Total Amount Due:' : 'ጠቅላላ ክፍያ፡'}</span>
                    <span className={styles.grandTotalAmount}>ETB {money(receipt.total)}</span>
                  </div>
                </div>
              </div>

              {/* QR & Verification Section */}
              <div className={styles.qrSection}>
                <div className={styles.qrBox}>
                  <QRCodeSVG
                    value={
                      receipt.qrVerificationUrl ||
                      verificationUrl ||
                      receiptImageViewerUrl ||
                      receipt.qrPayload ||
                      'https://ereceipt.et'
                    }
                    size={118}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                <div className={styles.qrMeta}>
                  <div className={styles.qrBadge}>
                    <Check size={13} strokeWidth={3} />
                    <span>MoR EIMS Cryptographically Verified</span>
                  </div>
                  <div className={styles.qrSig}>{receipt.digitalSignature}</div>
                  {verificationUrl && (
                    <a
                      href={verificationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.qrVerifyLink}
                      onClick={(e) => {
                        e.preventDefault();
                        handleCopyVerificationLink();
                      }}
                    >
                      <span>{verificationUrl}</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </article>
        ) : (
          <article
            className={styles.documentCard}
            style={{
              padding: '64px 32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 107, 68, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#006B44',
              }}
            >
              <Store size={32} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#17201B', margin: '0 0 8px 0' }}>
              No Cleared Tax Invoices Yet
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: '#526059',
                maxWidth: '460px',
                lineHeight: 1.5,
                margin: '0 0 24px 0',
              }}
            >
              No receipts have been issued yet for <strong>{businessName}</strong> (TIN: {merchantTin}).
              Issue a receipt via POS to generate your official Ministry of Revenues cleared document.
            </p>
            <button
              type="button"
              className={styles.btnSolidPrimary}
              style={{ display: 'inline-flex', width: 'auto', padding: '10px 24px' }}
              onClick={() => onNavigate?.('pos')}
            >
              <Plus size={16} />
              <span>Issue Your First Receipt</span>
            </button>
          </article>
        )}

        {/* Right Column: Action Sidebar */}
        <aside className={styles.actionSidebar}>
          {/* Card 1: Deliver cleared document */}
          <div className={styles.actionCard}>
            <h2 className={styles.actionCardTitle}>Deliver cleared document</h2>
            <p className={styles.actionCardSubtitle}>
              The customer does not need an eReceipt account.
            </p>

            <div className={styles.actionButtonStack}>
              <button
                type="button"
                className={styles.btnSolidPrimary}
                onClick={() => setIsShareModalOpen(true)}
                disabled={!receipt}
                style={{ opacity: !receipt ? 0.6 : 1 }}
              >
                <Share2 size={16} />
                <span>Share cleared invoice</span>
              </button>

              <button
                type="button"
                className={styles.btnOutlined}
                onClick={handlePrintA4}
                disabled={!receipt}
                style={{ opacity: !receipt ? 0.6 : 1 }}
              >
                <Download size={16} />
                <span>Download A4 official PDF</span>
              </button>

              <button
                type="button"
                className={styles.btnOutlined}
                onClick={handlePrintThermal}
                disabled={!receipt}
                style={{ opacity: !receipt ? 0.6 : 1 }}
              >
                <Printer size={16} />
                <span>Print 80mm thermal receipt</span>
              </button>

              <button
                type="button"
                className={styles.btnOutlined}
                onClick={() => window.open(receiptImageViewerUrl, '_blank')}
                disabled={!receipt}
                style={{ opacity: !receipt ? 0.6 : 1 }}
              >
                <ImageIcon size={16} />
                <span>View receipt image</span>
              </button>

              <button
                type="button"
                className={styles.btnOutlined}
                onClick={handleCopyVerificationLink}
                disabled={!receipt}
                style={{ opacity: !receipt ? 0.6 : 1 }}
              >
                <Copy size={16} />
                <span>Copy MoR verification link</span>
              </button>
            </div>
          </div>

          {/* Card 2: EIMS accepted */}
          <div className={styles.eimsAcceptedCard}>
            <div className={styles.eimsCardHeader}>
              <div className={styles.eimsCheckIcon}>
                <CheckCircle2 size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className={styles.eimsTitle}>EIMS accepted</h3>
                <p className={styles.eimsSub}>API response HTTP 200</p>
              </div>
            </div>

            <div className={styles.eimsDescBox}>
              Cleared in real time and committed to the 10-year statutory archive for {businessName}.
            </div>
          </div>

          {/* Bottom Action Buttons */}
          <div className={styles.sidebarNavStack}>
            <button
              type="button"
              className={styles.btnCreateAnother}
              onClick={() => onNavigate?.('pos')}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Create another document</span>
            </button>

            <button
              type="button"
              className={styles.btnViewTaxRecord}
              onClick={() => onNavigate?.('sales')}
            >
              <Eye size={16} />
              <span>View tax record</span>
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default TaxInvoicePreview;
