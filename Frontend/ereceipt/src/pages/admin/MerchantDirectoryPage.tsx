import React, { useState, useEffect } from 'react';
import { TaxpayerSearchCard } from '../../features/admin/merchant-directory/components/TaxpayerSearchCard';
import { MerchantDirectoryTable } from '../../features/admin/merchant-directory/components/MerchantDirectoryTable';
import type { DirectoryMerchantItem } from '../../features/admin/types';
import { API_BASE_URL } from '../../config/api';

export const MerchantDirectoryPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [directoryQuery, setDirectoryQuery] = useState('');

  const [merchants, setMerchants] = useState<DirectoryMerchantItem[]>([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/admin/merchants/directory`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setMerchants(data.data);
        }
      })
      .catch(() => {});
  }, []);

  const filteredMerchants = merchants.filter(
    (m) =>
      !directoryQuery ||
      `${m.tin} ${m.id} ${m.name}`.toLowerCase().includes(directoryQuery.toLowerCase())
  );

  return (
    <div>
      <TaxpayerSearchCard
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => setDirectoryQuery(searchQuery)}
      />
      <MerchantDirectoryTable
        merchants={filteredMerchants}
        onViewDetails={(tin) => alert(`Viewing details for TIN ${tin}`)}
        getToneForStatus={(status) => (status.includes('Approved') ? 'success' : 'pending')}
      />
    </div>
  );
};

export default MerchantDirectoryPage;
