import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { getMarketPrices } from "@/lib/marketData";
import { useUser } from "@/contexts/UserContext";

const COLORS = ['#F0B90B', '#3b82f6', '#f97316', '#22c59e', '#8b5cf6', '#64748b'];

export function AssetDistributionChart() {
    const { user } = useUser();
    const [data, setData] = useState<{ name: string, value: number, color: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSummary = async () => {
            if (!user) return;
            try {
                const res = await fetch("/api/dashboard/summary", {
                    credentials: "include",
                });

                if (!res.ok) throw new Error("Failed to fetch dashboard summary");

                const summary = await res.json();
                if (!summary.success) throw new Error(summary.message || "Summary fetch failed");

                const prices = await getMarketPrices();
                const chartData: any[] = [];

                if (summary.wallets) {
                    summary.wallets.forEach((w: any, index: number) => {
                        let usdValue = 0;
                        if (w.currency === "NGN") {
                            const ngnPrice = prices.find(p => p.symbol === "NGN")?.price || 0.00062;
                            usdValue = w.balance * ngnPrice;
                        } else if (w.currency === "USDT") {
                            usdValue = w.balance;
                        } else {
                            const priceData = prices.find(p => p.symbol === w.currency);
                            if (priceData) usdValue = w.balance * priceData.price;
                        }

                        if (usdValue > 0) {
                            chartData.push({
                                name: w.currency,
                                value: Number(usdValue.toFixed(2)),
                                color: COLORS[index % COLORS.length]
                            });
                        }
                    });
                }

                if (chartData.length === 0) {
                    chartData.push({ name: 'Empty', value: 100, color: '#334155' });
                }

                setData(chartData);
            } catch (e: any) {
                console.error("Dashboard Summary Error:", e);
                // Fallback to empty state on error
                setData([{ name: 'Empty', value: 100, color: '#334155' }]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSummary();
    }, [user]);

    return (
        <Card className="p-4 bg-card border-border/40 flex flex-col items-center">
            <h3 className="text-sm font-semibold text-foreground self-start mb-2">Asset Allocation</h3>
            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number) => `$${value}`}
                            contentStyle={{ backgroundColor: '#0b0e11', borderColor: '#334155', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
                {data.filter(d => d.name !== 'Empty').map(item => (
                    <div key={item.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                    </div>
                ))}
            </div>
        </Card>
    );
}
