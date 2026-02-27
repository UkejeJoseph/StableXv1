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
                localStorage.setItem("userInfo", JSON.stringify(data));
                toast({
                    title: "Verification Successful",
                    description: "Welcome to StableX!",
                });
                navigate("/dashboard");
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
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md p-6 space-y-6">
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <Mail className="w-6 h-6 text-primary" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold">Verify Your Email</h1>
                    <p className="text-muted-foreground">
                        We sent a verification code to <span className="font-medium text-foreground">{email}</span>
                    </p>
                </div>

                <form onSubmit={handleVerify} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="otp">Enter Verification Code</Label>
                        <Input
                            id="otp"
                            placeholder="123456"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="text-center text-lg tracking-widest"
                            maxLength={6}
                        />
                    </div>

                    <Button className="w-full" type="submit" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            "Verify Email"
                        )}
                    </Button>
                </form>

                <div className="text-center text-sm">
                    <p className="text-muted-foreground mb-4">
                        Didn't receive the code?{" "}
                        <button
                            onClick={handleResendOtp}
                            disabled={isResending || resendCooldown > 0}
                            className="text-primary hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isResending
                                ? "Sending..."
                                : resendCooldown > 0
                                    ? `Resend in ${resendCooldown}s`
                                    : "Resend Code"}
                        </button>
                    </p>
                    <Link
                        to="/login"
                        className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Login
                    </Link>
                </div>
            </Card>
        </div>
    );
}

