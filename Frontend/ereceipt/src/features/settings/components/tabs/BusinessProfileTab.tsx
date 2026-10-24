import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, CheckCircle2 } from 'lucide-react';
import { VerifiedIdentifiersCard } from '../VerifiedIdentifiersCard';
import {
  getStoredMerchantProfile,
  saveStoredMerchantProfile,
} from '../../../merchant-registration';
import { API_BASE_URL } from '../../../../config/api';
import styles from './BusinessProfileTab.module.css';

const businessProfileSchema = z.object({
  legalName: z.string().min(2, 'Legal business name must be at least 2 characters'),
  tradeName: z.string().min(2, 'Trade / brand name must be at least 2 characters'),
  businessEmail: z.string().email('Please enter a valid business email address'),
  phone: z.string().min(9, 'Phone number must be at least 9 digits'),
  businessSector: z.string().min(2, 'Business sector / industry is required'),
  city: z.string().min(2, 'City is required'),
  subCity: z.string().min(2, 'Sub-city / Zone is required'),
  woreda: z.string().min(1, 'Woreda is required'),
  houseNumber: z.string().min(1, 'House / Office number is required'),
});

export type BusinessProfileFormData = z.infer<typeof businessProfileSchema>;

export interface BusinessProfileTabProps {
  initialValues?: Partial<BusinessProfileFormData>;
  onSave?: (data: BusinessProfileFormData) => void;
}

export const BusinessProfileTab: React.FC<BusinessProfileTabProps> = ({
  initialValues,
  onSave,
}) => {
  const [isSuccess, setIsSuccess] = useState(false);
  const storedProfile = getStoredMerchantProfile();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BusinessProfileFormData>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: {
      legalName: initialValues?.legalName ?? storedProfile.sellerLegalName,
      tradeName: initialValues?.tradeName ?? storedProfile.tradeName,
      businessEmail: initialValues?.businessEmail ?? storedProfile.email ?? '',
      phone: initialValues?.phone ?? storedProfile.phoneNumber,
      businessSector: initialValues?.businessSector ?? '',
      city: initialValues?.city ?? storedProfile.city,
      subCity: initialValues?.subCity ?? storedProfile.subCity,
      woreda: initialValues?.woreda ?? '',
      houseNumber:
        initialValues?.houseNumber ??
        (storedProfile.buildingName
          ? `${storedProfile.buildingName}${storedProfile.floor ? `, ${storedProfile.floor}` : ''}`
          : ''),
    },
  });

  // Automatically fetch registered business details from backend so the official phone number and details are always pre-filled
  useEffect(() => {
    const token =
      localStorage.getItem('merchant_token') ||
      localStorage.getItem('ereceipt_token') ||
      sessionStorage.getItem('ereceipt_token');
    const tin = storedProfile.tin;
    const url = tin
      ? `${API_BASE_URL}/api/settings/profile?tin=${encodeURIComponent(tin)}`
      : `${API_BASE_URL}/api/settings/profile`;

    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((resData) => {
        if (!resData) return;
        const p = resData.data || resData;
        if (p) {
          const currentProfile = getStoredMerchantProfile();
          const resolvedPhone = p.phoneNumber || currentProfile.phoneNumber || '';
          const resolvedEmail = p.businessEmail || p.email || currentProfile.email || '';
          const resolvedLegal = p.legalName || currentProfile.sellerLegalName || '';
          const resolvedTrade = p.tradeName || currentProfile.tradeName || '';

          if (resolvedPhone) {
            currentProfile.phoneNumber = resolvedPhone;
          }
          if (resolvedEmail) {
            currentProfile.email = resolvedEmail;
          }
          if (resolvedLegal) {
            currentProfile.sellerLegalName = resolvedLegal;
          }
          if (resolvedTrade) {
            currentProfile.tradeName = resolvedTrade;
          }
          if (p.merchantRef) {
            currentProfile.referenceNumber = p.merchantRef;
          }
          saveStoredMerchantProfile(currentProfile);

          // Populate form inputs so phone number and registered data are never blank
          reset((prev) => ({
            ...prev,
            legalName: prev.legalName || resolvedLegal,
            tradeName: prev.tradeName || resolvedTrade,
            businessEmail: prev.businessEmail || resolvedEmail,
            phone: prev.phone || resolvedPhone,
            city: prev.city || currentProfile.city || '',
            subCity: prev.subCity || currentProfile.subCity || '',
            houseNumber:
              prev.houseNumber ||
              (currentProfile.buildingName
                ? `${currentProfile.buildingName}${currentProfile.floor ? `, ${currentProfile.floor}` : ''}`
                : p.businessAddress || ''),
          }));
        }
      })
      .catch((err) => {
        console.warn('Profile sync:', err);
      });
  }, [reset, storedProfile.tin]);

  const onSubmit = (data: BusinessProfileFormData) => {
    setIsSuccess(true);
    const updated = {
      ...storedProfile,
      sellerLegalName: data.legalName,
      tradeName: data.tradeName,
      phoneNumber: data.phone || storedProfile.phoneNumber,
      email: data.businessEmail || storedProfile.email,
      city: data.city,
      subCity: data.subCity,
      buildingName: data.houseNumber,
    };
    saveStoredMerchantProfile(updated);

    // Also persist update to backend
    const token =
      localStorage.getItem('merchant_token') ||
      localStorage.getItem('ereceipt_token') ||
      sessionStorage.getItem('ereceipt_token');
    const tin = storedProfile.tin;
    const url = tin
      ? `${API_BASE_URL}/api/settings/profile?tin=${encodeURIComponent(tin)}`
      : `${API_BASE_URL}/api/settings/profile`;

    fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        legalName: data.legalName,
        tradeName: data.tradeName,
        phoneNumber: data.phone,
        businessEmail: data.businessEmail,
        businessAddress: `${data.houseNumber}, ${data.subCity}, ${data.city}`,
      }),
    }).catch((err) => console.warn('Backend profile update error:', err));

    if (onSave) {
      onSave(data);
    }
    setTimeout(() => {
      setIsSuccess(false);
    }, 4000);
  };

  return (
    <div className={styles.container}>
      {/* Read-Only Ministry Verified Identifiers Card */}
      <div className={styles.verifiedCardWrapper}>
        <VerifiedIdentifiersCard
          tin={storedProfile.tin || '—'}
          merchantReference={storedProfile.referenceNumber || (storedProfile.tin ? `MCH-${storedProfile.tin.slice(-4)}` : '—')}
          taxAuthority="Ministry of Revenues (MoR)"
        />
      </div>

      {/* Editable Business Details Form with Zod Validation */}
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Registered Business Information</h3>
          <p className={styles.sectionSubtitle}>
            Update your commercial details, contact emails for tax clearances, and operational address.
          </p>
        </div>

        {isSuccess && (
          <div className={styles.successMessage} role="status">
            <CheckCircle2 size={18} />
            <span>Business profile details have been saved successfully.</span>
          </div>
        )}

        <div className={styles.row}>
          <div className={styles.fieldGroup}>
            <label htmlFor="legalName" className={styles.label}>
              Legal Business Name
            </label>
            <input
              id="legalName"
              type="text"
              className={`${styles.input} ${errors.legalName ? styles.inputError : ''}`}
              placeholder="e.g. Abyssinia Cloud Tech Solutions PLC"
              {...register('legalName')}
            />
            {errors.legalName ? (
              <p className={styles.errorText}>{errors.legalName.message}</p>
            ) : (
              <p className={styles.hintText}>As registered on your Ministry commercial certificate.</p>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="tradeName" className={styles.label}>
              Trade / Operating Name
            </label>
            <input
              id="tradeName"
              type="text"
              className={`${styles.input} ${errors.tradeName ? styles.inputError : ''}`}
              placeholder="e.g. Abyssinia Cloud"
              {...register('tradeName')}
            />
            {errors.tradeName ? (
              <p className={styles.errorText}>{errors.tradeName.message}</p>
            ) : (
              <p className={styles.hintText}>Appears on public receipts and digital summaries.</p>
            )}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.fieldGroup}>
            <label htmlFor="businessEmail" className={styles.label}>
              Taxpayer Contact Email
            </label>
            <input
              id="businessEmail"
              type="email"
              className={`${styles.input} ${errors.businessEmail ? styles.inputError : ''}`}
              autoComplete="off"
              {...register('businessEmail')}
            />
            {errors.businessEmail ? (
              <p className={styles.errorText}>{errors.businessEmail.message}</p>
            ) : (
              <p className={styles.hintText}>Clearance certificates and audit trails are sent here.</p>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="phone" className={styles.label}>
              Official Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
              placeholder="+251 9XX XXX XXXX"
              {...register('phone')}
            />
            {errors.phone ? (
              <p className={styles.errorText}>{errors.phone.message}</p>
            ) : (
              <p className={styles.hintText}>Format: +251 9x xxx xxxx or +251 11 xxx xxxx</p>
            )}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="businessSector" className={styles.label}>
            Primary Business Sector
          </label>
          <input
            id="businessSector"
            type="text"
            className={`${styles.input} ${errors.businessSector ? styles.inputError : ''}`}
            placeholder="e.g. Information Technology & Software"
            {...register('businessSector')}
          />
          {errors.businessSector ? (
            <p className={styles.errorText}>{errors.businessSector.message}</p>
          ) : (
            <p className={styles.hintText}>Industry classification registered with MoR tax registry.</p>
          )}
        </div>

        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Physical & Fiscal Address</h3>
          <p className={styles.sectionSubtitle}>
            Official Ethiopian operating location for tax jurisdiction and dispatching invoices.
          </p>
        </div>

        <div className={styles.row}>
          <div className={styles.fieldGroup}>
            <label htmlFor="city" className={styles.label}>
              City
            </label>
            <input
              id="city"
              type="text"
              className={`${styles.input} ${errors.city ? styles.inputError : ''}`}
              placeholder="e.g. Addis Ababa"
              {...register('city')}
            />
            {errors.city && <p className={styles.errorText}>{errors.city.message}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="subCity" className={styles.label}>
              Sub-City / Zone
            </label>
            <input
              id="subCity"
              type="text"
              className={`${styles.input} ${errors.subCity ? styles.inputError : ''}`}
              placeholder="e.g. Kirkos Sub-City"
              {...register('subCity')}
            />
            {errors.subCity && <p className={styles.errorText}>{errors.subCity.message}</p>}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.fieldGroup}>
            <label htmlFor="woreda" className={styles.label}>
              Woreda
            </label>
            <input
              id="woreda"
              type="text"
              className={`${styles.input} ${errors.woreda ? styles.inputError : ''}`}
              placeholder="e.g. Woreda 03"
              {...register('woreda')}
            />
            {errors.woreda && <p className={styles.errorText}>{errors.woreda.message}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="houseNumber" className={styles.label}>
              House / Office Number
            </label>
            <input
              id="houseNumber"
              type="text"
              className={`${styles.input} ${errors.houseNumber ? styles.inputError : ''}`}
              placeholder="e.g. Bldg 4A, Suite 201"
              {...register('houseNumber')}
            />
            {errors.houseNumber && <p className={styles.errorText}>{errors.houseNumber.message}</p>}
          </div>
        </div>

        <div className={styles.actionsRow}>
          <button
            type="submit"
            className={styles.saveButton}
            disabled={isSubmitting}
          >
            <Save size={16} />
            {isSubmitting ? 'Saving changes...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BusinessProfileTab;
