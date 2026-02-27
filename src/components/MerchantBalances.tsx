import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowUpFromLine, Replace, History } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { useUser } from "@/contexts/UserContext";

export function MerchantBalances() {
    const { user } = useUser();
    const [summaryData, setSummaryData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>("NGN");
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

    const tabs = ["NGN", "USDT", "BTC", "ETH", "SOL"];

    const fetchSummary = async () => {
        if (!user) return;
        try {
            const res = await fetch("/api/dashboard/summary", {
                credentials: "include",
            });
            const data = await res.json();
            setSummaryData(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, [user]);

    const activeWallet = summaryData?.wallets?.find((w: any) => w.currency === activeTab) || { balance: 0, pending: 0 };

    // Format amounts cleanly based on currency
    const formatAmount = (val: number, curr: string) => {
        if (val === undefined || val === null) return "0.00";
        if (curr === 'BTC' || curr === 'ETH') return val.toFixed(6);
        if (curr === 'SOL') return val.toFixed(4);
        return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <Card className="bg-card border-border/40 w-full overflow-hidden mb-6" data-testid="merchant-balances">
            {/* Currency Tabs */}
            <div className="flex items-center gap-6 px-6 pt-4 border-b border-border/20 overflow-x-auto overflow-y-hidden hide-scrollbar">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-3 text-sm font-semibold transition-colors whitespace-nowrap border-b-2 ${activeTab === tab ? "border-[#F0B90B] text-[#F0B90B]" : "border-transparent text-muted-foreground hover:text-white"
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    {/* Balances Display */}
                    <div className="flex gap-10">
                        <div className="space-y-1 opacity-60">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Balance ({activeTab})</h2>
                            <h1 className="text-2xl font-semibold text-foreground">
                                {isLoading ? "..." : formatAmount(activeWallet.pending || 0, activeTab)}
                            </h1>
                            <p className="text-[10px] text-muted-foreground mt-1">Funds waiting to be settled.</p>
                        </div>
                        <div className="space-y-1 border-l border-border/20 pl-6">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available Balance ({activeTab})</h2>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                                {isLoading ? "..." : formatAmount(activeWallet.balance || 0, activeTab)}
                            </h1>
                            <p className="text-xs text-muted-foreground mt-1">For withdrawals or payouts.</p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3 w-full md:w-auto">
                        <Button asChild className="w-full bg-[#1bc553] hover:bg-[#1bc553]/90 text-white font-bold h-11">
                            <Link to={getDynamicPath("/deposit")}>
                                Add Funds <Plus className="w-4 h-4 ml-2" />
                            </Link>
                        </Button>
                        <div className="flex gap-3">
                            <Button asChild variant="default" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-10">
                                <Link to={getDynamicPath("/withdraw")}>
                                    Withdraw <ArrowUpFromLine className="w-4 h-4 ml-2" />
                                </Link>
                            </Button>
                            <Button asChild variant="secondary" className="flex-1 font-bold h-10 bg-muted/50 hover:bg-muted text-foreground border border-border/50">
                                <Link to={getDynamicPath("/convert")}>
                                    <Replace className="w-4 h-4 mr-2" /> Convert Funds
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Balance History Tab Link */}
                <div className="mt-8 flex items-center justify-between border-b border-border/20 pb-2">
                    <div className="flex items-center gap-6">
                        <button className="pb-2 text-sm font-semibold text-blue-400 border-b-2 border-blue-400">Balance history</button>
                        <button className="pb-2 text-sm font-semibold text-muted-foreground hover:text-white border-b-2 border-transparent">Lien history</button>
                    </div>
                    <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
                        <History className="w-3.5 h-3.5 mr-2" /> Export History
                    </Button>
                </div>
            </div>
        </Card>
    );
}
