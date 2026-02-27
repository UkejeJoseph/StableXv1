import { useQuery } from '@tanstack/react-query';
import { type StoredWallet } from '@/lib/wallet';

export function useWallets() {
    return useQuery({
        queryKey: ['wallets'],
        queryFn: async () => {
            const res = await fetch("/api/wallets", {
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                }
            });

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
