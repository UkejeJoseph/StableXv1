import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, KeyRound } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { apiFetch } from "@/lib/api";

export default function ForgotPassword() {
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
        <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
            <BackButton className="absolute top-4 left-4" />
            <Card className="w-full max-w-md border-none shadow-none sm:border sm:shadow-sm">
                <CardContent className="p-6">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                            <KeyRound className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold">Forgot Password</h1>
                        <p className="text-muted-foreground">Enter your email to receive a reset link</p>
                    </div>

                    {isSuccess ? (
                        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-6 rounded-lg text-center border border-green-200 dark:border-green-800">
                            <h3 className="font-bold text-lg mb-2">Check your email</h3>
                            <p className="text-sm">We've sent a password reset link to <span className="font-semibold">{email}</span></p>
                            <Button
                                variant="outline"
                                className="mt-6 w-full"
                                onClick={() => window.location.href = "/login"}
                            >
                                Return to Login
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <Button className="w-full" type="submit" disabled={isLoading || !email}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending Link...
                                    </>
                                ) : (
                                    "Send Reset Link"
                                )}
                            </Button>

                            <p className="text-center text-sm text-muted-foreground mt-6">
                                Remembered your password?{" "}
                                <Link to="/login" className="text-primary hover:underline font-medium">
                                    Sign In
                                </Link>
                            </p>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
