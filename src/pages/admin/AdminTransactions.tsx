import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Copy, ArrowUpRight, ArrowDownLeft, RefreshCcw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AdminTransactions() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        try {
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            const res = await fetch('/api/admin/transactions?limit=100', {
                credentials: "include",
        
            });
            const data = await res.json();
            setTransactions(data.transactions);
        } catch (error) {
            console.error("Failed to load transactions", error);
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!", description: "Value copied to clipboard" });
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'deposit': return <ArrowDownLeft className="w-4 h-4 text-green-500" />;
            case 'withdraw': return <ArrowUpRight className="w-4 h-4 text-red-500" />;
            case 'transfer': return <ArrowUpRight className="w-4 h-4 text-blue-500" />;
            case 'swap': return <RefreshCcw className="w-4 h-4 text-purple-500" />;
            default: return <Activity className="w-4 h-4 text-muted-foreground" />;
        }
    };

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Global Ledger</h2>
                    <p className="text-muted-foreground mt-2">View all deposits, withdrawals, and internal transfers across StableX.</p>
                </div>

                <Card className="bg-card border-border/50">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Reference / TxHash</TableHead>
                                    <TableHead className="text-right">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.map((tx) => (
                                    <TableRow key={tx._id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                                                    {getTypeIcon(tx.type)}
                                                </div>
                                                <span className="capitalize font-medium">{tx.type}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-bold text-foreground">
                                                {tx.amount?.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tx.currency}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">@{tx.user?.username || 'Unknown'}</span>
                                                <span className="text-xs text-muted-foreground">{tx.user?.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={tx.status === 'completed' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'}
                                                className={tx.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}>
                                                {tx.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1 max-w-[200px]">
                                                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground truncate">
                                                    <span className="truncate">{tx.reference || tx.txHash || 'N/A'}</span>
                                                    {(tx.reference || tx.txHash) && (
                                                        <button onClick={() => copyToClipboard(tx.reference || tx.txHash)}>
                                                            <Copy className="w-3 h-3 hover:text-primary transition-colors shrink-0" />
                                                        </button>
                                                    )}
                                                </div>
                                                {tx.metadata?.network && (
                                                    <Badge variant="outline" className="w-fit text-[10px] h-4">
                                                        {tx.metadata.network}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">
                                            {new Date(tx.createdAt).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {transactions.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No transactions found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
