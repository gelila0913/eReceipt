import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { merchantManagementStorage } from './merchant.storage.js';
import { applicationStorage } from '../../merchant-registration/storage.js';
import type {
  MerchantApplicationItem,
  DirectoryMerchantItem,
  DecisionPayload,
  ApplicationQuery,
  DirectoryQuery,
  ApplicationReviewStatus,
} from './merchant.types.js';
import { otpService } from '../../../services/otp.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../../data');
const AUDIT_FILE = path.join(DATA_DIR, 'admin-audit-log.json');

/**
 * Persists an audit entry to the shared audit trail
 */
function recordAuditEvent(entry: {
  officer: string;
  action: string;
  reference: string;
  statusTransition: string;
  notes: string;
}) {
  try {
    const timestamp = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const fullEvent = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp,
      ...entry,
    };

    let events: any[] = [];
    if (fs.existsSync(AUDIT_FILE)) {
      try {
        events = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf-8'));
      } catch {
        events = [];
      }
    }

    events.unshift(fullEvent);
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(events, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to record audit event:', err);
  }
}

export class MerchantManagementService {
  /**
   * Get all merchant onboarding applications
   */
  async listApplications(query?: ApplicationQuery): Promise<MerchantApplicationItem[]> {
    return merchantManagementStorage.getApplications(query);
  }

  /**
   * Get single application by reference number
   */
  async getApplication(ref: string): Promise<MerchantApplicationItem> {
    const app = merchantManagementStorage.getApplicationByRef(ref);
    if (!app) {
      throw new Error(`Merchant application with reference "${ref}" not found.`);
    }
    return app;
  }

  /**
   * Process officer decision (approve, request, reject)
   */
  async submitDecision(ref: string, payload: DecisionPayload): Promise<{
    application: MerchantApplicationItem;
    directoryRecord?: DirectoryMerchantItem;
    message: string;
    notificationSent: boolean;
    notificationWarning?: string;
  }> {
    const current = merchantManagementStorage.getApplicationByRef(ref);
    if (!current) {
      throw new Error(`Merchant application with reference "${ref}" not found.`);
    }

    const officerName = payload.officerName?.trim() || 'Hana Alemu · RO-218';
    const reason = payload.reason?.trim() || (payload.kind === 'approve' ? 'Verification checks completed' : 'Administrative review action');

    let nextStatus: ApplicationReviewStatus;
    let actionText: string;

    switch (payload.kind) {
      case 'approve':
        nextStatus = 'Approved';
        actionText = 'Merchant approved';
        break;
      case 'request':
        nextStatus = 'Additional Information Required';
        actionText = 'Additional information requested';
        break;
      case 'reject':
        nextStatus = 'Rejected';
        actionText = 'Merchant rejected';
        break;
      default:
        throw new Error(`Invalid decision kind "${payload.kind}". Must be 'approve', 'request', or 'reject'.`);
    }
    if (payload.kind === 'reject' && !payload.reason.trim()) {
      throw new Error('A reason is required when rejecting a merchant application.');
    }

    const previousStatus = current.status;
    const updatedApplication = merchantManagementStorage.updateApplicationStatus(
      ref,
      nextStatus,
      officerName,
      reason
    );

    if (!updatedApplication) {
      throw new Error(`Failed to update application "${ref}".`);
    }

    let directoryRecord: DirectoryMerchantItem | undefined;

    // If approved, automatically register into central Taxpayers Directory
    if (nextStatus === 'Approved') {
      const nowFormatted = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const newTaxpayer: DirectoryMerchantItem = {
        id: updatedApplication.merchantId,
        name: updatedApplication.name,
        tin: updatedApplication.tin,
        category: updatedApplication.category,
        classification: 'VAT', // Default MoR standard classification
        status: 'Active',
        authorization: 'Authorized',
        registeredDate: nowFormatted,
        address: updatedApplication.address,
        contactPhone: updatedApplication.phoneNumber,
        vatRegistrationNumber: `VAT-ET-${new Date().getFullYear()}-${updatedApplication.tin.slice(-4)}`,
        monthlySalesAvg: 0,
      };

      directoryRecord = merchantManagementStorage.addDirectoryMerchant(newTaxpayer);
    }

    // Record in central audit log
    recordAuditEvent({
      officer: officerName,
      action: actionText,
      reference: ref,
      statusTransition: `${previousStatus} → ${nextStatus}`,
      notes: reason,
    });

    const registration = applicationStorage.getByReference(ref);
    let notificationSent = false;
    let notificationWarning: string | undefined;
    if (registration?.email) {
      try {
        notificationSent = await otpService.sendMerchantStatusNotification({
          email: registration.email,
          recipientName: registration.fullName,
          referenceNumber: ref,
          status: nextStatus,
          reason,
        });
      } catch (error) {
        notificationWarning =
          error instanceof Error ? error.message : 'Merchant notification delivery failed.';
        console.error(`Application ${ref} was updated but notification delivery failed:`, error);
      }
    } else {
      notificationWarning = 'No merchant email address is available for notification.';
    }

    return {
      application: updatedApplication,
      directoryRecord,
      message: `Application ${ref} successfully updated to "${nextStatus}".`,
      notificationSent,
      notificationWarning,
    };
  }

  /**
   * List approved merchants in directory
   */
  async listDirectory(query?: DirectoryQuery): Promise<DirectoryMerchantItem[]> {
    return merchantManagementStorage.getDirectory(query);
  }

  /**
   * Get directory merchant details
   */
  async getDirectoryMerchant(id: string): Promise<DirectoryMerchantItem> {
    const merchant = merchantManagementStorage.getDirectoryMerchantById(id);
    if (!merchant) {
      throw new Error(`Merchant with identifier "${id}" not found in directory.`);
    }
    return merchant;
  }

  /**
   * Toggle merchant status between Active and Suspended
   */
  async updateStatus(
    id: string,
    status: 'Active' | 'Suspended',
    officerName?: string,
    reason?: string
  ): Promise<DirectoryMerchantItem> {
    const updated = merchantManagementStorage.updateDirectoryStatus(id, status);
    if (!updated) {
      throw new Error(`Merchant "${id}" not found.`);
    }

    const application = applicationStorage.getByTin(updated.tin);
    if (application) {
      applicationStorage.updateStatus(
        application.referenceNumber,
        status === 'Suspended' ? 'Suspended' : 'Approved',
        officerName,
        reason
      );
      if (application.email) {
        try {
          await otpService.sendMerchantStatusNotification({
            email: application.email,
            recipientName: application.fullName,
            referenceNumber: application.referenceNumber,
            status: status === 'Suspended' ? 'Suspended' : 'Approved',
            reason,
          });
        } catch (error) {
          console.error(
            `Merchant ${application.referenceNumber} status changed but email notification failed:`,
            error
          );
        }
      }
    }

    // Log status change
    recordAuditEvent({
      officer: officerName || 'Hana Alemu · RO-218',
      action: 'Receipt authorization changed',
      reference: updated.id,
      statusTransition: `Status changed to ${status}`,
      notes: reason || `Administrative status change to ${status}`,
    });

    return updated;
  }
}

export const merchantManagementService = new MerchantManagementService();
