import React, { useState } from 'react';
import { ShieldCheck, Check, Clock, HelpCircle, ArrowRight, Copy, CheckCheck } from 'lucide-react';
import styles from './WorkflowPipelineStepper.module.css';

interface WorkflowPipelineStepperProps {
  referenceNumber?: string;
  submissionDate?: string;
  onReturnToSignIn?: () => void;
  onContactSupport?: () => void;
}

export const WorkflowPipelineStepper: React.FC<WorkflowPipelineStepperProps> = ({
  referenceNumber = '—',
  submissionDate = '—',
  onReturnToSignIn,
  onContactSupport,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyRef = () => {
    if (referenceNumber && referenceNumber !== '—') {
      navigator.clipboard.writeText(referenceNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const steps = [
    {
      number: '1',
      title: 'Submitted to Revenue Authority',
      desc: 'Application and documents successfully registered',
      status: 'completed',
    },
    {
      number: '2',
      title: 'Ministry of Revenues Review',
      desc: 'Tax compliance, TIN verification, and document audit',
      status: 'in_progress',
    },
    {
      number: '3',
      title: 'MoR EIMS Clearance & Approval',
      desc: 'Issuance of live POS digital fiscal certificates',
      status: 'pending',
    },
  ];

  return (
    <div className={styles.container}>
      {/* Header Badge */}
      <div className={styles.headerRow}>
        <div className={styles.shieldBadge}>
          <ShieldCheck size={28} />
        </div>
        <div className={styles.statusPill}>
          <span className={styles.statusPulse} />
          <span>Under MoR Review</span>
        </div>
      </div>

      <h1 className={styles.title}>Application Submitted Successfully</h1>

      <p className={styles.description}>
        Your business tax registration and digital fiscal integration request has been securely submitted to the <strong>Ministry of Revenues</strong>.
      </p>

      {/* Official Reference Token Card */}
      <div className={styles.referenceBox}>
        <div className={styles.referenceTop}>
          <span className={styles.referenceLabel}>Accreditation Reference Number</span>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleCopyRef}
            title="Copy reference number"
          >
            {copied ? (
              <>
                <CheckCheck size={14} className={styles.copiedIcon} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <div className={styles.referenceValue}>{referenceNumber}</div>
        <div className={styles.referenceFooter}>
          <span>Submitted on: <strong>{submissionDate}</strong></span>
          <span className={styles.reviewTimeline}>Est. Review: 24-48h</span>
        </div>
      </div>

      {/* Modern Stepper Timeline */}
      <div className={styles.stepperContainer}>
        {steps.map((s, idx) => {
          const isDone = s.status === 'completed';
          const isInProgress = s.status === 'in_progress';
          return (
            <div key={s.number} className={styles.stepperItem}>
              <div className={styles.indicatorCol}>
                <div
                  className={`${styles.stepIndicator} ${
                    isDone
                      ? styles.stepDone
                      : isInProgress
                      ? styles.stepInProgress
                      : styles.stepPending
                  }`}
                >
                  {isDone ? (
                    <Check size={16} strokeWidth={3} />
                  ) : isInProgress ? (
                    <Clock size={16} className={styles.inProgressIcon} />
                  ) : (
                    <span>{s.number}</span>
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`${styles.connectorLine} ${
                      isDone ? styles.connectorDone : ''
                    }`}
                  />
                )}
              </div>
              <div className={styles.stepDetails}>
                <p className={styles.stepTitle}>{s.title}</p>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className={styles.actionsRow}>
        <button
          type="button"
          className={`btn-primary ${styles.primaryBtn}`}
          onClick={onReturnToSignIn}
        >
          <span>Return to sign in</span>
          <ArrowRight size={16} />
        </button>
        <button
          type="button"
          className={`btn-secondary ${styles.secondaryBtn}`}
          onClick={onContactSupport}
        >
          <HelpCircle size={16} />
          <span>Contact Tax Support</span>
        </button>
      </div>
    </div>
  );
};

export default WorkflowPipelineStepper;
