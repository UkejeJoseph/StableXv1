import { useState, useEffect } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PriceData {
    time: string;
    price: number;
}

interface PriceChartProps {
    symbol: string;
}

type Timeframe = "1H" | "24H" | "7D";

export function PriceChart({ symbol }: PriceChartProps) {
    const [data, setData] = useState<PriceData[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<Timeframe>("24H");

    // Binance symbol mapping (e.g., BTC -> BTCUSDT)
    const binanceSymbol = symbol.toUpperCase() === "USDT" ? "" : `${symbol.toUpperCase()}USDT`;

    useEffect(() => {
        if (!binanceSymbol) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                let interval = "1h";
                let limit = 24;

                if (timeframe === "1H") {
                    interval = "1m";
                    limit = 60;
                } else if (timeframe === "7D") {
                    interval = "4h";
                    limit = 42;
                }

                const response = await fetch(
                    `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`
                );
                const klines = await response.json();

                const formattedData = klines.map((k: any) => ({
                    time: new Date(k[0]).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        ...(timeframe === "7D" ? { day: "numeric", month: "short" } : {}),
                    }),
                    price: parseFloat(k[4]), // Close price
                }));

                setData(formattedData);
            } catch (error) {
                console.error("Failed to fetch price data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [binanceSymbol, timeframe]);

    if (!binanceSymbol) {
        return (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
                No chart available for {symbol}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2 justify-center">
                {(["1H", "24H", "7D"] as Timeframe[]).map((tf) => (
                    <Button
                        key={tf}
                        variant={timeframe === tf ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeframe(tf)}
                        className="h-8 w-12 text-xs"
                    >
                        {tf}
                    </Button>
                ))}
            </div>

            <div className="h-64 w-full">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.4} />
                            <XAxis
                                dataKey="time"
                                stroke="#64748b"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                            />
                            <YAxis
                                hide={false}
                                domain={["auto", "auto"]}
                                stroke="#64748b"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `$${value.toLocaleString()}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "#0b0e11",
                                    borderColor: "#334155",
                                    borderRadius: "8px",
                                    fontSize: "12px",
                                }}
                                itemStyle={{ color: "#fff" }}
                                labelStyle={{ color: "#64748b", marginBottom: "4px" }}
                                formatter={(value: number) => [`$${value.toLocaleString()}`, "Price"]}
                            />
                            <Line
                                type="monotone"
                                dataKey="price"
                                stroke="#F0B90B"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4, fill: "#F0B90B" }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
