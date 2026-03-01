import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, KeyRound } from "lucide-react";
import { BackButton } from "@/components/BackButton";

const API = import.meta.env.VITE_API_URL || "";

export default function WebResetPassword() {
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();

    // Parse token from URL query params
    const token = new URLSearchParams(location.search).get("token");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            toast({ variant: "destructive", title: "Invalid Link", description: "Missing reset token." });
            return;
        }

        if (newPassword !== confirmPassword) {
            toast({ variant: "destructive", title: "Passwords do not match", description: "Please ensure both passwords are the same." });
            return;
        }

        if (newPassword.length < 8) {
            toast({ variant: "destructive", title: "Weak password", description: "Password must be at least 8 characters long." });
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch(`${API}/api/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, newPassword }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toast({
                    title: "Success",
                    description: "Password reset successful. You can now log in.",
                });
                navigate("/web/login");
            } else {
                throw new Error(data.error || "Failed to reset password");
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Reset Failed",
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
                        Set your new<br />
                        <span className="text-primary">secure password.</span>
                    </h1>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
            </div>

            <div className="flex-1 flex items-center justify-center p-8 lg:p-12 relative z-10 bg-background/95 backdrop-blur-sm">
                <div className="w-full max-w-md">
                    <div className="text-left mb-8">
                        <div className="inline-flex lg:hidden items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-6">
                            <KeyRound className="w-6 h-6 text-primary" />
                        </div>
                        <h2 className="text-3xl font-bold mb-2">Reset Password</h2>
                        <p className="text-muted-foreground">Enter a new strong password below</p>
                    </div>

                    {!token ? (
                        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm mb-6 border border-red-200">
                            <strong>Invalid Link:</strong> Missing password reset token. Please request a new link.
                            <div className="mt-4">
                                <Button onClick={() => navigate("/web/forgot-password")} variant="outline" className="w-full">
                                    Request New Link
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="newPassword" className="font-semibold">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    placeholder="At least 8 characters"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    className="h-12"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="font-semibold">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="Verify new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="h-12"
                                />
                            </div>

                            <Button className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20" type="submit" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Resetting...
                                    </>
                                ) : (
                                    "Save Password"
                                )}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
