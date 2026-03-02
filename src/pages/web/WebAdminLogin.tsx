import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ShieldAlert } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { useUser } from "@/contexts/UserContext";

export default function WebAdminLogin() {
    const { user, setUser } = useUser();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        if (user) {
            if (user.role === 'admin') {
                navigate("/web/admin");
            } else {
                navigate("/web/dashboard");
            }
        }
    }, [user, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (res.ok) {
                setUser(data);
                toast({
                    title: "Admin login successful",
                    description: "Bypassed standard verification checks.",
                });

                if (data.role === 'admin') {
                    navigate("/web/admin");
                } else {
                    navigate("/web/dashboard");
                }
            } else {
                throw new Error(data.message || "Admin login failed");
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Login Failed",
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-background font-sans relative justify-center items-center p-4">
            <BackButton className="absolute top-4 left-4 z-50 text-white hover:text-white/80" />

            <div className="w-full max-w-md bg-card border border-red-500/20 shadow-2xl shadow-red-500/10 rounded-xl p-8">
                <div className="text-center mb-8 flex flex-col items-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-6">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-3xl font-bold mb-2 text-white">Fast Admin Login</h2>
                    <p className="text-muted-foreground text-sm">Direct database authentication. OTP bypassed.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="font-semibold text-white">Email Address</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="admin@stablex.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="h-12 bg-background border-border text-white focus:border-red-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password" className="font-semibold text-white">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="h-12 bg-background border-border text-white focus:border-red-500"
                        />
                    </div>

                    <Button className="w-full h-12 text-base font-bold bg-red-600 hover:bg-red-700 text-white" type="submit" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Authenticating...
                            </>
                        ) : (
                            "Force Login"
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
