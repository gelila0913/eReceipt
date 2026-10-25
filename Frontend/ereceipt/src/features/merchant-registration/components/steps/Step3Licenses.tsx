import React, { useRef, useState } from 'react';
import { FileCheck2, FileText, CheckCircle2 } from 'lucide-react';
import type { MerchantRegistrationFormData } from '../../types';
import styles from './Step3Licenses.module.css';

interface Step3Props {
  formData: MerchantRegistrationFormData;
  onChange: (patch: Partial<MerchantRegistrationFormData>) => void;
}

export const Step3Licenses: React.FC<Step3Props> = ({ formData, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    onChange({
      uploadedFileName: file.name,
      uploadedFileSize: `${sizeInMb} MB · Ready for MoR validation`,
      isDocumentReady: true,
      documentFile: file,
    });

    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          try {
            localStorage.setItem('ereceipt:last_uploaded_doc_data', reader.result);
            localStorage.setItem('ereceipt:last_uploaded_doc_name', file.name);
          } catch {}
        }
      };
      reader.readAsDataURL(file);
    } catch {}
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className={styles.stepContainer}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className={styles.hiddenFileInput}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div
        className={`${styles.uploadZone} ${isDragging ? styles.uploadZoneActive : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
      >
        <FileCheck2 size={32} className={styles.uploadIcon} />
        <b className={styles.uploadTitle}>Upload VAT certificate and license (Mandatory)</b>
        <span className={styles.uploadSubtitle}>PDF, JPG or PNG, up to 10 MB</span>
      </div>

      {!formData.isDocumentReady ? (
        <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#B45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
          ⚠️ Uploading your business license or tax certificate is required to complete registration.
        </p>
      ) : (
        <div className={styles.filePreviewCard}>
          <FileText size={20} className={styles.fileIcon} />
          <div className={styles.fileDetails}>
            <p className={styles.fileName}>{formData.uploadedFileName}</p>
            <p className={styles.fileMeta}>{formData.uploadedFileSize}</p>
          </div>
          <CheckCircle2 size={20} className={styles.checkIcon} />
        </div>
      )}
    </div>
  );
};

export default Step3Licenses;
