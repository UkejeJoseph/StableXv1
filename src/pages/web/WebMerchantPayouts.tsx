import { useState, useEffect } from "react";
import { WebLayout } from "@/components/WebSidebar";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, Banknote, ShieldAlert, Coins, Plus, Trash2, Landmark, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface BankAccount {
    _id: string;
    accountName: string;
    accountNumber: string;
    bankCode: string;
    bankName: string;
}

interface Bank {
    Code: string;
    Name: string;
}

const WebMerchantPayouts = () => {
    const { toast } = useToast();
    const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
    const token = userInfo?.token;

    const [balanceNGN, setBalanceNGN] = useState(0);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [availableBanks, setAvailableBanks] = useState<Bank[]>([]);

    // UI State
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [isAddingAccount, setIsAddingAccount] = useState(false);
    const [isProcessingPayout, setIsProcessingPayout] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
    const [payoutAmount, setPayoutAmount] = useState("");

    // Add Account Form State
    const [newAccNumber, setNewAccNumber] = useState("");
    const [newAccBank, setNewAccBank] = useState("");
    const [newAccName, setNewAccName] = useState("");
    const [isVerifyingName, setIsVerifyingName] = useState(false);

    useEffect(() => {
        fetchData();
        fetchBanks();
    }, []);

    const fetchData = async () => {
        if (!token) return;
        try {
            // Fetch NGN Balance
            const walletRes = await fetch("/api/wallets", { credentials: "include" });
            const walletData = await walletRes.json();
            if (walletData.success) {
                const ngnWallet = walletData.data.find((w: any) => w.currency === 'NGN');
                if (ngnWallet) setBalanceNGN(ngnWallet.balance);
            }

            // Fetch Saved Bank Accounts
            const accountsRes = await fetch("/api/merchant/bank-accounts", { credentials: "include" });
            const accountsData = await accountsRes.json();
            if (accountsData.success) {
                setBankAccounts(accountsData.bankAccounts);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoadingAccounts(false);
        }
    };

    const fetchBanks = async () => {
        try {
            const res = await fetch("/api/korapay/banks", { credentials: "include" });
            const data = await res.json();
            if (Array.isArray(data)) {
                setAvailableBanks(data.map((b: any) => ({ Code: b.bank_code, Name: b.name })));
            }
        } catch (error) {
            console.error("Failed to fetch banks", error);
        }
    };

    const handleVerifyAccountName = async () => {
        if (newAccNumber.length !== 10 || !newAccBank) return;
        setIsVerifyingName(true);
        try {
            const res = await fetch(`/api/interswitch/name-enquiry?bankCode=${newAccBank}&accountId=${newAccNumber}`, {
                credentials: "include"
            });
            const data = await res.json();
            if (data.success && data.accountName) {
                setNewAccName(data.accountName);
                toast({ title: "Account Verified", description: data.accountName });
            } else {
                toast({ title: "Account Not Found", description: "Please check the account details and try again.", variant: "destructive" });
            }
        } catch (error) {
            console.error("Verification error", error);
        } finally {
            setIsVerifyingName(false);
        }
    };

    const handleSaveAccount = async () => {
        if (!newAccNumber || !newAccBank || !newAccName) {
            toast({ title: "Incomplete", description: "Please verify your account first", variant: "destructive" });
            return;
        }

        const bankObj = availableBanks.find(b => b.Code === newAccBank);

        try {
            const res = await fetch("/api/merchant/bank-accounts", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    accountNumber: newAccNumber,
                    bankCode: newAccBank,
                    accountName: newAccName,
                    bankName: bankObj?.Name || "Bank"
                })
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: "Account Saved", description: "Your business account has been safely added." });
                setBankAccounts(data.bankAccounts);
                setIsAddingAccount(false);
                setNewAccNumber("");
                setNewAccBank("");
                setNewAccName("");
            } else {
                toast({ title: "Error", description: data.error || data.message, variant: "destructive" });
            }
        } catch (error) {
            console.error("Save account error", error);
        }
    };

    const handleDeleteAccount = async (id: string) => {
        try {
            const res = await fetch(`/api/merchant/bank-accounts/${id}`, {
                method: "DELETE",
                credentials: "include"
            });
            const data = await res.json();
            if (data.success) {
                setBankAccounts(data.bankAccounts);
                if (selectedAccount?._id === id) setSelectedAccount(null);
                toast({ title: "Account Removed", description: "The bank account was deleted." });
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handlePayout = async () => {
        if (!selectedAccount) {
            toast({ title: "Select an Account", description: "Please select a bank account to receive the payout.", variant: "destructive" });
            return;
        }

        const amount = parseFloat(payoutAmount);
        if (isNaN(amount) || amount <= 0 || amount > balanceNGN) {
            toast({ title: "Invalid Amount", description: "Please enter a valid amount within your current balance.", variant: "destructive" });
            return;
        }

        setIsProcessingPayout(true);
        try {
            const res = await fetch("/api/korapay/payout", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: amount,
                    accountNumber: selectedAccount.accountNumber,
                    bankCode: selectedAccount.bankCode,
                    accountName: selectedAccount.accountName,
                    narration: "StableX Merchant Settlement"
                })
            });

            const data = await res.json();
            if (res.ok) {
                toast({ title: "Payout Successful!", description: `\u20A6${amount.toLocaleString()} has been sent to your bank account.` });
                setPayoutAmount("");
                setSelectedAccount(null);
                setBalanceNGN(prev => prev - amount);
            } else {
                toast({ title: "Payout Failed", description: data.message || "The bank transfer failed.", variant: "destructive" });
            }
        } catch (error) {
            console.error("Payout error", error);
            toast({ title: "Network Error", description: "Check your internet connection and try again.", variant: "destructive" });
        } finally {
            setIsProcessingPayout(false);
        }
    };

    return (
        <WebLayout>
            <div className="space-y-6 max-w-5xl">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent flex items-center gap-3">
                        <ArrowUpRight className="w-8 h-8 text-primary" /> Payouts & Settlements
                    </h1>
                    <p className="text-muted-foreground mt-1">Withdraw NGN to your verified business bank accounts.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">

                    {/* Left Column: Payout Action */}
                    <Card className="p-6 border-border/40 bg-[#1e2329] lg:col-span-2 space-y-6 flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
                                    <Banknote className="w-5 h-5 text-blue-400" /> Fiat Bank Settlement
                                </h2>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground">Available NGN Balance</p>
                                    <p className="text-2xl font-bold font-mono text-green-400">\u20A6{balanceNGN.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white">Amount (NGN)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">\u20A6</span>
                                    <Input
                                        type="number"
                                        value={payoutAmount}
                                        onChange={(e) => setPayoutAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="pl-8 bg-background/50 border-border/50 text-lg py-5"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setPayoutAmount(balanceNGN.toString())}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs text-primary hover:text-primary/80"
                                    >
                                        MAX
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white flex justify-between items-center">
                                    Destination Account
                                    {bankAccounts.length === 0 && !loadingAccounts && (
                                        <span className="text-xs text-yellow-500">Please add a bank account first</span>
                                    )}
                                </label>

                                {loadingAccounts ? (
                                    <div className="h-16 flex items-center justify-center border border-border/20 rounded-xl bg-background/20">
                                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {bankAccounts.map((acc) => (
                                            <div
                                                key={acc._id}
                                                onClick={() => setSelectedAccount(acc)}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedAccount?._id === acc._id
                                                    ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(79,209,197,0.15)]'
                                                    : 'border-border/40 hover:border-primary/50 bg-background/30'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Landmark className="w-4 h-4 text-muted-foreground" />
                                                            <p className="text-xs font-semibold text-muted-foreground">{acc.bankName}</p>
                                                        </div>
                                                        <p className="text-sm font-bold text-white tracking-wide">{acc.accountNumber}</p>
                                                        <p className="text-xs text-muted-foreground truncate w-36" title={acc.accountName}>{acc.accountName}</p>
                                                    </div>
                                                    {selectedAccount?._id === acc._id && (
                                                        <CheckCircle2 className="w-5 h-5 text-primary" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg font-semibold shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all"
                            onClick={handlePayout}
                            disabled={isProcessingPayout || !selectedAccount || !payoutAmount || parseFloat(payoutAmount) <= 0 || parseFloat(payoutAmount) > balanceNGN}
                        >
                            {isProcessingPayout ? (
                                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing Payout via Korapay...</>
                            ) : (
                                <>Initiate Payout of \u20A6{payoutAmount ? Number(payoutAmount).toLocaleString() : "0.00"}</>
                            )}
                        </Button>
                    </Card>

                    {/* Right Column: Manage Accounts */}
                    <Card className="p-6 border-border/40 bg-[#1e2329] space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Saved Accounts</h2>
                        </div>

                        <p className="text-xs text-muted-foreground">Manage your authorized business bank accounts (Max: 3).</p>

                        <div className="space-y-3 pt-2 max-h-[250px] overflow-y-auto pr-2">
                            {loadingAccounts ? (
                                <p className="text-center text-sm text-muted-foreground py-4">Loading accounts...</p>
                            ) : bankAccounts.length === 0 ? (
                                <div className="text-center py-6 border border-dashed border-border/50 rounded-lg">
                                    <Landmark className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                                    <p className="text-sm text-muted-foreground">No accounts saved</p>
                                </div>
                            ) : (
                                bankAccounts.map((acc) => (
                                    <div key={acc._id} className="flex justify-between items-center p-3 bg-background/40 border border-border/30 rounded-lg">
                                        <div>
                                            <p className="text-sm font-semibold">{acc.bankName}</p>
                                            <p className="text-xs font-mono text-muted-foreground">{acc.accountNumber}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-400/10" onClick={() => handleDeleteAccount(acc._id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>

                        <Dialog open={isAddingAccount} onOpenChange={setIsAddingAccount}>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full mt-4 border-dashed border-border/50 hover:border-primary/50 hover:bg-primary/5"
                                    disabled={bankAccounts.length >= 3}
                                >
                                    <Plus className="w-4 h-4 mr-2" /> Add Bank Account {bankAccounts.length >= 3 && '(Max Limit Reached)'}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] bg-[#1e2329] border-border/40 text-white">
                                <DialogHeader>
                                    <DialogTitle>Add Business Account</DialogTitle>
                                    <DialogDescription className="text-muted-foreground">
                                        Funds can only be withdrawn to accounts matching your KYC business details.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">Bank Name</label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={newAccBank}
                                            onChange={(e) => setNewAccBank(e.target.value)}
                                        >
                                            <option value="">Select Bank...</option>
                                            {availableBanks.map(b => (
                                                <option key={b.Code} value={b.Code}>{b.Name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">Account Number</label>
                                        <Input
                                            placeholder="10 digit account number"
                                            value={newAccNumber}
                                            onChange={(e) => setNewAccNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            onBlur={handleVerifyAccountName}
                                            maxLength={10}
                                            className="bg-background/50 border-border/50 font-mono"
                                        />
                                    </div>

                                    <div className={`p-3 rounded-lg border ${newAccName ? 'bg-green-500/10 border-green-500/20' : 'bg-background/20 border-border/20'}`}>
                                        <p className="text-xs text-muted-foreground mb-1">Account Name Verification</p>
                                        {isVerifyingName ? (
                                            <div className="flex items-center gap-2 text-sm text-blue-400">
                                                <Loader2 className="w-4 h-4 animate-spin" /> Verifying via Interswitch...
                                            </div>
                                        ) : newAccName ? (
                                            <p className="text-sm font-bold text-green-400">{newAccName}</p>
                                        ) : (
                                            <p className="text-sm text-yellow-500/70 italic">Awaiting details...</p>
                                        )}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={handleSaveAccount}
                                        className="w-full bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-black font-semibold"
                                        disabled={!newAccName || isVerifyingName}
                                    >
                                        Save Bank Account
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                    </Card>

                </div>
            </div>
        </WebLayout>
    );
}

export default WebMerchantPayouts;
