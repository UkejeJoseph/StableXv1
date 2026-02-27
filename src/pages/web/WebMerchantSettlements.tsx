import { useState, useEffect } from "react";
import { WebLayout } from "@/components/WebSidebar";
import { Landmark, CheckCircle2, Clock, ArrowUpRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Settlement {
    batchId: string;
    amount: number;
    currency: string;
    txCount: number;
    status: "settled" | "pending" | "processing";
    bankName: string;
    accountLast4: string;
    settledAt: string;
}

interface Summary {
    totalSettledNGN: number;
    totalPendingNGN: number;
    totalBatches: number;
}

export default function WebMerchantSettlements() {
    const [filter, setFilter] = useState<"all" | "settled" | "pending">("all");
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [summary, setSummary] = useState<Summary>({ totalSettledNGN: 0, totalPendingNGN: 0, totalBatches: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSettlements();
    }, []);

    const fetchSettlements = async () => {
        try {
            const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
            const res = await fetch("/api/merchant/settlements", {
                credentials: "include",
        
            });
            const data = await res.json();
            if (data.success) {
                setSettlements(data.data);
                setSummary(data.summary);
            }
        } catch (err) {
            console.error("Failed to fetch settlements:", err);
        } finally {
            setLoading(false);
        }
    };

    const filtered = filter === "all" ? settlements : settlements.filter(s => s.status === filter);

    return (
        <WebLayout>
            <div className="space-y-6 max-w-4xl">

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Landmark className="w-8 h-8 text-[#F0B90B]" />
                        Settlements
                    </h1>
                    <p className="text-muted-foreground">
                        Track your settlement batches and payout history.
                    </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-card/50 border-border/30 p-5">
                        <p className="text-xs text-muted-foreground mb-1">Total Settled (NGN)</p>
                        <p className="text-2xl font-bold text-green-500">₦{summary.totalSettledNGN.toLocaleString()}</p>
                    </Card>
                    <Card className="bg-card/50 border-border/30 p-5">
                        <p className="text-xs text-muted-foreground mb-1">Pending Settlement</p>
                        <p className="text-2xl font-bold text-yellow-400">₦{summary.totalPendingNGN.toLocaleString()}</p>
                    </Card>
                    <Card className="bg-card/50 border-border/30 p-5">
                        <p className="text-xs text-muted-foreground mb-1">Total Batches</p>
                        <p className="text-2xl font-bold">{summary.totalBatches}</p>
                    </Card>
                </div>

                {/* Filter + Table */}
                <Card className="bg-card/50 border-border/30 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Settlement History</h2>
                        <div className="flex gap-2">
                            {(["all", "settled", "pending"] as const).map(f => (
                                <Button
                                    key={f}
                                    variant={filter === f ? "default" : "outline"}
                                    size="sm"
                                    className={`text-xs capitalize h-7 ${filter === f ? "bg-[#F0B90B] text-black" : "border-border/30"}`}
                                    onClick={() => setFilter(f)}
                                >
                                    {f}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        {loading ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground">
                                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading settlements...
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                No settlements found.
                            </div>
                        ) : (
                            filtered.map(s => (
                                <div key={s.batchId} className="flex items-center justify-between p-4 bg-background/30 rounded-lg border border-border/10 hover:border-border/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        {s.status === "settled" ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        ) : s.status === "processing" ? (
                                            <ArrowUpRight className="w-5 h-5 text-blue-400 animate-pulse" />
                                        ) : (
                                            <Clock className="w-5 h-5 text-yellow-400" />
                                        )}
                                        <div>
                                            <p className="text-sm font-medium">{s.batchId}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {s.txCount} transactions · {s.bankName} ****{s.accountLast4}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold">
                                            {s.currency === "NGN" ? "₦" : ""}{s.amount.toLocaleString()} {s.currency !== "NGN" ? s.currency : ""}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">{new Date(s.settledAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

            </div>
        </WebLayout>
    );
}
