import { useState, useEffect } from "react";
import { Eye, EyeOff, ArrowDownToLine, ArrowUpFromLine, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useLocation } from "react-router-dom";
import { getMarketPrices } from "@/lib/marketData";

export function PortfolioOverview() {
    const [isHidden, setIsHidden] = useState(false);
    const [summaryData, setSummaryData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [totalUsdBalance, setTotalUsdBalance] = useState(0);
    const location = useLocation();
    const isWeb = location.pathname.startsWith('/web');

    const getDynamicPath = (path: string) => {
        if (isWeb && !path.startsWith('/web')) {
            return `/web${path}`;
        } else if (!isWeb && path.startsWith('/web')) {
            return path.replace('/web', '');
        }
        return path;
    };

    const fetchSummary = async () => {
        try {
            const res = await fetch("/api/dashboard/summary", {
                credentials: "include",
            });
            if (!res.ok) throw new Error("Could not fetch portfolio summary");
            const data = await res.json();
            setSummaryData(data);

            const prices = await getMarketPrices();
            let total = 0;
            data.wallets?.forEach((w: any) => {
                if (w.currency === "NGN") {
                    total += w.balance * 0.00062;
                } else if (w.currency === "USDT" || w.currency === "USDT_ERC20") {
                    total += w.balance;
                } else {
                    const priceData = prices.find(p => p.symbol === w.currency);
                    if (priceData) {
                        total += w.balance * priceData.price;
                    }
                }
            });
            setTotalUsdBalance(total);
        } catch (e: any) {
            console.warn("Portfolio Summary Error:", e.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, []);

    const formatUsd = (val: number) => `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <Card className="p-6 bg-card border-border/40 w-full relative overflow-hidden" data-testid="portfolio-overview">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <h2 className="text-sm font-medium">Estimated Balance</h2>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsHidden(!isHidden)}>
                            {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                    </div>

                    <div className="flex items-end gap-3">
                        {isLoading ? (
                            <div className="h-10 w-32 bg-muted animate-pulse rounded flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
                            </div>
                        ) : (
                            <h1 className="text-4xl font-bold text-foreground">
                                {isHidden ? "********" : formatUsd(totalUsdBalance)}
                            </h1>
                        )}
                        <span className="text-sm text-muted-foreground pb-1">USD</span>
                    </div>

                    {!isLoading && summaryData?.dayPnL && (
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm font-medium text-muted-foreground">Today's PNL</span>
                            <span className={`text-sm font-semibold ${summaryData.dayPnL.amount >= 0 ? "text-green-500" : "text-red-500"}`}>
                                {isHidden ? "****" : `${summaryData.dayPnL.amount >= 0 ? "+" : ""}${formatUsd(summaryData.dayPnL.amount)} (${summaryData.dayPnL.percentage}%)`}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex bg-muted/30 p-2 rounded-xl gap-2 w-full md:w-auto overflow-x-auto">
                    <Button asChild size="lg" className="bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-black font-semibold rounded-lg flex-1 min-w-[120px]">
                        <Link to={getDynamicPath("/deposit")}>
                            <ArrowDownToLine className="w-4 h-4 mr-2" />
                            Deposit
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="secondary" className="font-semibold rounded-lg flex-1 min-w-[120px]">
                        <Link to={getDynamicPath("/withdraw")}>
                            <ArrowUpFromLine className="w-4 h-4 mr-2" />
                            Withdraw
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="font-semibold rounded-lg flex-1 min-w-[120px]">
                        <Link to={getDynamicPath("/convert")}>
                            <Plus className="w-4 h-4 mr-2" />
                            Trade
                        </Link>
                    </Button>
                </div>
            </div>
        </Card>
    );
}
