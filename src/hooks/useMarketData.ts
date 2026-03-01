import { useState, useEffect, useRef } from 'react';
import { fetchMarketData, MarketData } from '../lib/marketData';

export function useMarketData(pollInterval = 30000) {
    const [data, setData] = useState<MarketData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isStale, setIsStale] = useState(false);
    const intervalRef = useRef<any>();

    const fetch = async () => {
        try {
            console.log('[USE-MARKET-DATA] Fetching prices...');
            const result = await fetchMarketData();
            setData(result);
            setIsStale(result.stale || false);
            setError(null);
            console.log('[USE-MARKET-DATA] ✅ Prices updated');
        } catch (err: any) {
            console.error('[USE-MARKET-DATA] ❌ Fetch failed:', err.message);
            setError('Price data unavailable');
            // Don't clear existing data on error
            // Keep showing last known prices
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetch();

        // Poll every 30 seconds
        intervalRef.current = setInterval(() => {
            // Only poll if tab is visible
            if (!document.hidden) {
                console.log('[USE-MARKET-DATA] Polling prices...');
                fetch();
            } else {
                console.log('[USE-MARKET-DATA] Tab hidden - skipping poll');
            }
        }, pollInterval);

        // Resume polling when tab becomes visible
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                console.log('[USE-MARKET-DATA] Tab visible - fetching prices');
                fetch();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [pollInterval]);

    return { data, loading, error, isStale, refetch: fetch };
}
