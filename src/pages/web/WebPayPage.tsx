import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { WebLayout } from "@/components/WebSidebar";
import { useUser } from "@/contexts/UserContext";

export default function WebPayPage() {
    const { user } = useUser();
    const { username } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    const urlCurrency = searchParams.get("currency") || "USDT_TRC20";
    const urlAmount = searchParams.get("amount") || "";

    const [amount, setAmount] = useState(urlAmount);
    const [currency, setCurrency] = useState(urlCurrency);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const isLoggedIn = !!user;

    const suggestedAmounts = ["10", "50", "100", "500"];

    const handlePay = async () => {
        if (!isLoggedIn) {
            toast({ title: "Login Required", description: "You must be logged in to send funds." });
            navigate(`/web/login?redirect=/web/pay/${username}?currency=${currency}&amount=${amount}`);
            return;
        }

        if (!amount || isNaN(Number(amount))) return;

        const numAmount = Number(amount);
        if (numAmount < 1) {
            toast({
                title: "Amount Too Small",
                description: "Minimum internal transfer is 1 USDT",
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`/api/transactions/transfer/internal`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    recipient_username: username,
                    amount,
                    currency
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Transfer failed");

            setIsSuccess(true);
        } catch (error: any) {
            toast({ title: "Payment Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <WebLayout hideSidebar={!isLoggedIn}>
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-12 h-12" />
                        </div>
                        <h2 className="text-3xl font-bold">Payment Sent!</h2>
                        <p className="text-muted-foreground text-lg">
                            You successfully sent <strong className="text-foreground">{amount} {currency}</strong> to <strong>@{username}</strong>.
                        </p>
                        <Button className="w-full h-12 mt-4" onClick={() => navigate("/dashboard")}>
                            Back to Dashboard
                        </Button>
                    </div>
                </div>
            </WebLayout>
        );
    }

    return (
        <WebLayout hideSidebar={!isLoggedIn}>
            <div className="flex-1 flex justify-center pt-12 md:pt-24 px-4 bg-background">
                <div className="max-w-md w-full space-y-8 animate-in slide-in-from-bottom-4 duration-500">

                    {/* Header */}
                    <div className="text-center space-y-4">
                        <div className="w-20 h-20 rounded-full bg-primary/20 font-bold text-primary flex items-center justify-center text-4xl mx-auto border-2 border-primary/50 shadow-[0_0_30px_rgba(var(--primary),0.3)]">
                            {username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Pay @{username}</h2>
                            <p className="text-muted-foreground">StableX User</p>
                        </div>
                    </div>

                    {/* Pay Form */}
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-xl space-y-6">

                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-sm font-medium text-muted-foreground">Amount ({currency})</label>
                            </div>
                            <Input
                                type="number"
                                placeholder="0.00"
                                className="h-20 text-4xl font-bold text-center bg-background border-primary/20 placeholder:text-muted-foreground/30"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                            {suggestedAmounts.map(a => (
                                <Button
                                    key={a}
                                    variant="outline"
                                    className="h-12 border-border/60 hover:border-primary hover:text-primary font-medium"
                                    onClick={() => setAmount(a)}
                                >
                                    ${a}
                                </Button>
                            ))}
                        </div>

                        <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Network Fee</span>
                                <span className="text-green-500 font-medium">Free</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Speed</span>
                                <span className="text-green-500 font-medium">Instant</span>
                            </div>
                            <div className="border-t border-border/50 my-2 pt-2 flex justify-between font-bold">
                                <span>Total Deducted</span>
                                <span>{amount || "0.00"} {currency}</span>
                            </div>
                        </div>

                        {!isLoggedIn ? (
                            <div className="space-y-4 pt-2">
                                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3 text-blue-500 text-sm items-start">
                                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <p>You need a StableX account to complete this instant transfer.</p>
                                </div>
                                <Button className="w-full h-14 text-lg font-bold" onClick={handlePay}>
                                    Log In to Pay
                                </Button>
                                <p className="text-center text-sm text-muted-foreground">
                                    New to StableX? <Link to="/web/signup" className="text-primary hover:underline">Sign up</Link>
                                </p>
                            </div>
                        ) : (
                            <Button
                                className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20"
                                onClick={handlePay}
                                disabled={isLoading || !amount || Number(amount) <= 0}
                            >
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                                ) : (
                                    <>
                                        <Send className="mr-2 w-5 h-5" />
                                        Pay {amount || "0.00"} {currency}
                                    </>
                                )}
                            </Button>
                        )}

                    </div>

                    <p className="text-center text-xs text-muted-foreground pt-4">
                        Payments to @{username} are processed instantly and are non-reversible.
                    </p>
                </div>
            </div>
        </WebLayout>
    );
}
