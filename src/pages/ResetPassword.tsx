import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, KeyRound } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { apiFetch } from "@/lib/api";

export default function ResetPassword() {
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
            const res = await apiFetch(`/api/auth/reset-password`, {
                method: "POST",
                body: JSON.stringify({ token, newPassword }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toast({
                    title: "Success",
                    description: "Password reset successful. You can now log in.",
                });
                navigate("/login");
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
        <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
            <BackButton className="absolute top-4 left-4" />
            <Card className="w-full max-w-md border-none shadow-none sm:border sm:shadow-sm">
                <CardContent className="p-6">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                            <KeyRound className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold">Reset Password</h1>
                        <p className="text-muted-foreground">Enter a new strong password below</p>
                    </div>

                    {!token ? (
                        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm mb-6 border border-red-200">
                            <strong>Invalid Link:</strong> Missing password reset token. Please request a new link.
                            <div className="mt-4">
                                <Button onClick={() => navigate("/forgot-password")} variant="outline" className="w-full">
                                    Request New Link
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    placeholder="At least 8 characters"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="Verify new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <Button className="w-full" type="submit" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Resetting...
                                    </>
                                ) : (
                                    "Save Password"
                                )}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
