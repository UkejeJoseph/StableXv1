import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ShieldCheck, ArrowRight, Store, CheckCircle2, Copy, AlertCircle, Zap } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface CheckoutDetails {
    amount: number;
    currency: string;
    customerEmail: string;
    description: string;
    status: string;
    merchant: {
        username: string;
        businessName: string;
    };
    merchantAddresses: Record<string, string>;
    expiresAt: string;
}

const CheckoutWidget = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const pollingInterval = useRef<any>(null);

    const [details, setDetails] = useState<CheckoutDetails | null>(null);
    const [rates, setRates] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [showCryptoModal, setShowCryptoModal] = useState(false);
    const [selectedCrypto, setSelectedCrypto] = useState<string>("USDT");

    // Check if the user trying to pay is logged into StableX
    const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
    const isAuthenticated = !!userInfo.token;

    useEffect(() => {
        if (sessionId) fetchCheckoutDetails();
        return () => stopPolling();
    }, [sessionId]);

    useEffect(() => {
        if (showCryptoModal && details?.status === 'pending') {
            startPolling();
        } else {
            stopPolling();
        }
    }, [showCryptoModal, details?.status]);

    const fetchCheckoutDetails = async () => {
        try {
            const [resDetails, resRates] = await Promise.all([
                fetch(`/api/v1/checkout/${sessionId}/details`, { credentials: "include" }),
                fetch("/api/transactions/rates", { credentials: "include" })
            ]);

            const data = await resDetails.json();
            const ratesData = await resRates.json();

            if (data.success) {
                setDetails(data.data);
                // Auto-select USDT if available, else first available
                const availableCryptos = Object.keys(data.data.merchantAddresses || {});
                if (availableCryptos.length > 0) {
                    setSelectedCrypto(availableCryptos.includes("USDT") ? "USDT" : availableCryptos[0]);
                }
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }

            if (ratesData.success) {
                setRates(ratesData.rates);
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Network Error", description: "Failed to load checkout details", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const startPolling = () => {
        stopPolling();
        pollingInterval.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/v1/checkout/${sessionId}/status`, { credentials: "include" });
                const data = await res.json();
                if (data.success && data.status === 'completed') {
                    setDetails(prev => prev ? { ...prev, status: 'completed' } : null);
                    setShowCryptoModal(false);
                    toast({ title: "Payment Received!", description: "Your transaction has been confirmed on the blockchain." });
                    stopPolling();
                }
            } catch (err) {
                console.error("Polling error", err);
            }
        }, 5000);
    };

    const stopPolling = () => {
        if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
        }
    };

    const getEquivalentCryptoAmount = (crypto: string) => {
        if (!details || !rates) return 0;
        if (details.currency === crypto) return details.amount;

        let amountInUsd = details.amount;
        if (details.currency === "NGN") {
            amountInUsd = details.amount / (rates.USDT || 1500);
        } else if (details.currency !== "USDT" && rates[details.currency]) {
            amountInUsd = details.amount * rates[details.currency];
        }

        if (crypto === "USDT") return amountInUsd;
        return amountInUsd / (rates[crypto] || 1);
    };

    const handleStableXPayment = async () => {
        if (!isAuthenticated) {
            sessionStorage.setItem("checkoutRedirect", `/checkout/${sessionId}`);
            navigate("/web/login");
            return;
        }

        setProcessing(true);
        try {
            const res = await fetch(`/api/v1/checkout/${sessionId}/pay-internal`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();

            if (data.success) {
                toast({ title: "Payment Successful", description: "Your payment was processed instantly." });
                setDetails(prev => prev ? { ...prev, status: 'completed' } : null);

                if (data.successUrl) {
                    setTimeout(() => {
                        window.location.href = data.successUrl;
                    }, 3000);
                }
            } else {
                toast({ title: "Payment Failed", description: data.error, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-sm font-medium text-muted-foreground">Securing Checkout Link...</p>
            </div>
        );
    }

    if (!details) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground p-4">
                <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6 shadow-lg shadow-destructive/10">
                    <AlertCircle className="w-10 h-10" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Session Invalid</h1>
                <p className="text-muted-foreground text-center max-w-xs">This payment link has expired, been cancelled, or is invalid.</p>
                <Button variant="ghost" className="mt-8 text-primary font-bold" onClick={() => window.history.back()}>
                    Return to Merchant
                </Button>
            </div>
        );
    }

    const isExpired = new Date(details.expiresAt) < new Date() || details.status === 'expired';
    const isCompleted = details.status === 'completed';

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10 text-foreground relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="w-full max-w-md z-10 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">

                <div className="flex flex-col items-center text-center gap-2">
                    <div className="flex items-center gap-2 px-4 py-2 bg-card border border-border/50 rounded-full shadow-sm mb-4">
                        <div className="w-5 h-5 bg-primary rounded-md flex items-center justify-center font-bold text-black text-xs">S</div>
                        <span className="text-xs font-bold tracking-widest uppercase">StableX Gateway</span>
                    </div>
                </div>

                <Card className="p-0 overflow-hidden border-none bg-card/40 backdrop-blur-xl shadow-2xl shadow-primary/5 rounded-[2rem] relative border border-border/10">
                    <div className="p-8 space-y-8">
                        {/* Merchant Details */}
                        <div className="flex flex-col items-center text-center space-y-3">
                            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-2 shadow-inner border border-primary/20">
                                <Store className="w-10 h-10 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight text-foreground">{details.merchant.businessName}</h2>
                                {details.description && <p className="text-sm text-muted-foreground font-medium mt-1">{details.description}</p>}
                            </div>
                        </div>

                        {/* Amount display */}
                        <div className="bg-muted/30 p-8 rounded-[1.5rem] border border-border/40 text-center relative overflow-hidden group">
                            <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-[0.3em] font-black">Exact Amount to Pay</p>
                            <h1 className="text-5xl font-black text-foreground tracking-tighter">
                                {details.amount.toLocaleString()} <span className="text-2xl text-primary font-bold">{details.currency}</span>
                            </h1>
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Zap className="w-20 h-20 text-primary" />
                            </div>
                        </div>

                        {/* Status Warnings */}
                        <div className="space-y-4">
                            <div className="p-5 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-4 text-green-500 animate-in zoom-in-95 duration-500">
                                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-green-400">Payment Verified Successfully</p>
                                    <p className="text-[10px] font-medium opacity-80 mt-0.5">Redirecting you back to merchant shortly...</p>
                                </div>
                            </div>

                            {details.status === 'completed' && (
                                <div className="bg-muted/30 rounded-2xl p-4 border border-border/40 space-y-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Settlement Summary</p>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Gross Amount</span>
                                        <span className="font-bold">{details.amount.toLocaleString()} {details.currency}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Platform Fee (1.5%)</span>
                                        <span className="font-bold">{(details.amount * 0.015).toLocaleString()} {details.currency}</span>
                                    </div>
                                    <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                                        <span className="font-bold text-foreground">Merchant Receives</span>
                                        <span className="font-bold text-primary">{(details.amount * 0.985).toLocaleString()} {details.currency}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {isExpired && !isCompleted && (
                            <div className="p-5 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center gap-4 text-destructive">
                                <div className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Transaction Link Expired</p>
                                    <p className="text-[10px] font-medium opacity-80 mt-0.5">Please close this window and request a new link.</p>
                                </div>
                            </div>
                        )}

                        {/* Payment Options */}
                        {!isCompleted && !isExpired && (
                            <div className="space-y-4 pt-2">
                                <Button
                                    className="w-full h-16 justify-between bg-primary text-primary-foreground hover:bg-primary/90 font-black text-lg rounded-2xl shadow-xl shadow-primary/20 group transition-all active:scale-95"
                                    onClick={handleStableXPayment}
                                    disabled={processing}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-primary-foreground rounded-xl flex items-center justify-center text-primary text-sm shadow-sm">
                                            <Zap className="h-5 w-5 fill-current" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold leading-none">{isAuthenticated ? "Instant One-Tap Pay" : "Login to Simple Pay"}</p>
                                            <p className="text-[10px] font-medium opacity-70">Secured by StableX Internal</p>
                                        </div>
                                    </div>
                                    {processing ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />}
                                </Button>

                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        variant="outline"
                                        className="h-14 border-border/50 hover:bg-muted/50 rounded-2xl font-bold flex flex-col gap-0.5 items-center justify-center"
                                        onClick={() => setShowCryptoModal(true)}
                                    >
                                        <span className="text-xs">Crypto Wallet</span>
                                        <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Network Confirm</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-14 border-border/50 hover:bg-muted/50 rounded-2xl font-bold flex flex-col gap-0.5 items-center justify-center opacity-60"
                                        onClick={() => toast({ title: "Fiat Disabled", description: "Not available for this merchant." })}
                                    >
                                        <span className="text-xs">Direct Transfer</span>
                                        <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Coming Soon</span>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-muted/20 py-4 px-8 text-center border-t border-border/10 flex items-center justify-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                        <ShieldCheck className="w-4 h-4 text-green-500" /> AES-256 Encrypted Payment Bridge
                    </div>
                </Card>

                <p className="text-center text-[10px] text-muted-foreground font-medium px-4">
                    By proceeding, you agree to the StableX Merchant Protection Policy. Transactions are non-reversible once confirmed on-chain.
                </p>

                {/* Crypto Transfer Modal */}
                <Dialog open={showCryptoModal} onOpenChange={setShowCryptoModal}>
                    <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-2xl border-border/50 text-foreground rounded-[2rem] p-0 shadow-3xl overflow-hidden">
                        <div className="p-8 space-y-6">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold">Transfer Assets</DialogTitle>
                                <DialogDescription className="text-xs font-medium">
                                    Send precisely <strong>{getEquivalentCryptoAmount(selectedCrypto).toFixed(selectedCrypto === 'USDT' ? 2 : 6)} {selectedCrypto}</strong> to the merchant address below.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex flex-col items-center space-y-6">
                                <div className="flex gap-2 p-1 bg-muted/50 rounded-2xl border border-border/30 w-fit">
                                    {['USDT', 'BTC', 'ETH', 'SOL'].map(coin => {
                                        if (!details.merchantAddresses[coin]) return null;
                                        return (
                                            <button
                                                key={coin}
                                                onClick={() => setSelectedCrypto(coin)}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedCrypto === coin
                                                    ? "bg-primary text-black shadow-lg"
                                                    : "text-muted-foreground hover:bg-muted"
                                                    }`}
                                            >
                                                {coin}
                                            </button>
                                        );
                                    })}
                                </div>

                                {details.merchantAddresses[selectedCrypto] && (
                                    <>
                                        <div className="bg-white p-4 rounded-[2rem] shadow-2xl shadow-primary/10 border-8 border-muted/20">
                                            <QRCodeSVG value={details.merchantAddresses[selectedCrypto]} size={180} />
                                        </div>

                                        <div className="w-full space-y-3">
                                            <div className="flex justify-between items-end px-1">
                                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Target Address</p>
                                                <Badge className="bg-primary/10 text-primary border-none text-[8px] h-4">Network: {selectedCrypto}</Badge>
                                            </div>
                                            <div className="flex items-center justify-between bg-muted/50 border border-border/50 rounded-2xl p-4 group transition-colors hover:border-primary/30">
                                                <code className="text-xs break-all text-left flex-1 font-mono font-bold">{details.merchantAddresses[selectedCrypto]}</code>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="shrink-0 ml-4 h-10 w-10 rounded-xl hover:bg-primary transition-all active:scale-90"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(details.merchantAddresses[selectedCrypto]);
                                                        toast({ title: "Copied!", description: "Wallet address ready for transfer." });
                                                    }}
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="bg-primary/10 py-4 px-8 flex items-center gap-3 border-t border-primary/20">
                            <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
                            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Awaiting block confirmation...</p>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default CheckoutWidget;
