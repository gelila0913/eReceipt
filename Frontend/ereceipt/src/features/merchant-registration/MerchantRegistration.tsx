import React, { useState } from 'react';
import AuthSplitLayout from '../../layouts/AuthSplitLayout/AuthSplitLayout';
import CenteredCardLayout from '../../layouts/CenteredCardLayout/CenteredCardLayout';
import Step1AccountDetails from './components/steps/Step1AccountDetails';
import Step2TaxIdentity from './components/steps/Step2TaxIdentity';
import Step3Licenses from './components/steps/Step3Licenses';
import Step4BusinessLocation from './components/steps/Step4BusinessLocation';
import Step5Review from './components/steps/Step5Review';
import WorkflowPipelineStepper from './components/status/WorkflowPipelineStepper';
import MerchantEmailOtpModal from './components/MerchantEmailOtpModal';
import { AlertCircle } from 'lucide-react';
import type {
  MerchantRegistrationFormData,
  RegistrationStep,
  MerchantUserProfile,
} from './types';
import { initialRegistrationFormData } from './types';
import { saveStoredMerchantProfile } from './profileStorage';
import { API_BASE_URL } from '../../config/api';
import styles from './MerchantRegistration.module.css';

interface MerchantRegistrationProps {
  onSignInClick?: () => void;
  onHomeClick?: () => void;
}

const STEP_TITLES: Record<RegistrationStep, string> = {
  1: 'Account details',
  2: 'Tax identity',
  3: 'Licenses',
  4: 'Business location',
  5: 'Review',
};

export const MerchantRegistration: React.FC<MerchantRegistrationProps> = ({
  onSignInClick,
  onHomeClick,
}) => {
  const [step, setStep] = useState<RegistrationStep>(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [submittedRef, setSubmittedRef] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);
  const [formData, setFormData] = useState<MerchantRegistrationFormData>(initialRegistrationFormData);

  const updateFormData = (patch: Partial<MerchantRegistrationFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
    setStepError(null);
  };

  const validateCurrentStep = (): string | null => {
    if (step === 1) {
      if (!formData.fullName.trim()) return 'Please enter your full legal name.';
      if (formData.fullName.trim().length < 3) return 'Full name must be at least 3 characters.';
      if (!formData.email.trim() || !formData.email.includes('@')) return 'Please enter a valid business email address.';
      if (!formData.phoneNumber.trim()) return 'Please enter your phone number.';
      const cleanPhone = formData.phoneNumber.replace(/[\s\-()]/g, '');
      if (cleanPhone.length < 9) return 'Please enter a valid phone number (at least 9 digits).';
      if (!formData.password) return 'Please create a secure password.';
      if (formData.password.length < 6) return 'Password must be at least 6 characters.';
      return null;
    }
    if (step === 2) {
      if (!formData.sellerLegalName.trim()) return 'Please enter your legal business name.';
      if (!formData.tradeName.trim()) return 'Please enter your trade / brand name.';
      if (!formData.tin.trim()) return 'Please enter your 10-digit Taxpayer Identification Number (TIN).';
      if (!/^\d{10}$/.test(formData.tin.trim())) return 'TIN must be exactly 10 numeric digits.';
      if (!formData.businessLicenseNumber.trim()) return 'Please enter your business license number.';
      return null;
    }
    if (step === 3) {
      if (!formData.isDocumentReady || !formData.uploadedFileName) {
        return 'Business license or VAT certificate document upload is required. Please upload your document to proceed.';
      }
      return null;
    }
    if (step === 4) {
      if (!formData.city.trim()) return 'Please enter the city of your business location.';
      if (!formData.subCity.trim()) return 'Please enter the sub-city or zone.';
      if (!formData.buildingName.trim()) return 'Please enter the building name or premises.';
      if (!formData.floor.trim()) return 'Please enter the floor or office number.';
      return null;
    }
    if (step === 5) {
      if (!formData.certified) {
        return 'You must certify the accuracy of your business tax registration details before submitting.';
      }
      return null;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const err = validateCurrentStep();
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);

    // If on Step 1 and email is not verified yet, open Resend OTP modal
    if (step === 1 && !formData.emailVerified) {
      setIsOtpModalOpen(true);
      return;
    }

    if (step < 5) {
      setStep((prev) => (prev + 1) as RegistrationStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Step 5 Submit: Submit to backend & persist to profile
    setIsSubmitting(true);
    let assignedRef = '';

    try {
      const formPayload = new FormData();
      formPayload.append('fullName', formData.fullName);
      formPayload.append('phoneNumber', formData.phoneNumber);
      formPayload.append('email', formData.email.trim());
      formPayload.append('emailVerified', String(formData.emailVerified));
      formPayload.append('password', formData.password);
      formPayload.append('sellerLegalName', formData.sellerLegalName);
      formPayload.append('tradeName', formData.tradeName);
      formPayload.append('tin', formData.tin);
      formPayload.append('businessLicenseNumber', formData.businessLicenseNumber);
      formPayload.append('city', formData.city);
      formPayload.append('subCity', formData.subCity);
      formPayload.append('buildingName', formData.buildingName);
      formPayload.append('floor', formData.floor);
      formPayload.append('gpsLocation', formData.gpsLocation || '');
      formPayload.append('certified', 'true');
      if (formData.documentFile) {
        formPayload.append('document', formData.documentFile);
      } else if (formData.uploadedFileName) {
        formPayload.append('uploadedFileName', formData.uploadedFileName);
        formPayload.append('uploadedFileSize', formData.uploadedFileSize);
      }

      const idempotencyKey = `reg-${formData.tin.trim()}-${formData.email.trim().toLowerCase()}`;
      const res = await fetch(`${API_BASE_URL}/api/registration/submit`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: formPayload,
      });

      const data = (await res.json()) as {
        success?: boolean;
        data?: { referenceNumber?: string };
        error?: string;
      };
      if (!res.ok || !data.success || !data.data?.referenceNumber) {
        throw new Error(data.error || 'Registration could not be submitted. Please try again.');
      }
      assignedRef = data.data.referenceNumber;
    } catch (submitError) {
      setStepError(
        submitError instanceof Error
          ? submitError.message
          : 'Registration could not be submitted. Please try again.'
      );
      setIsSubmitting(false);
      return;
    }

    // Save directly to the user's profile
    const profile: MerchantUserProfile = {
      fullName: formData.fullName,
      phoneNumber: formData.phoneNumber,
      email: formData.email.trim(),
      sellerLegalName: formData.sellerLegalName,
      tradeName: formData.tradeName,
      tin: formData.tin,
      businessLicenseNumber: formData.businessLicenseNumber,
      uploadedFileName: formData.uploadedFileName,
      uploadedFileSize: formData.uploadedFileSize,
      city: formData.city,
      subCity: formData.subCity,
      buildingName: formData.buildingName,
      floor: formData.floor,
      gpsLocation: formData.gpsLocation,
      referenceNumber: assignedRef,
      status: 'Pending',
      registeredAt: new Date().toISOString(),
    };
    saveStoredMerchantProfile(profile);

    // Explicitly persist phone number and session so the phone number entered is never lost
    if (formData.tin && formData.phoneNumber) {
      window.localStorage.setItem(`ereceipt_phone_${formData.tin}`, formData.phoneNumber);
    }
    const registeredSession = {
      id: assignedRef,
      role: 'merchant',
      tin: formData.tin,
      businessName: formData.sellerLegalName,
      tradeName: formData.tradeName,
      fullName: formData.fullName,
      phoneNumber: formData.phoneNumber,
      email: formData.email.trim(),
      businessLicenseNumber: formData.businessLicenseNumber,
      city: formData.city,
      subCity: formData.subCity,
      buildingName: formData.buildingName,
      floor: formData.floor,
      gpsLocation: formData.gpsLocation,
      referenceNumber: assignedRef,
      status: 'Pending',
    };
    window.localStorage.setItem('ereceipt_merchant', JSON.stringify(registeredSession));
    window.localStorage.setItem('merchant_user', JSON.stringify(registeredSession));

    setSubmittedRef(assignedRef);
    setIsSubmitted(true);
    setIsSubmitting(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setStepError(null);
    if (step > 1) {
      setStep((prev) => (prev - 1) as RegistrationStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // If application was submitted, show WorkflowPipelineStepper inside CenteredCardLayout
  if (isSubmitted) {
    const today = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return (
      <CenteredCardLayout onLogoClick={onHomeClick}>
        <WorkflowPipelineStepper
          referenceNumber={submittedRef}
          submissionDate={today}
          onReturnToSignIn={() => {
            if (onSignInClick) {
              onSignInClick();
            } else {
              setIsSubmitted(false);
              setStep(1);
            }
          }}
          onContactSupport={() => {
            alert('Support contact: support@ereceipt.et | +251 11 550 0000');
          }}
        />
      </CenteredCardLayout>
    );
  }

  return (
    <AuthSplitLayout onLogoClick={onHomeClick}>
      {/* Step Indicator Progress Bar */}
      <div className={styles.progressBarContainer}>
        <div className={styles.progressLabelRow}>
          <span>Step {step} of 5</span>
          <span>{STEP_TITLES[step]}</span>
        </div>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${step * 20}%` }}
          />
        </div>
      </div>

      {/* Heading */}
      <div className={styles.headingWrapper}>
        <p className="eyebrow">Merchant registration</p>
        <h1 className={styles.pageTitle}>{STEP_TITLES[step]}</h1>
        <p className={styles.pageSubtitle}>
          Tell us about your business. You can review everything before submitting.
        </p>
      </div>

      {/* Multi-Step Form */}
      <form onSubmit={handleSubmit} className={styles.formContent} autoComplete="off">
        {step === 1 && (
          <Step1AccountDetails
            formData={formData}
            onChange={updateFormData}
          />
        )}

        {step === 2 && (
          <Step2TaxIdentity
            formData={formData}
            onChange={updateFormData}
          />
        )}

        {step === 3 && (
          <Step3Licenses
            formData={formData}
            onChange={updateFormData}
          />
        )}

        {step === 4 && (
          <Step4BusinessLocation
            formData={formData}
            onChange={updateFormData}
          />
        )}

        {step === 5 && (
          <Step5Review
            formData={formData}
            onChange={updateFormData}
            onGoToStep={(targetStep) => {
              setStep(targetStep);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* Error Alert Banner */}
        {stepError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              color: '#B91C1C',
              fontSize: '13px',
              fontWeight: 500,
            }}
            role="alert"
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{stepError}</span>
          </div>
        )}

        {/* Buttons */}
        <div className={styles.buttonsStack}>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`btn-primary ${styles.fullWidthBtn}`}
          >
            {isSubmitting
              ? 'Submitting application…'
              : step === 5
              ? 'Submit for MoR EIMS accreditation'
              : 'Continue'}
          </button>

          {step > 1 && (
            <button
              type="button"
              className={`btn-secondary ${styles.fullWidthBtn}`}
              onClick={handleBack}
            >
              Back
            </button>
          )}
        </div>
      </form>

      {/* Switch to Sign In */}
      <p className={styles.switchAuthRow}>
        Already registered?{' '}
        <button
          type="button"
          className={styles.signInLink}
          onClick={onSignInClick || (() => alert('Sign in navigation clicked'))}
        >
          Sign in
        </button>
      </p>

      {/* Resend Email OTP Verification Modal */}
      <MerchantEmailOtpModal
        isOpen={isOtpModalOpen}
        email={formData.email}
        recipientName={formData.fullName}
        onClose={() => setIsOtpModalOpen(false)}
        onVerified={() => {
          setFormData((prev) => ({ ...prev, emailVerified: true }));
          setIsOtpModalOpen(false);
          setStep(2);
          setStepError(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </AuthSplitLayout>
  );
};

export default MerchantRegistration;
