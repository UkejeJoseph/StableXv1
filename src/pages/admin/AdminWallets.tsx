import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Wallet,
    RefreshCcw,
    Copy,
    ExternalLink,
    TrendingUp,
    TrendingDown,
    ShieldCheck,
    AlertTriangle,
    Coins,
    History,
    ChevronDown,
    ChevronUp,
    Plus,
    Minus,
    Loader2,
    Info
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface HotWalletData {
    address: string;
    native: number;
    tokens?: { [key: string]: number };
    liabilities: number;
    solvency?: 'SOLVENT' | 'UNDERFUNDED' | 'UNKNOWN';
    coverage?: number;
    error?: string;
}

interface TreasuryBalance {
    _id: string;
    currency: string;
    balance: number;
}

interface AdminLog {
    id: string;
    date: string;
    type: string;
    currency: string;
    amount: number;
    reason: string;
    admin: string;
}

export default function AdminWallets() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [hotWallets, setHotWallets] = useState<{ [key: string]: HotWalletData }>({});
    const [treasuryBalances, setTreasuryBalances] = useState<TreasuryBalance[]>([]);
    const [auditLogs, setAuditLogs] = useState<AdminLog[]>([]);
    const [isInfoExpanded, setIsInfoExpanded] = useState(false);

    // Modals
    const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
    const [isDebitModalOpen, setIsDebitModalOpen] = useState(false);
    const [selectedCurrency, setSelectedCurrency] = useState("");
    const [actionAmount, setActionAmount] = useState("");
    const [actionReason, setActionReason] = useState("");

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [hwRes, tRes] = await Promise.all([
                fetch('/api/admin/hot-wallets/balances', { credentials: 'include' }),
                fetch('/api/admin/treasury/balances', { credentials: 'include' })
            ]);

            const hwData = await hwRes.json();
            const tData = await tRes.json();

            if (hwData.success) setHotWallets(hwData.data);
            if (tData.success) {
                setTreasuryBalances(tData.balances);
                setAuditLogs(tData.logs);
            }
        } catch (error: any) {
            toast({
                title: "Fetch Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCredit = async () => {
        if (!selectedCurrency || !actionAmount || !actionReason) {
            toast({ title: "Validation Error", description: "All fields are required", variant: "destructive" });
            return;
        }

        setIsActionLoading(true);
        try {
            const res = await fetch('/api/admin/treasury/credit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currency: selectedCurrency,
                    amount: parseFloat(actionAmount),
                    reason: actionReason
                }),
                credentials: 'include'
            });

            const data = await res.json();
            if (data.success) {
                toast({ title: "Success", description: data.message });
                setIsCreditModalOpen(false);
                resetForm();
                fetchData();
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast({ title: "Action Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDebit = async () => {
        if (!selectedCurrency || !actionAmount || !actionReason) {
            toast({ title: "Validation Error", description: "All fields are required", variant: "destructive" });
            return;
        }

        setIsActionLoading(true);
        try {
            const res = await fetch('/api/admin/treasury/debit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currency: selectedCurrency,
                    amount: parseFloat(actionAmount),
                    reason: actionReason
                }),
                credentials: 'include'
            });

            const data = await res.json();
            if (data.success) {
                toast({ title: "Success", description: data.message });
                setIsDebitModalOpen(false);
                resetForm();
                fetchData();
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            toast({ title: "Action Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsActionLoading(false);
        }
    };

    const resetForm = () => {
        setSelectedCurrency("");
        setActionAmount("");
        setActionReason("");
    };

    const getExplorerUrl = (network: string, address: string) => {
        switch (network) {
            case 'TRON': return `https://tronscan.org/#/address/${address}`;
            case 'ETH': return `https://etherscan.io/address/${address}`;
            case 'BTC': return `https://blockstream.info/address/${address}`;
            case 'SOL': return `https://solscan.io/account/${address}`;
            default: return "";
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!", description: "Address copied to clipboard" });
    };

    if (isLoading && Object.keys(hotWallets).length === 0) {
        return (
            <AdminLayout>
                <div className="h-screen flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="p-6 space-y-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Wallet Management</h2>
                        <p className="text-muted-foreground mt-1">Monitor solvency and manage platform liquidity</p>
                    </div>
                    <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                        Refresh Balances
                    </Button>
                </div>

                {/* Collapsible Info Panel */}
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader
                        className="py-3 px-6 cursor-pointer flex flex-row items-center justify-between select-none"
                        onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                    >
                        <div className="flex items-center gap-2">
                            <Info className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm font-bold">📖 How to Fund Hot Wallets</CardTitle>
                        </div>
                        {isInfoExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </CardHeader>
                    {isInfoExpanded && (
                        <CardContent className="pb-4 px-6 space-y-4 text-sm">
                            <p className="text-muted-foreground">
                                Hot wallets are funded by sending crypto directly from any external wallet (TrustWallet, Binance, etc.).
                                No database update is needed — on-chain balances are read directly from the blockchain.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <p className="font-bold border-b border-primary/20 mb-1 pb-1">TRON (TRC20)</p>
                                    <p className="text-[10px] font-mono break-all">{hotWallets.TRON?.address || 'TU3dtEoqJjewYvosYsLBp4UakZaNUcxwEF'}</p>
                                    <p className="text-[10px] text-muted-foreground">Min: 500 USDT / 100 TRX</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-bold border-b border-primary/20 mb-1 pb-1">Ethereum (ERC20)</p>
                                    <p className="text-[10px] font-mono break-all">{hotWallets.ETH?.address || '0xE8485f5eF2c769025593617915C6658b3E653197'}</p>
                                    <p className="text-[10px] text-muted-foreground">Min: 0.5 ETH / 500 USDT</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-bold border-b border-primary/20 mb-1 pb-1">Bitcoin</p>
                                    <p className="text-[10px] font-mono break-all">{hotWallets.BTC?.address || 'bc1qttpdp7ppspwx4zyq9fenrxvp783we4w0xm7g55'}</p>
                                    <p className="text-[10px] text-muted-foreground">Min: 0.01 BTC</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-bold border-b border-primary/20 mb-1 pb-1">Solana</p>
                                    <p className="text-[10px] font-mono break-all">{hotWallets.SOL?.address || 'CgLHQEioek9vWXA5byRqhFh5pLQq7XzYzpv68wQ1mHbm'}</p>
                                    <p className="text-[10px] text-muted-foreground">Min: 2 SOL</p>
                                </div>
                            </div>
                        </CardContent>
                    )}
                </Card>

                {/* SECTION A: Hot Wallets */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        <h3 className="text-xl font-bold uppercase tracking-wider text-muted-foreground">Asset Solvency (On-Chain)</h3>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {['TRON', 'ETH', 'BTC', 'SOL'].map((net) => {
                            const data = hotWallets[net];
                            const isTronEth = net === 'TRON' || net === 'ETH';

                            return (
                                <Card key={net} className="card-elevated border-none bg-card/60 backdrop-blur-sm">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-primary" />
                                                {net} Hot Wallet
                                            </CardTitle>
                                            <div className="flex gap-1">
                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(data?.address || "")}>
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6" asChild>
                                                    <a href={getExplorerUrl(net, data?.address || "")} target="_blank" rel="noreferrer">
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="mt-1 font-mono text-[9px] text-muted-foreground truncate">
                                            {data?.address || "Address not set"}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="p-3 bg-muted/30 rounded-xl space-y-2">
                                            {data?.error ? (
                                                <p className="text-[10px] text-red-500 font-bold">{data.error}</p>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between items-baseline">
                                                        <span className="text-[10px] font-bold text-muted-foreground">USDT</span>
                                                        <span className="text-sm font-black">
                                                            {isTronEth ? (data?.tokens?.USDT || 0).toLocaleString() : 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-baseline">
                                                        <span className="text-[10px] font-bold text-muted-foreground">{net === 'TRON' ? 'TRX' : net}</span>
                                                        <span className="text-xs font-bold text-muted-foreground/80">
                                                            {data?.native?.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="space-y-3 pt-2 border-t border-border/40">
                                            <div className="flex justify-between text-[10px] font-bold">
                                                <span className="text-muted-foreground uppercase tracking-wider">User Liabilities</span>
                                                <span className="text-foreground">{(data?.liabilities || 0).toLocaleString()} USDT</span>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Coverage</span>
                                                    <span className={`text-lg font-black ${(data?.coverage || 0) >= 120 ? 'text-green-500' :
                                                        (data?.coverage || 0) >= 100 ? 'text-yellow-500' : 'text-red-500'
                                                        }`}>
                                                        {data?.coverage ? `${data.coverage.toFixed(1)}%` : '-%'}
                                                    </span>
                                                </div>
                                                <Badge className={`text-[9px] font-black ${data?.solvency === 'SOLVENT' && (data?.coverage || 0) >= 120 ? 'bg-green-500/10 text-green-500' :
                                                    data?.solvency === 'SOLVENT' ? 'bg-yellow-500/10 text-yellow-500' :
                                                        data?.solvency === 'UNDERFUNDED' ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'
                                                    }`}>
                                                    {data?.solvency === 'SOLVENT' && (data?.coverage || 0) >= 120 ? '✅ SOLVENT' :
                                                        data?.solvency === 'SOLVENT' ? '⚠️ LOW RESERVES' :
                                                            data?.solvency === 'UNDERFUNDED' ? '🔴 UNDERFUNDED' : '❓ UNKNOWN'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                {/* Grid for Treasury & Revenue */}
                <div className="grid gap-8 lg:grid-cols-2">
                    {/* SECTION B: Treasury */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Coins className="h-5 w-5 text-primary" />
                                <h3 className="text-xl font-bold uppercase tracking-wider text-muted-foreground">Internal Treasury</h3>
                            </div>
                            <Button size="sm" onClick={() => setIsCreditModalOpen(true)} className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                                <Plus className="h-4 w-4 mr-1" /> Add Liquidity
                            </Button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            {['USDT_TRC20', 'NGN', 'ETH', 'BTC', 'SOL'].map(curr => {
                                const balance = treasuryBalances.find(b => b.currency === curr)?.balance || 0;
                                return (
                                    <div key={curr} className="p-4 rounded-2xl bg-card/40 border border-border/40 backdrop-blur-sm flex justify-between items-center group">
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{curr.replace('_', ' ')}</p>
                                            <p className="text-xl font-black">{balance.toLocaleString()} <span className="text-xs text-muted-foreground">{curr.slice(0, 3)}</span></p>
                                        </div>
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity">
                                            <Coins className="h-5 w-5 text-primary" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECTION C: Platform Fee Wallet */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <History className="h-5 w-5 text-primary" />
                                <h3 className="text-xl font-bold uppercase tracking-wider text-muted-foreground">Revenue Tracking</h3>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => setIsDebitModalOpen(true)}>
                                <Minus className="h-4 w-4 mr-1" /> Withdraw Revenue
                            </Button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            {['USDT_TRC20', 'TRX', 'SOL', 'BTC'].map(curr => {
                                // For demonstration, we'll use a placeholder or derived fee balance
                                const feeBalance = treasuryBalances.find(b => b.currency === curr)?.balance || 0;
                                return (
                                    <div key={curr} className="p-4 rounded-2xl bg-card/40 border border-border/40 backdrop-blur-sm flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] font-bold text-primary uppercase">FEES: {curr}</p>
                                            <p className="text-xl font-black">{feeBalance.toLocaleString()}</p>
                                            <p className="text-[9px] text-muted-foreground">All-time collection</p>
                                        </div>
                                        <div className={`p-2 rounded-lg ${feeBalance > 0 ? 'bg-green-500/10' : 'bg-muted/50'}`}>
                                            <TrendingUp className={`h-4 w-4 ${feeBalance > 0 ? 'text-green-500' : 'text-muted-foreground'}`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* SECTION D: Audit Log */}
                <Card className="card-elevated border-none bg-card/60 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" /> System Action Audit Log
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-border/40">
                                    <TableHead className="text-[10px] font-bold uppercase tracking-widest">Date</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-widest">Action</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-widest">Currency</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-right">Amount</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-widest hidden md:table-cell">Admin</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-widest">Reason</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {auditLogs.map((log) => (
                                    <TableRow key={log.id} className="border-border/20">
                                        <TableCell className="text-[11px] text-muted-foreground">
                                            {new Date(log.date).toLocaleDateString()} {new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`text-[9px] font-bold h-5 ${log.type === 'Credit' ? 'text-green-500 border-green-500/20' : 'text-amber-500 border-amber-500/20'}`}>
                                                {log.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-[11px] font-bold">{log.currency}</TableCell>
                                        <TableCell className={`text-[11px] font-black text-right ${log.type === 'Credit' ? 'text-green-500' : 'text-amber-500'}`}>
                                            {log.type === 'Credit' ? '+' : '-'}{log.amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-[10px] text-muted-foreground hidden md:table-cell">{log.admin}</TableCell>
                                        <TableCell className="text-[11px] text-muted-foreground max-w-[200px] truncate">{log.reason}</TableCell>
                                    </TableRow>
                                ))}
                                {auditLogs.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No recent admin actions recorded.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Credit Modal */}
            <Dialog open={isCreditModalOpen} onOpenChange={setIsCreditModalOpen}>
                <DialogContent className="sm:max-w-md bg-card border-border/40">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-500" /> Add Treasury Liquidity
                        </DialogTitle>
                        <DialogDescription className="text-[11px]">
                            Manually credit the internal ledger for swap liquidity.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Currency</Label>
                            <Select onValueChange={setSelectedCurrency} value={selectedCurrency}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                                <SelectContent>
                                    {['USDT_TRC20', 'NGN', 'ETH', 'BTC', 'SOL'].map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Amount</Label>
                            <Input type="number" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                            <Label>Reason (Audit Log)</Label>
                            <Input value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Manual liquidity top-up..." />
                        </div>
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            <p className="text-[10px] text-amber-500 leading-tight">
                                <b>WARNING:</b> This credits the <b>INTERNAL Ledger</b> only. Ensure you have corresponding funds in the physical hot wallet for solvency.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsCreditModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCredit} disabled={isActionLoading}>
                            {isActionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Confirm Credit
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Debit Modal */}
            <Dialog open={isDebitModalOpen} onOpenChange={setIsDebitModalOpen}>
                <DialogContent className="sm:max-w-md bg-card border-border/40">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <TrendingDown className="h-5 w-5 text-amber-500" /> Withdraw Revenue
                        </DialogTitle>
                        <DialogDescription className="text-[11px]">
                            Debit the internal fee ledger to record a withdrawal.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Currency</Label>
                            <Select onValueChange={setSelectedCurrency} value={selectedCurrency}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                                <SelectContent>
                                    {['USDT_TRC20', 'TRX', 'SOL', 'BTC'].map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Amount</Label>
                            <Input type="number" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                            <Label>Reason (Audit Log)</Label>
                            <Input value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Withdrawal for company wallet..." />
                        </div>
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-2">
                            <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0" />
                            <p className="text-[10px] text-blue-500 leading-tight">
                                <b>NOTICE:</b> This debits the <b>INTERNAL Ledger</b>. You must manually initiate the transfer from the physical hot wallet to your destination.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDebitModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleDebit} variant="default" className="bg-amber-600 hover:bg-amber-700" disabled={isActionLoading}>
                            {isActionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Confirm Withdraw
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
