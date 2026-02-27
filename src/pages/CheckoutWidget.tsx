import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ShieldCheck, ArrowRight, Store, CheckCircle2, Copy } from "lucide-react";
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
    }, [sessionId]);

    const fetchCheckoutDetails = async () => {
        try {
            const [resDetails, resRates] = await Promise.all([
                fetch(`/api/v1/checkout/${sessionId}/details`),
                fetch("/api/transactions/rates")
            ]);

            const data = await resDetails.json();
            const ratesData = await resRates.json();

            if (data.success) {
                setDetails(data.data);
                // Auto-select a supported crypto
                const availableCryptos = Object.keys(data.data.merchantAddresses || {});
                if (!availableCryptos.includes("USDT") && availableCryptos.length > 0) {
                    setSelectedCrypto(availableCryptos[0]);
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

    const getEquivalentCryptoAmount = (crypto: string) => {
        if (!details || !rates) return 0;

        // If checkout is already in the target crypto
        if (details.currency === crypto) return details.amount;

        // Convert base to USD
        let amountInUsd = details.amount;
        if (details.currency === "NGN") {
            // Approximation if we don't have direct NGN/USD
            amountInUsd = details.amount / (rates.USDT || 1500);
        } else if (details.currency !== "USDT" && rates[details.currency]) {
            amountInUsd = details.amount * rates[details.currency];
        }

        // Convert USD to target crypto
        if (crypto === "USDT") return amountInUsd;

        return amountInUsd / (rates[crypto] || 1);
    };

    const handleStableXPayment = async () => {
        if (!isAuthenticated) {
            // Store redirect URL and push to login
            sessionStorage.setItem("checkoutRedirect", `/checkout/${sessionId}`);
            navigate("/web/login");
            return;
        }

        setProcessing(true);
        try {
            const res = await fetch(`/api/v1/checkout/${sessionId}/pay-internal`, {
                method: "POST",
                credentials: "include",
        headers: {
                    "Content-Type": "application/json",
                    }
            });
            const data = await res.json();

            if (data.success) {
                toast({ title: "Payment Successful", description: "Your payment was processed instantly." });
                setDetails(prev => prev ? { ...prev, status: 'completed' } : null);

                // Redirect user back to merchant success URL after 3 seconds
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
            <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!details) {
        return (
            <div className="min-h-screen bg-[#0b0e11] flex flex-col items-center justify-center text-white p-4">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <ShieldCheck className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Checkout Session Invalid</h1>
                <p className="text-muted-foreground text-center">This payment link may have expired or does not exist.</p>
            </div>
        );
    }

    const isExpired = new Date(details.expiresAt) < new Date() || details.status === 'expired';
    const isCompleted = details.status === 'completed';

    return (
        <div className="min-h-screen bg-[#0b0e11] flex flex-col items-center justify-center px-4 py-10 text-foreground font-sans bg-[url('/grid-bg.svg')] bg-center bg-cover">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-0" />

            <div className="w-full max-w-md z-10 space-y-6">

                {/* Header Branding */}
                <div className="flex justify-center items-center gap-2 mb-8">
                    <div className="w-8 h-8 bg-[#F0B90B] rounded-md flex items-center justify-center font-bold text-black text-xl">S</div>
                    <span className="text-xl font-bold tracking-tight text-white">StableX Checkout</span>
                </div>

                <Card className="p-0 overflow-hidden border-border/40 bg-[#1e2329] shadow-2xl shadow-primary/5 relative">
                    {/* Top Accent line */}
                    <div className="h-1 w-full bg-gradient-to-r from-primary to-blue-500" />

                    <div className="p-6 md:p-8 space-y-6">
                        {/* Merchant Details */}
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-2 shadow-inner border border-border/50">
                                <Store className="w-8 h-8 text-primary" />
                            </div>
                            <h2 className="text-xl font-bold text-white">{details.merchant.businessName}</h2>
                            {details.description && <p className="text-sm text-muted-foreground">{details.description}</p>}
                        </div>

                        {/* Amount display */}
                        <div className="bg-[#0b0e11] p-4 rounded-xl border border-border/50 text-center relative overflow-hidden">
                            <p className="text-sm text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Total to Pay</p>
                            <h1 className="text-4xl font-bold text-white">
                                {details.amount.toLocaleString()} <span className="text-xl text-primary">{details.currency}</span>
                            </h1>
                            {/* Decorative blur */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/5 blur-xl pointer-events-none" />
                        </div>

                        {/* Status Warnings */}
                        {isCompleted && (
                            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3 text-green-500">
                                <CheckCircle2 className="w-6 h-6 shrink-0" />
                                <div>
                                    <p className="font-bold">Payment Completed</p>
                                    <p className="text-xs opacity-80 mt-1">This checkout session has already been paid successfully.</p>
                                </div>
                            </div>
                        )}

                        {isExpired && !isCompleted && (
                            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-500">
                                <ShieldCheck className="w-6 h-6 shrink-0" />
                                <div>
                                    <p className="font-bold">Session Expired</p>
                                    <p className="text-xs opacity-80 mt-1">Please return to the merchant and initiate a new checkout.</p>
                                </div>
                            </div>
                        )}

                        {/* Payment Options */}
                        {!isCompleted && !isExpired && (
                            <div className="space-y-3 pt-4 border-t border-border/20">
                                <p className="text-xs text-muted-foreground text-center font-medium">SELECT A PAYMENT METHOD</p>

                                <Button
                                    className="w-full h-14 justify-between bg-primary hover:bg-primary/90 text-black font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(240,185,11,0.2)]"
                                    onClick={handleStableXPayment}
                                    disabled={processing}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center text-primary text-xs">S</div>
                                        {isAuthenticated ? "Pay with StableX Wallet" : "Login to Pay with StableX"}
                                    </div>
                                    {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                                </Button>

                                <div className="grid grid-cols-2 gap-3">
                                    <Button variant="outline" className="h-12 border-border/50 hover:bg-muted/50 rounded-xl" onClick={() => setShowCryptoModal(true)}>
                                        Crypto Transfer
                                    </Button>
                                    <Button variant="outline" className="h-12 border-border/50 hover:bg-muted/50 rounded-xl" onClick={() => toast({ title: "Coming soon", description: "Fiat bank transfers are being enabled." })}>
                                        Bank Transfer
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Secure Footer label */}
                    <div className="bg-muted/10 py-3 px-6 text-center border-t border-border/20 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <ShieldCheck className="w-3.5 h-3.5 text-green-500" /> Secure Payments by StableX Gateway
                    </div>
                </Card>

                {/* Crypto Transfer Modal */}
                <Dialog open={showCryptoModal} onOpenChange={setShowCryptoModal}>
                    <DialogContent className="sm:max-w-md bg-card border-border/50 text-foreground">
                        <DialogHeader>
                            <DialogTitle>Pay with Crypto Wallet</DialogTitle>
                            <DialogDescription>
                                Scan the QR code or copy the address below to send exactly <strong>{details.amount} {details.currency}</strong>.
                            </DialogDescription>
                        </DialogHeader>

                        {details.merchantAddresses && Object.keys(details.merchantAddresses).length > 0 ? (
                            <div className="flex flex-col items-center space-y-4 py-2">
                                <div className="flex gap-2 flex-wrap justify-center w-full mb-2">
                                    {['USDT', 'BTC', 'ETH', 'SOL'].map(coin => {
                                        if (!details.merchantAddresses[coin]) return null;
                                        return (
                                            <Button
                                                key={coin}
                                                variant={selectedCrypto === coin ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setSelectedCrypto(coin)}
                                                className={selectedCrypto === coin ? "bg-primary text-black" : "border-border/50"}
                                            >
                                                {coin}
                                            </Button>
                                        );
                                    })}
                                </div>

                                {details.merchantAddresses[selectedCrypto] && (
                                    <>
                                        <div className="text-center w-full bg-muted/20 py-3 rounded-xl border border-border/30">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Amount to Send</p>
                                            <h3 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                                                {getEquivalentCryptoAmount(selectedCrypto).toFixed(selectedCrypto === 'USDT' ? 2 : 6)} {selectedCrypto}
                                            </h3>
                                            <p className="text-xs text-muted-foreground mt-1">≈ {details.amount.toLocaleString()} {details.currency}</p>
                                        </div>

                                        <div className="bg-white p-4 rounded-xl shadow-lg border-4 border-muted/20">
                                            <QRCodeSVG value={details.merchantAddresses[selectedCrypto]} size={180} />
                                        </div>

                                        <div className="w-full space-y-1 text-center">
                                            <p className="text-xs font-medium text-muted-foreground">Deposit Address</p>
                                            <div className="flex items-center justify-between bg-muted/30 border border-border/50 rounded-lg p-3">
                                                <code className="text-xs break-all text-left flex-1 font-mono">{details.merchantAddresses[selectedCrypto]}</code>
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="shrink-0 ml-3 h-8 w-8 hover:bg-primary hover:text-black transition-colors"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(details.merchantAddresses[selectedCrypto]);
                                                        toast({ title: "Copied", description: "Address copied to clipboard" });
                                                    }}
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="py-10 text-center text-muted-foreground bg-muted/10 rounded-xl mt-4 border border-border/30">
                                <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p>This merchant has not set up any crypto deposit wallets.</p>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default CheckoutWidget;
