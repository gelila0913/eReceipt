import React, { useState, useEffect } from 'react';
import { ApprovalsTabFilter } from '../../features/admin/merchant-approvals/components/ApprovalsTabFilter';
import { ApprovalsTable } from '../../features/admin/merchant-approvals/components/ApprovalsTable';
import type { MerchantApplicationItem } from '../../features/admin/types';
import { API_BASE_URL } from '../../config/api';

export const MerchantApprovalsPage: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('All Applications');
  const [dateFilter, setDateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All business categories');
  const [statusFilter, setStatusFilter] = useState('All statuses');

  const [applications, setApplications] = useState<MerchantApplicationItem[]>([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/admin/merchants/applications`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setApplications(data.data);
        }
      })
      .catch(() => {});
  }, []);

  const filteredApps = applications.filter((app) => {
    const matchesTab = currentTab === 'All Applications' || app.status === currentTab;
    const matchesCategory =
      categoryFilter === 'All business categories' || app.category === categoryFilter;
    const matchesStatus =
      statusFilter === 'All statuses' || app.status.includes(statusFilter);
    return matchesTab && matchesCategory && matchesStatus;
  });

  return (
    <div>
      <ApprovalsTabFilter
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
      />
      <ApprovalsTable
        applications={filteredApps}
        onReviewMerchant={(ref) => {
          setApplications((prev) =>
            prev.map((a) => (a.ref === ref ? { ...a, status: 'Approved' } : a))
          );
        }}
        getToneForStatus={(status) => (status.includes('Approved') ? 'success' : 'pending')}
      />
    </div>
  );
};

export default MerchantApprovalsPage;
