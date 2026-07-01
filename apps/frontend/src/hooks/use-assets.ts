'use client';

import { useCallback, useEffect, useState } from 'react';
import { assetService } from '../services/asset.service';
import type { Asset, AssetFilters } from '../types/asset';
import type { PaginationMeta } from '../types/common';

interface UseAssetsReturn {
  assets: Asset[];
  isLoading: boolean;
  error: string | null;
  pagination: PaginationMeta | null;
  fetchAssets: (filters?: AssetFilters) => Promise<void>;
  createAsset: (data: Partial<Asset>) => Promise<{ success: boolean; message: string }>;
  updateAsset: (id: number, data: Partial<Asset>) => Promise<{ success: boolean; message: string }>;
  deleteAsset: (id: number) => Promise<{ success: boolean; message: string }>;
  refetch: () => Promise<void>;
}

export function useAssets(initialFilters?: AssetFilters): UseAssetsReturn {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [currentFilters, setCurrentFilters] = useState<AssetFilters>(initialFilters || {});

  const fetchAssets = useCallback(async (filters?: AssetFilters) => {
    setIsLoading(true);
    setError(null);
    
    const filtersToUse = filters || currentFilters;
    if (filters) {
      setCurrentFilters(filters);
    }

    try {
      const response = await assetService.getAll(filtersToUse);
      
      if (response.success) {
        setAssets(response.data);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      } else {
        setError(response.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch assets');
    } finally {
      setIsLoading(false);
    }
  }, [currentFilters]);

  const createAsset = useCallback(async (data: Partial<Asset>) => {
    try {
      const response = await assetService.create(data);
      if (response.success) {
        await fetchAssets();
      }
      return { success: response.success, message: response.message };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to create asset' };
    }
  }, [fetchAssets]);

  const updateAsset = useCallback(async (id: number, data: Partial<Asset>) => {
    try {
      const response = await assetService.update(id, data);
      if (response.success) {
        await fetchAssets();
      }
      return { success: response.success, message: response.message };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to update asset' };
    }
  }, [fetchAssets]);

  const deleteAsset = useCallback(async (id: number) => {
    try {
      const response = await assetService.delete(id);
      if (response.success) {
        await fetchAssets();
      }
      return { success: response.success, message: response.message };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to delete asset' };
    }
  }, [fetchAssets]);

  const refetch = useCallback(async () => {
    await fetchAssets(currentFilters);
  }, [fetchAssets, currentFilters]);

  useEffect(() => {
    fetchAssets();
  }, []);

  return {
    assets,
    isLoading,
    error,
    pagination,
    fetchAssets,
    createAsset,
    updateAsset,
    deleteAsset,
    refetch,
  };
}

export default useAssets;
