import { useState, useEffect } from "react";
import { WebLayout } from "@/components/WebSidebar";
import { Card } from "@/components/ui/card";
import { Copy, ArrowDownLeft, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";

interface Transaction {
    _id: string;
    type: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    reference: string;
    description: string;
}

const WebMerchantPayIns = () => {
    const { user } = useUser();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTransactions();
    }, [user]);

    const fetchTransactions = async () => {
        if (!user) return;
        try {
            const res = await fetch("/api/transactions/history", {
                credentials: "include",
            });
            const data = await res.json();
            if (data.success) {
                // Filter only for pay-ins (deposits) that look like checkout payments or standard deposits
                const payIns = data.data.filter((tx: Transaction) => tx.type === 'deposit');
                setTransactions(payIns);
            }
        } catch (error) {
            console.error("Failed to fetch transactions", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <WebLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent flex items-center gap-3">
                        <ArrowDownLeft className="w-8 h-8 text-primary" /> Pay-ins Ledger
                    </h1>
                    <p className="text-muted-foreground mt-1">Track all incoming funds from checkouts, customers, and manual deposits.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by reference or description..."
                            className="pl-9 border-border/50 bg-card focus-visible:ring-primary/50"
                        />
                    </div>
                    <Button variant="outline" className="border-border/50 bg-card">
                        <Filter className="w-4 h-4 mr-2" /> Filter
                    </Button>
                </div>

                <Card className="border-border/40 bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border/20">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Description</th>
                                    <th className="px-6 py-4 font-medium">Reference</th>
                                    <th className="px-6 py-4 font-medium">Date</th>
                                    <th className="px-6 py-4 font-medium text-right">Amount</th>
                                    <th className="px-6 py-4 font-medium text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                                {loading ? (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground animate-pulse">Loading ledger...</td></tr>
                                ) : transactions.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No incoming payments found yet.</td></tr>
                                ) : (
                                    transactions.map((tx) => (
                                        <tr key={tx._id} className="hover:bg-muted/10 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-white">{tx.description || "Incoming Payment"}</div>
                                                <div className="text-xs text-muted-foreground capitalize">{tx.type}</div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-muted-foreground truncate max-w-[150px]">
                                                {tx.reference}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {new Date(tx.createdAt).toLocaleString(undefined, {
                                                    month: 'short', day: 'numeric', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="font-bold text-green-500">
                                                    +{tx.amount.toLocaleString(undefined, { minimumFractionDigits: tx.currency === 'USDT' ? 2 : 0 })} {tx.currency}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${tx.status === 'completed' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                                    tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                                                        'bg-red-500/10 text-red-500 border border-red-500/20'
                                                    }`}>
                                                    {tx.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </WebLayout>
    );
};

export default WebMerchantPayIns;
