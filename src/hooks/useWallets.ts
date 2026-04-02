import { type StoredWallet } from '@/lib/wallet';
import { apiFetch } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export function useWallets() {
    return useQuery({
        queryKey: ['wallets'],
        queryFn: async () => {
            const res = await apiFetch("/api/wallets");

            if (!res.ok) {
                // Return empty array on 401/unauthorized
                if (res.status === 401) return [];
                throw new Error("Failed to fetch wallets");
            }

            const data = await res.json();
            return data.wallets as StoredWallet[];
        }
    });
}
