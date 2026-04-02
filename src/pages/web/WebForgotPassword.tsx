import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, KeyRound } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { apiFetch } from "@/lib/api";

export default function WebForgotPassword() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await apiFetch(`/api/auth/forgot-password`, {
                method: "POST",
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setIsSuccess(true);
            } else {
                throw new Error(data.error || "Failed to process request");
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Request Failed",
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-background font-sans relative">
            <BackButton className="absolute top-4 left-4 z-50 text-white hover:text-white/80" />

            <div className="hidden lg:flex lg:flex-1 bg-[#0b0e11] flex-col justify-between p-12 relative overflow-hidden">
                <div className="relative z-10">
                    <Link to="/" className="flex items-center gap-2 mb-12">
                        <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center font-bold text-background text-2xl">S</div>
                        <span className="text-2xl font-bold tracking-tight text-white">StableX Web</span>
                    </Link>
                    <h1 className="text-5xl font-bold text-white leading-tight mb-6">
                        Reset your<br />
                        <span className="text-primary">password.</span>
                    </h1>
                    <p className="text-lg text-white/70 max-w-md">
                        Don't worry, it happens to the best of us. We'll send you a link to securely access your account.
                    </p>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
            </div>

            <div className="flex-1 flex items-center justify-center p-8 lg:p-12 relative z-10 bg-background/95 backdrop-blur-sm">
                <div className="w-full max-w-md">
                    <div className="text-left mb-8">
                        <div className="inline-flex lg:hidden items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-6">
                            <KeyRound className="w-6 h-6 text-primary" />
                        </div>
                        <h2 className="text-3xl font-bold mb-2">Forgot Password</h2>
                        <p className="text-muted-foreground">Enter your email to receive a reset link</p>
                    </div>

                    {isSuccess ? (
                        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-6 rounded-lg text-center border border-green-200 dark:border-green-800">
                            <h3 className="font-bold text-lg mb-2">Check your email</h3>
                            <p className="text-sm">We've sent a password reset link to <span className="font-semibold">{email}</span></p>
                            <Button
                                variant="outline"
                                className="mt-6 w-full"
                                onClick={() => window.location.href = "/web/login"}
                            >
                                Return to Login
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="font-semibold">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="h-12"
                                />
                            </div>

                            <Button className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20" type="submit" disabled={isLoading || !email}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Sending Link...
                                    </>
                                ) : (
                                    "Send Reset Link"
                                )}
                            </Button>

                            <div className="mt-8 pt-8 border-t border-border">
                                <p className="text-center text-sm text-muted-foreground">
                                    Remembered your password?{" "}
                                    <Link to="/web/login" className="text-primary hover:underline font-bold">
                                        Sign In
                                    </Link>
                                </p>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
