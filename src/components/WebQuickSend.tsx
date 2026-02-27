import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Send, CheckCircle2, Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/contexts/UserContext";

interface WebQuickSendProps {
    isOpen: boolean;
    onClose: () => void;
}

export function WebQuickSend({ isOpen, onClose }: WebQuickSendProps) {
    const { user } = useUser();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [username, setUsername] = useState("");
    const [recipient, setRecipient] = useState<{ _id: string; username: string; email: string } | null>(null);
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState("USDT_TRC20");
    const [isLoading, setIsLoading] = useState(false);
    const [paymentLink, setPaymentLink] = useState("");

    const { toast } = useToast();
    const suggestedAmounts = ["10", "50", "100", "500"];

    const searchUser = async () => {
        if (!username.trim() || !user) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/users/search?q=${username}`, {
                credentials: "include",
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || "User not found");

            setRecipient(data);
            setStep(2);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const generatePaymentLink = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/transactions/payment-link/create`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ currency: "USDT_TRC20" })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to generate link");

            setPaymentLink(data.link);
            setStep(3); // Link generated step
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const confirmSend = async () => {
        if (!recipient || !amount || isNaN(Number(amount)) || !user) return;

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
                    recipient_username: recipient.username,
                    amount,
                    currency
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Transfer failed");

            toast({ title: "Success", description: "Transfer completed instantly!" });
            handleClose();
        } catch (error: any) {
            toast({ title: "Transfer Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setStep(1);
        setUsername("");
        setRecipient(null);
        setAmount("");
        setPaymentLink("");
        onClose();
    };

    const copyLink = () => {
        navigator.clipboard.writeText(paymentLink);
        toast({ title: "Copied!", description: "Payment link copied to clipboard" });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md bg-card border-border/50 text-foreground overflow-hidden">
                {/* Apple Pay style top shine */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50"></div>

                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Send className="w-5 h-5 text-primary" />
                        Quick Send
                    </DialogTitle>
                    <DialogDescription>
                        Instant, zero-fee transfers via username or payment link
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            <div className="space-y-4">
                                <label className="text-sm font-medium text-muted-foreground">Send to Username</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                                    <Input
                                        placeholder="username"
                                        className="pl-8 h-12 text-lg bg-background"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && searchUser()}
                                    />
                                </div>
                                <Button
                                    className="w-full h-12 font-bold"
                                    onClick={searchUser}
                                    disabled={isLoading || !username}
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Find User"}
                                </Button>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">OR</span></div>
                            </div>

                            <Button
                                variant="outline"
                                className="w-full h-12 border-primary/20 text-primary hover:bg-primary/10"
                                onClick={generatePaymentLink}
                                disabled={isLoading}
                            >
                                Create Payment Link
                            </Button>
                        </div>
                    )}

                    {step === 2 && recipient && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                            <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-primary/20 font-bold text-primary flex items-center justify-center text-xl">
                                    {recipient.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">@{recipient.username}</h3>
                                    <p className="text-xs text-muted-foreground">Verified StableX User</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-sm font-medium text-muted-foreground">Amount ({currency})</label>
                                </div>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    className="h-16 text-3xl font-bold text-center bg-background border-primary/20"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {suggestedAmounts.map(a => (
                                    <Button
                                        key={a}
                                        variant="outline"
                                        className="h-10 border-border/60 hover:border-primary hover:text-primary"
                                        onClick={() => setAmount(a)}
                                    >
                                        ${a}
                                    </Button>
                                ))}
                            </div>

                            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                                <p className="text-sm text-green-500 font-medium">Fee: 0 USDT (Internal)</p>
                                <p className="text-xs text-green-500/80 mt-1">Settles instantly</p>
                            </div>

                            <Button
                                className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20"
                                onClick={confirmSend}
                                disabled={isLoading || !amount || Number(amount) <= 0}
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Pay ${amount || "0"} ${currency}`}
                            </Button>
                        </div>
                    )}

                    {step === 3 && paymentLink && (
                        <div className="space-y-6 text-center animate-in zoom-in-95 duration-300">
                            <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mx-auto mb-2">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>

                            <div>
                                <h3 className="font-bold text-2xl">Link Created!</h3>
                                <p className="text-muted-foreground mt-2">Anyone with this link can pay your account directly.</p>
                            </div>

                            <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 break-all text-left relative group">
                                <p className="text-sm text-foreground/90 font-mono select-all pr-8">
                                    {paymentLink}
                                </p>
                                <button
                                    onClick={copyLink}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-background rounded-md transition-colors"
                                >
                                    <Copy className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    className="h-12 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 hover:text-[#25D366]"
                                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent("Pay me via StableX: " + paymentLink)}`, "_blank")}
                                >
                                    WhatsApp
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-12 border-[#0088cc] text-[#0088cc] hover:bg-[#0088cc]/10 hover:text-[#0088cc]"
                                    onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(paymentLink)}&text=${encodeURIComponent("Pay me via StableX")}`, "_blank")}
                                >
                                    Telegram
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
