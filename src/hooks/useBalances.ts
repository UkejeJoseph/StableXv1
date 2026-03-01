import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "";

export const useBalances = () => {
    const [balances, setBalances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchBalances = async () => {
        try {
            setLoading(true);
            setError(null);

            const res = await fetch(`${API}/api/wallet/`, {
                credentials: 'include'
            });

            if (!res.ok) {
                if (res.status === 401) {
                    setBalances([]);
                    return;
                }
                throw new Error('Failed to fetch balances');
            }

            const data = await res.json();
            setBalances(data.wallets || data.data || data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBalances();
    }, []);

    return { balances, loading, error, refetch: fetchBalances };
};
