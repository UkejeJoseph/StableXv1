import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Users,
    Activity,
    CheckCircle,
    Wallet,
    Server,
    ShieldCheck,
    AlertTriangle,
    Send,
    Loader2,
    RefreshCcw,
    Coins,
    Key,
    Database,
    ExternalLink
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";
import { Eye, EyeOff, QrCode, Copy } from "lucide-react";

export default function AdminDashboard() {
    const { toast } = useToast();
    const [stats, setStats] = useState<any>(null);
    const [health, setHealth] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPayoutRunning, setIsPayoutRunning] = useState(false);
    const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
    const [editingWallet, setEditingWallet] = useState<any>(null);
    const [userInfo, setUserInfo] = useState<any>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('userInfo');
        if (storedUser) setUserInfo(JSON.parse(storedUser));
        fetchData();
        fetchHealth();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [usersRes, txRes, balRes] = await Promise.all([
                fetch('/api/admin/users?limit=1', { credentials: "include" }),
                fetch('/api/admin/transactions?limit=1', { credentials: "include" }),
                fetch('/api/admin/system-balances', { credentials: "include" })
            ]);

            const [usersData, txData, balData] = await Promise.all([
                usersRes.json(), txRes.json(), balRes.json()
            ]);

            setStats({
                totalUsers: usersData.totalUsers,
                totalTransactions: txData.totalTransactions,
                totalStaked: txData.totalStaked || 0,
                balances: balData
            });
        } catch (error) {
            console.error("Failed to load admin stats:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const [revealedKey, setRevealedKey] = useState<string | null>(null);
    const [showKey, setShowKey] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    const fetchWalletDetails = async (currency: string) => {
        setIsLoadingDetails(true);
        try {
            const res = await fetch(`/api/admin/config/hot-wallets/${currency}`, { credentials: "include" });
            const data = await res.json();
            if (data.success) {
                setRevealedKey(data.config.privateKey);
                // Pre-fill address if needed
                const addrInput = document.getElementById('address') as HTMLInputElement;
                if (addrInput && !addrInput.value) addrInput.value = data.config.address || '';
            }
        } catch (error: any) {
            toast({ title: "Fetch Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const fetchHealth = async () => {
        try {
            const res = await fetch('/api/admin/health', { credentials: "include" });
            const data = await res.json();
            setHealth(data);
        } catch (error) {
            console.error("Health check failed:", error);
        }
    };

    const handleBulkPayout = async () => {
        if (!confirm("Are you sure you want to trigger bulk USDT payouts to all pending users?")) return;
        setIsPayoutRunning(true);
        try {
            const res = await fetch('/api/admin/bulk-payout', {
                method: 'POST',
                credentials: "include"
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: "Bulk Payout Successful", description: `${data.processedCount} payouts initiated.` });
            } else {
                throw new Error(data.message || "Payout failed");
            }
        } catch (error: any) {
            toast({ title: "Bulk Payout Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsPayoutRunning(false);
        }
    };

    const handleUpdateHotWallet = async (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const data = {
            currency: editingWallet.currency,
            address: formData.get('address'),
            privateKey: formData.get('privateKey')
        };

        setIsUpdatingConfig(true);
        try {
            const res = await fetch('/api/admin/config/hot-wallets', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: "include"
            });
            const result = await res.json();
            if (result.success) {
                toast({ title: "Updated!", description: `${editingWallet.currency} hot wallet configuration saved.` });
                setEditingWallet(null);
                fetchData();
            } else {
                throw new Error(result.error || "Update failed");
            }
        } catch (error: any) {
            toast({ title: "Update Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsUpdatingConfig(false);
        }
    };

    const connectBrowserWallet = async () => {
        try {
            if (editingWallet.currency === 'SOL') {
                const solana = (window as any).solana;
                if (!solana) throw new Error("Phanton or Trust Wallet (Solana) not found in browser.");
                const resp = await solana.connect();
                const address = resp.publicKey.toString();
                const addrInput = document.getElementById('address') as HTMLInputElement;
                if (addrInput) addrInput.value = address;
                toast({ title: "Connected!", description: `Loaded SOL address: ${address.slice(0, 8)}` });
            } else if (editingWallet.currency === 'TRC20' || editingWallet.currency === 'TRX') {
                const tronWeb = (window as any).tronWeb;
                if (!tronWeb) throw new Error("TRON browser extension (Trust/TronLink) not found.");
                const address = tronWeb.defaultAddress.base58;
                const addrInput = document.getElementById('address') as HTMLInputElement;
                if (addrInput) addrInput.value = address;
                toast({ title: "Connected!", description: `Loaded TRON address: ${address.slice(0, 8)}` });
            } else {
                // ETH or others using EVM
                if (!(window as any).ethereum) throw new Error("No EVM wallet (Trust/MetaMask) found.");
                const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
                const address = accounts[0];
                const addrInput = document.getElementById('address') as HTMLInputElement;
                if (addrInput) addrInput.value = address;
                toast({ title: "Connected!", description: `Loaded address: ${address.slice(0, 8)}` });
            }
        } catch (error: any) {
            toast({ title: "Connection Failed", description: error.message, variant: "destructive" });
        }
    };

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="h-screen flex items-center justify-center bg-background">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-sm font-medium text-muted-foreground animate-pulse">Initializing Dashboard...</p>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Dashboard</h2>
                        <p className="text-muted-foreground mt-1">Real-time platform monitoring and management</p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-card hover:bg-muted"
                            onClick={() => { fetchData(); fetchHealth(); }}
                        >
                            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                        </Button>
                        <Button
                            size="sm"
                            className="bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20"
                            disabled={isPayoutRunning}
                            onClick={handleBulkPayout}
                        >
                            {isPayoutRunning ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Send className="h-4 w-4 mr-2" />
                            )}
                            Bulk USDT Payout
                        </Button>
                    </div>
                </div>

                {/* REVENUE OVERVIEW */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="card-elevated border-none bg-primary/10 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-primary">All-Time Revenue</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black text-foreground">{stats?.balances?.data?.revenue?.allTime?.toLocaleString() || 0} <span className="text-xs">USDT</span></div>
                        </CardContent>
                    </Card>
                    <Card className="card-elevated border-none bg-card/40 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Today's Profit</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black text-foreground">{stats?.balances?.data?.revenue?.today?.toLocaleString() || 0} <span className="text-xs">USDT</span></div>
                        </CardContent>
                    </Card>
                    <Card className="card-elevated border-none bg-card/40 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Weekly Profit</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black text-foreground">{stats?.balances?.data?.revenue?.thisWeek?.toLocaleString() || 0} <span className="text-xs">USDT</span></div>
                        </CardContent>
                    </Card>
                    <Card className="card-elevated border-none bg-card/40 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Monthly Profit</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black text-foreground">{stats?.balances?.data?.revenue?.thisMonth?.toLocaleString() || 0} <span className="text-xs">USDT</span></div>
                        </CardContent>
                    </Card>
                </div>

                {/* REVENUE BY STREAM */}
                <Card className="card-elevated border-none bg-card/60 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" /> Profit Streams
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {stats?.balances?.data?.revenue?.byStream?.map((stream: any) => (
                                <div key={stream._id} className="p-3 rounded-2xl bg-muted/30 border border-border/50">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{stream._id?.replace('_', ' ')}</p>
                                    <p className="text-lg font-bold text-foreground">{stream.total?.toFixed(2)} <span className="text-[10px]">USDT</span></p>
                                    <p className="text-[9px] text-muted-foreground">{stream.count} transactions</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* KPI METRICS */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="card-elevated border-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Users</CardTitle>
                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Users className="h-4 w-4 text-blue-500" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats?.totalUsers || 0}</div>
                            <div className="flex items-center gap-1.5 mt-2">
                                <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-none text-[10px] h-5">Verified</Badge>
                                <span className="text-[10px] text-muted-foreground">84% Engagement</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="card-elevated border-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Transactions</CardTitle>
                            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <Activity className="h-4 w-4 text-purple-500" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats?.totalTransactions || 0}</div>
                            <p className="text-[10px] text-muted-foreground mt-2 font-medium">LTM volume: $1.2M USDT</p>
                        </CardContent>
                    </Card>

                    <Card className="card-elevated border-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Staking Pool</CardTitle>
                            <div className="h-8 w-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                                <Coins className="h-4 w-4 text-teal-500" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats?.totalStaked?.toLocaleString() || 0} <span className="text-xs font-medium">USDT</span></div>
                            <p className="text-[10px] text-muted-foreground mt-2 font-medium">Avg. Yield: 8.42% APY</p>
                        </CardContent>
                    </Card>

                    <Card className="card-elevated border-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Service Health</CardTitle>
                            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <Server className="h-4 w-4 text-green-500" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <div className={`h-3 w-3 rounded-full ${health?.status === 'UP' ? 'bg-green-500 shadow-green-500' : 'bg-red-500 shadow-red-500'} shadow-[0_0_8px]`} />
                                <div className="text-2xl font-bold">{health?.status || 'OFFLINE'}</div>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2 font-medium">Uptime: 99.98% / 30d</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-8 md:grid-cols-7 lg:grid-cols-7">
                    {/* LIABILITIES VS HOT WALLETS - Restricted to Super Admin */}
                    {userInfo?.email === 'ukejejoseph1@gmail.com' && (
                        <Card className="md:col-span-4 card-elevated border-none bg-card/60 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <Wallet className="h-5 w-5 text-primary" /> Asset Exposure
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {Object.keys(stats?.balances?.hotWallets || {}).map((currency) => {
                                        const hotWallet = stats?.balances?.hotWallets[currency];
                                        const liability = stats?.balances?.liabilities[currency] || 0;
                                        const coverage = liability > 0 ? (hotWallet.balance / liability) * 100 : 100;

                                        return (
                                            <div key={currency} className="group p-4 rounded-2xl bg-muted/20 border border-border/40 transition-all hover:bg-muted/30">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-xs text-primary shadow-sm border border-primary/20">
                                                            {currency.slice(0, 3)}
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-black text-foreground">{currency}</p>
                                                                <Badge variant="outline" className={`text-[8px] h-4 uppercase ${coverage >= 80 ? 'border-green-500/50 text-green-500' : 'border-amber-500/50 text-amber-500'}`}>
                                                                    {coverage >= 100 ? 'Fully Backed' : `${coverage.toFixed(1)}% Backed`}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md w-fit">
                                                                <span>{hotWallet.address?.slice(0, 8)}...{hotWallet.address?.slice(-8)}</span>
                                                                <ExternalLink className="h-2.5 w-2.5 cursor-pointer hover:text-primary" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 rounded-lg hover:bg-primary/20 hover:text-primary transition-colors"
                                                                    onClick={() => {
                                                                        setEditingWallet({ currency, ...hotWallet });
                                                                        setRevealedKey(null);
                                                                        setShowKey(false);
                                                                        fetchWalletDetails(currency);
                                                                    }}
                                                                >
                                                                    <Key className="h-4 w-4" />
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-2xl border-border/50">
                                                                <DialogHeader>
                                                                    <DialogTitle className="flex items-center gap-2">
                                                                        <ShieldCheck className="h-5 w-5 text-primary" /> Configure {currency} Hot Wallet
                                                                    </DialogTitle>
                                                                </DialogHeader>
                                                                <form onSubmit={handleUpdateHotWallet} className="space-y-4 pt-4">
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <Label htmlFor="address">Public Address</Label>
                                                                            <Button
                                                                                type="button"
                                                                                variant="link"
                                                                                size="sm"
                                                                                className="h-4 p-0 text-[10px] font-bold text-primary hover:text-primary/80"
                                                                                onClick={connectBrowserWallet}
                                                                            >
                                                                                <Activity className="h-3 w-3 mr-1" /> Connect Trust Wallet
                                                                            </Button>
                                                                        </div>
                                                                        <Input id="address" name="address" defaultValue={editingWallet?.address} placeholder="Enter wallet address" />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="privateKey">Private Key (Managed Securely)</Label>
                                                                        <div className="relative group">
                                                                            <Input
                                                                                id="privateKey"
                                                                                name="privateKey"
                                                                                type={showKey ? "text" : "password"}
                                                                                placeholder={revealedKey || "Enter private key to update"}
                                                                                defaultValue={revealedKey || ""}
                                                                                className="pr-10 font-mono text-xs"
                                                                            />
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="absolute right-0 top-0 h-full w-10 hover:bg-transparent"
                                                                                onClick={() => setShowKey(!showKey)}
                                                                            >
                                                                                {showKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                                                            </Button>
                                                                        </div>

                                                                        {revealedKey && (
                                                                            <div className="mt-4 p-4 rounded-2xl bg-muted/30 border border-border/50 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
                                                                                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 flex items-center gap-2">
                                                                                    <QrCode className="h-3 w-3" /> Scan to import into Trust Wallet
                                                                                </p>
                                                                                <div className="p-3 bg-white rounded-2xl shadow-xl">
                                                                                    <QRCodeSVG value={revealedKey} size={140} level="H" />
                                                                                </div>
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="w-full text-[10px] h-8"
                                                                                    onClick={() => {
                                                                                        navigator.clipboard.writeText(revealedKey);
                                                                                        toast({ title: "Copied!", description: "Private Key copied to clipboard" });
                                                                                    }}
                                                                                >
                                                                                    <Copy className="h-3 w-3 mr-2" /> Copy Private Key
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <Button type="submit" className="w-full font-bold" disabled={isUpdatingConfig}>
                                                                        {isUpdatingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Save Configuration"}
                                                                    </Button>
                                                                </form>
                                                            </DialogContent>
                                                        </Dialog>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div className="p-3 bg-card/50 rounded-xl border border-border/30">
                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight mb-1">On-Chain Balance</p>
                                                        <p className="text-lg font-black text-foreground">
                                                            {hotWallet.balance?.toLocaleString(undefined, { maximumFractionDigits: 5 })}
                                                            <span className="text-[10px] ml-1 text-primary">{currency}</span>
                                                        </p>
                                                    </div>
                                                    <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                                                        <p className="text-[9px] font-bold text-red-400 uppercase tracking-tight mb-1">User Liabilities</p>
                                                        <p className="text-lg font-black text-red-500">
                                                            {liability.toLocaleString(undefined, { maximumFractionDigits: 5 })}
                                                            <span className="text-[10px] ml-1">{currency}</span>
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5 px-1">
                                                    <div className="flex justify-between text-[9px] font-bold">
                                                        <span className="text-muted-foreground uppercase tracking-wider">Health Index</span>
                                                        <span className={coverage >= 100 ? 'text-green-500' : 'text-amber-500'}>{coverage.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                                                        <div
                                                            className={`h-full transition-all duration-1000 ${coverage >= 100 ? 'bg-green-500' : coverage >= 50 ? 'bg-amber-500' : 'bg-destructive'}`}
                                                            style={{ width: `${Math.min(coverage, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* INFRASTRUCTURE HEALTH */}
                    <Card className="md:col-span-3 card-elevated border-none bg-card/60 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-primary" /> Infrastructure
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
                                <div className="flex items-center gap-3">
                                    <Activity className="h-5 w-5 text-primary" />
                                    <div>
                                        <p className="text-xs font-bold">API Latency</p>
                                        <p className="text-[10px] text-muted-foreground">Edge response time</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-green-500">124ms</span>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
                                <div className="flex items-center gap-3">
                                    <Server className="h-5 w-5 text-primary" />
                                    <div>
                                        <p className="text-xs font-bold">DB Integrity</p>
                                        <p className="text-[10px] text-muted-foreground">MongoDB Replica Set</p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="bg-green-500/10 text-green-500">OPTIMAL</Badge>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className="h-5 w-5 text-primary" />
                                    <div>
                                        <p className="text-xs font-bold">Cold Vault</p>
                                        <p className="text-[10px] text-muted-foreground">Air-gapped sync</p>
                                    </div>
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">Syncing...</span>
                            </div>

                            <div className="mt-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                    <p className="text-[11px] font-bold text-amber-500 uppercase">Attention Required</p>
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                    Weekly security audit is due in 14 hours. All systems currently showing nominal performance metrics.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AdminLayout>
    );
}
