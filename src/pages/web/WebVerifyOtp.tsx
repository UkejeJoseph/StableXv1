import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ArrowLeft, Mail } from "lucide-react";

export default function VerifyOtp() {
    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();

    const email = location.state?.email || "";

    // Cooldown timer for resend button
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleResendOtp = async () => {
        if (!email) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Email not found. Please go back to signup.",
            });
            return;
        }

        setIsResending(true);

        try {
            const res = await fetch("/api/users/resend-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (res.ok) {
                toast({
                    title: "Code Resent",
                    description: data.message || "A new verification code has been sent to your email.",
                });
                setResendCooldown(60); // 60 second cooldown
            } else {
                throw new Error(data.message || "Failed to resend code");
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Resend Failed",
                description: error.message,
            });
        } finally {
            setIsResending(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp || otp.length < 6) {
            toast({
                variant: "destructive",
                title: "Invalid Code",
                description: "Please enter a valid 6-digit OTP code.",
            });
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch("/api/users/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp }),
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem("webUserInfo", JSON.stringify(data));
                toast({
                    title: "Verification Successful",
                    description: "Welcome to StableX!",
                });
                navigate("/web/dashboard");
            } else {
                throw new Error(data.message || "Verification failed");
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Verification Failed",
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-background font-sans">
            {/* Left Side - Branding/Marketing */}
            <div className="hidden lg:flex lg:flex-1 bg-[#0b0e11] flex-col justify-between p-12 relative overflow-hidden">
                <div className="relative z-10">
                    <Link to="/" className="flex items-center gap-2 mb-12">
                        <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center font-bold text-background text-2xl">S</div>
                        <span className="text-2xl font-bold tracking-tight text-white">StableX Web</span>
                    </Link>
                    <h1 className="text-5xl font-bold text-white leading-tight mb-6">
                        Verify your identity to<br />
                        <span className="text-primary">access your account.</span>
                    </h1>
                    <p className="text-lg text-white/70 max-w-md">
                        We use mandatory OTP verification to ensure your assets are always protected by enterprise-grade security.
                    </p>
                </div>

                {/* Abstract geometric shapes or glowing orbs for decoration */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="relative z-10 text-white/50 text-sm">
                    &copy; {new Date().getFullYear()} StableX. All rights reserved.
                </div>
            </div>

            {/* Right Side - Verification Form */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 relative z-10 bg-background/95 backdrop-blur-sm w-full">
                <div className="w-full max-w-md">
                    <div className="text-left mb-8">
                        <div className="inline-flex lg:hidden items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-6">
                            <Mail className="w-6 h-6 text-primary" />
                        </div>
                        <h2 className="text-3xl font-bold mb-2">Verify Your Email</h2>
                        <p className="text-muted-foreground">
                            We sent a verification code to <span className="font-medium text-foreground">{email}</span>
                        </p>
                    </div>

                    <form onSubmit={handleVerify} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="otp" className="font-semibold">Enter Verification Code</Label>
                            <Input
                                id="otp"
                                placeholder="123456"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="h-14 text-center text-2xl tracking-[0.5em] font-mono"
                                maxLength={6}
                            />
                        </div>

                        <Button className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20" type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                "Verify Email"
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-border flex flex-col items-center gap-4">
                        <p className="text-sm text-muted-foreground">
                            Didn't receive the code?{" "}
                            <button
                                onClick={handleResendOtp}
                                disabled={isResending || resendCooldown > 0}
                                className="text-primary hover:underline font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isResending
                                    ? "Sending..."
                                    : resendCooldown > 0
                                        ? `Resend in ${resendCooldown}s`
                                        : "Resend Code"}
                            </button>
                        </p>

                        <div
                            onClick={() => {
                                localStorage.removeItem("webUserInfo");
                                navigate("/web/login");
                            }}
                            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Login
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

