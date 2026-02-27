import { useQuery } from '@tanstack/react-query';
import { type StoredWallet } from '@/lib/wallet';

export function useWallets() {
    return useQuery({
        queryKey: ['wallets'],
        queryFn: async () => {
            const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
            if (!userInfo.token) return [];

            const res = await fetch("/api/wallets", {
                credentials: "include",
        headers: {
                    
                    "Content-Type": "application/json"
                }
            });

            if (!res.ok) {
                throw new Error("Failed to fetch wallets");
            }

            const data = await res.json();
            return data.wallets as StoredWallet[];
        }
    });
}
