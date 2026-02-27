import { useQuery } from '@tanstack/react-query';

export type AppBalances = {
    NGN: number;
    USDT: number;
    BTC: number;
    ETH: number;
    TRX: number;
    [key: string]: number;
};

export const useBalances = () => {
    return useQuery({
        queryKey: ['userBalances'],
        queryFn: async (): Promise<AppBalances> => {
            const res = await fetch("/api/users/profile", {
                credentials: "include",
            });

            if (!res.ok) {
                // If unauthorized, return empty balances instead of throwing
                if (res.status === 401) {
                    return { NGN: 0, USDT: 0, BTC: 0, ETH: 0, TRX: 0 };
                }
                throw new Error("Failed to fetch balances");
            }

            const data = await res.json();

            const balances: AppBalances = {
                NGN: 0,
                USDT: 0,
                USDT_ERC20: 0,
                BTC: 0,
                ETH: 0,
                TRX: 0,
            };

            if (data.wallets && Array.isArray(data.wallets)) {
                data.wallets.forEach((wallet: any) => {
                    if (wallet.currency) {
                        balances[wallet.currency] = wallet.balance || 0;
                    }
                });
            }

            return balances;
        },
        refetchInterval: 10000, // Auto-refresh every 10 seconds
        staleTime: 5000,
    });
};
