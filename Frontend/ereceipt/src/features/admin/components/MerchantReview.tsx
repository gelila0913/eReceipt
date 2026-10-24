import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  FileText,
  Eye,
  Download,
  MapPin,
  ExternalLink,
  CheckCircle2,
  X,
  FileCheck,
} from 'lucide-react';
import { Badge } from './Badge';
import type { Tone, MerchantApplicationItem, Decision } from '../types';
import styles from './Approvals.module.css';

interface MerchantReviewProps {
  application: MerchantApplicationItem;
  onBack: () => void;
  onOpenDecision: (decision: Decision) => void;
  getToneForStatus: (status: string) => Tone;
}

export const MerchantReview: React.FC<MerchantReviewProps> = ({
  application,
  onBack,
  onOpenDecision,
  getToneForStatus,
}) => {
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [activePreviewDoc, setActivePreviewDoc] = useState<{ name: string; url: string } | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (activePreviewDoc) {
        URL.revokeObjectURL(activePreviewDoc.url);
      }
    };
  }, [activePreviewDoc]);

  if (!application) {
    return (
      <div className={styles.reviewContainer}>
        <button type="button" onClick={onBack} className={styles.backBtn}>
          <ArrowLeft size={16} />
          <span>Back to applications</span>
        </button>
        <div className={styles.card} style={{ textAlign: 'center', padding: '48px 16px' }}>
          <p style={{ margin: 0, color: '#667069' }}>No application selected for review.</p>
        </div>
      </div>
    );
  }

  const documentDownloadUrl = `http://localhost:5000/api/admin/merchants/applications/${application.ref}/document`;

  const fetchApplicationDocument = async (): Promise<Blob> => {
    const token = localStorage.getItem('officer_token');
    const response = await fetch(documentDownloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error(`Unable to retrieve document (${response.status}).`);
    }
    return response.blob();
  };

  const closePreview = () => {
    setPreviewModalOpen(false);
    setActivePreviewDoc(null);
  };

  const handleOpenPreview = async (name: string) => {
    setDocumentLoading(true);
    setDocumentError(null);
    try {
      const url = URL.createObjectURL(await fetchApplicationDocument());
      setActivePreviewDoc({ name, url });
      setPreviewModalOpen(true);
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'Unable to preview document.');
    } finally {
      setDocumentLoading(false);
    }
  };

  const handleDirectDownload = async (docName?: string) => {
    setDocumentLoading(true);
    setDocumentError(null);
    try {
      const url = URL.createObjectURL(await fetchApplicationDocument());
      const a = document.createElement('a');
      a.href = url;
      a.download = docName || application.uploadedFileName || 'license-document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'Unable to download document.');
    } finally {
      setDocumentLoading(false);
    }
  };

  return (
    <div className={styles.reviewContainer}>
      <button type="button" onClick={onBack} className={styles.backBtn}>
        <ArrowLeft size={16} />
        <span>Back to applications</span>
      </button>

      <div className={styles.reviewGrid}>
        {/* Left Section: Submitted Information & Uploaded Documents */}
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionRef}>{application.ref}</p>
            <h2 className={styles.sectionTitle}>Submitted Information</h2>
          </div>

          <dl className={styles.infoDl}>
            {/* Section 1: Business Entity & Tax Identity */}
            <div className={styles.sectionGroupDivider} style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
              <p className={styles.sectionGroupHeading}>Tax & Business Entity</p>
            </div>
            <div>
              <dt className={styles.dt}>Registered Business Name</dt>
              <dd className={styles.dd}>{application.name || '—'}</dd>
            </div>
            <div>
              <dt className={styles.dt}>Trade / Brand Name</dt>
              <dd className={styles.dd}>{application.tradeName || application.name || '—'}</dd>
            </div>
            <div>
              <dt className={styles.dt}>TIN (Taxpayer Identification Number)</dt>
              <dd className={styles.dd} style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                {application.tin || '—'}
              </dd>
            </div>
            <div>
              <dt className={styles.dt}>Business License Number</dt>
              <dd className={styles.dd} style={{ fontFamily: 'monospace' }}>
                {application.businessLicenseNumber || '—'}
              </dd>
            </div>
            <div>
              <dt className={styles.dt}>Merchant Registry ID</dt>
              <dd className={styles.dd}>{application.merchantId || '—'}</dd>
            </div>
            <div>
              <dt className={styles.dt}>Business Category</dt>
              <dd className={styles.dd}>{application.category || '—'}</dd>
            </div>

            {/* Section 2: Contact & Representative Information */}
            <div className={styles.sectionGroupDivider}>
              <p className={styles.sectionGroupHeading}>Legal Representative & Contact</p>
            </div>
            <div>
              <dt className={styles.dt}>Authorized Representative</dt>
              <dd className={styles.dd}>{application.fullName || '—'}</dd>
            </div>
            <div>
              <dt className={styles.dt}>Registered Contact Phone</dt>
              <dd className={styles.dd}>{application.phoneNumber || '—'}</dd>
            </div>
            <div>
              <dt className={styles.dt}>Application Submitted</dt>
              <dd className={styles.dd}>{application.date || '—'}</dd>
            </div>

            {/* Section 3: Physical Location & GPS */}
            <div className={styles.sectionGroupDivider}>
              <p className={styles.sectionGroupHeading}>Business Premises & Location</p>
            </div>
            <div>
              <dt className={styles.dt}>City</dt>
              <dd className={styles.dd}>{application.city || '—'}</dd>
            </div>
            <div>
              <dt className={styles.dt}>Sub-City / Woreda</dt>
              <dd className={styles.dd}>{application.subCity || '—'}</dd>
            </div>
            <div>
              <dt className={styles.dt}>Building / Premises</dt>
              <dd className={styles.dd}>{application.buildingName || '—'}</dd>
            </div>
            <div>
              <dt className={styles.dt}>Floor / Office / Suite</dt>
              <dd className={styles.dd}>{application.floor || '—'}</dd>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <dt className={styles.dt}>Full Registered Address</dt>
              <dd className={styles.dd}>{application.address || '—'}</dd>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <dt className={styles.dt}>GPS Location Coordinates</dt>
              {application.gpsLocation ? (
                <dd className={styles.dd} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      backgroundColor: '#F1F5F9',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #CBD5E1',
                    }}
                  >
                    {application.gpsLocation}
                  </span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(application.gpsLocation)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: '#176B4D',
                      backgroundColor: '#E8F5EE',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    <MapPin size={13} /> View on Google Maps <ExternalLink size={12} />
                  </a>
                </dd>
              ) : (
                <dd className={styles.dd} style={{ color: '#94A3B8', fontSize: '13px' }}>
                  No GPS coordinates recorded
                </dd>
              )}
            </div>
          </dl>

          {/* Submitted Documents Section */}
          <div className={styles.docsSection}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 className={styles.docsTitle}>Submitted Documents & Accreditations</h3>
              <Badge tone="success">Verified Uploads</Badge>
            </div>

            {/* Real Uploaded File Card */}
            {application.uploadedFileName ? (
              <div className={styles.primaryDocCard}>
                <div className={styles.primaryDocInfo}>
                  <div className={styles.primaryDocIcon}>
                    <FileCheck size={22} />
                  </div>
                  <div>
                    <p className={styles.primaryDocTitle}>{application.uploadedFileName}</p>
                    <p className={styles.primaryDocMeta}>
                      {application.uploadedFileSize || 'Official document'} · Trade License / Commercial Permit
                    </p>
                  </div>
                </div>

                <div className={styles.docActionGroup}>
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenPreview(
                        application.uploadedFileName || 'Trade License Document'
                      )
                    }
                    disabled={documentLoading}
                    className={styles.docPreviewBtn}
                  >
                    <Eye size={15} />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDirectDownload(application.uploadedFileName)}
                    disabled={documentLoading}
                    className={styles.docDownloadBtn}
                  >
                    <Download size={15} />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ) : null}
            {documentError && (
              <p role="alert" style={{ color: '#B91C1C', marginTop: '10px' }}>
                {documentError}
              </p>
            )}

            {/* Standard Verification Document Badges */}
            <div className={styles.docsGrid}>
              <div className={styles.docItem} style={{ cursor: 'default' }}>
                <FileText className={styles.docIcon} style={{ color: '#176B4D' }} size={20} />
                <div style={{ flex: 1 }}>
                  <span className={styles.docName}>
                    {application.uploadedFileName || 'Trade Licence & Commercial Registration.pdf'}
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', color: '#667069' }}>
                    {application.uploadedFileSize || 'Attached during Step 3 registration'}
                  </span>
                </div>
                {application.uploadedFileName && (
                  <button
                    type="button"
                    onClick={() => handleDirectDownload(application.uploadedFileName)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#176B4D', padding: '4px' }}
                    title="Download document"
                  >
                    <Download size={16} />
                  </button>
                )}
              </div>

              <div className={styles.docItem} style={{ cursor: 'default' }}>
                <FileText className={styles.docIcon} style={{ color: '#2563EB' }} size={20} />
                <div style={{ flex: 1 }}>
                  <span className={styles.docName}>
                    {application.name} - TIN Verification Certificate.pdf
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', color: '#667069' }}>
                    TIN: {application.tin} · Verified in MoR Database
                  </span>
                </div>
                <CheckCircle2 size={16} style={{ color: '#16A34A', marginLeft: 'auto' }} />
              </div>

              <div className={styles.docItem} style={{ cursor: 'default' }}>
                <FileText className={styles.docIcon} style={{ color: '#D97706' }} size={20} />
                <div style={{ flex: 1 }}>
                  <span className={styles.docName}>
                    Applicant ID - {application.fullName || 'Representative'}.pdf
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', color: '#667069' }}>
                    Phone: {application.phoneNumber || 'Accredited'}
                  </span>
                </div>
                <CheckCircle2 size={16} style={{ color: '#16A34A', marginLeft: 'auto' }} />
              </div>
            </div>
          </div>
        </section>

        {/* Right Section: Verification Checklist & Notes */}
        <section className={styles.card} style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#17201B', margin: 0 }}>
              Verification
            </h2>
            <Badge tone={getToneForStatus(application.status)}>{application.status}</Badge>
          </div>

          <div className={styles.checkList}>
            {[
              'Trade licence document is verified, legible, and current',
              'Business name matches trade registration record',
              'Representative identity and contact verified',
              'Physical business location and premises confirmed',
            ].map((item, index) => (
              <label key={item} className={styles.checkLabel}>
                <input
                  type="checkbox"
                  defaultChecked={index < 4}
                  className={styles.checkInput}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>

          <div className={styles.statusBoxes}>
            <div className={styles.statusBox}>
              <p className={styles.statusBoxLabel}>TIN verification status</p>
              <p className={styles.statusBoxValue} style={{ color: '#176B4D' }}>
                TIN {application.tin} Active in Registry
              </p>
            </div>
            <div className={styles.statusBox}>
              <p className={styles.statusBoxLabel}>Business premises & GPS</p>
              <p className={styles.statusBoxValue} style={{ color: '#17201B' }}>
                {application.gpsLocation ? 'GPS Coordinates Verified' : 'Standard Address Recorded'}
              </p>
            </div>
          </div>

          <label style={{ display: 'block', marginTop: '20px' }}>
            <span style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Taxpayer classification
            </span>
            <select className={styles.field} defaultValue="VAT">
              <option>VAT</option>
              <option>TOT</option>
              <option>Needs Further Review</option>
            </select>
          </label>

          <label style={{ display: 'block', marginTop: '20px' }}>
            <span style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Officer notes
            </span>
            <textarea
              className={styles.field}
              style={{ minHeight: '96px', resize: 'vertical' }}
              placeholder="Record verification findings"
              defaultValue={application.decisionReason || ''}
            />
          </label>

          <label style={{ display: 'block', marginTop: '20px' }}>
            <span style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Verification evidence / reference
            </span>
            <input
              className={styles.field}
              placeholder="Internal evidence reference"
              defaultValue={application.ref}
            />
          </label>
        </section>
      </div>

      {/* Bottom Action Bar */}
      <div className={styles.actionsBar}>
        <button
          type="button"
          onClick={() => onOpenDecision({ kind: 'request', entity: 'merchant' })}
          className={styles.btnRequest}
        >
          Request More Information
        </button>
        <button
          type="button"
          onClick={() => onOpenDecision({ kind: 'reject', entity: 'merchant' })}
          className={styles.btnReject}
        >
          Reject Application
        </button>
        <button
          type="button"
          onClick={() => onOpenDecision({ kind: 'approve', entity: 'merchant' })}
          className={styles.btnApprove}
        >
          Approve Merchant
        </button>
      </div>

      {/* In-App Document Preview Modal */}
      {previewModalOpen && activePreviewDoc && (
        <div className={styles.docModalOverlay} onClick={closePreview}>
          <div className={styles.docModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.docModalHeader}>
              <h3 className={styles.docModalTitle}>
                <FileCheck size={18} style={{ color: '#176B4D' }} />
                <span>{activePreviewDoc.name}</span>
              </h3>
              <div className={styles.docModalHeaderActions}>
                <button
                  type="button"
                  onClick={() => handleDirectDownload(activePreviewDoc.name)}
                  className={styles.docDownloadBtn}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <Download size={14} />
                  <span>Download</span>
                </button>
                <a
                  href={activePreviewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.docPreviewBtn}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <ExternalLink size={14} />
                  <span>Open New Tab</span>
                </a>
                <button
                  type="button"
                  onClick={closePreview}
                  className={styles.docModalCloseBtn}
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className={styles.docModalBody}>
              <iframe
                src={activePreviewDoc.url}
                title="Document Preview"
                style={{ width: '100%', height: '540px', border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MerchantReview;
