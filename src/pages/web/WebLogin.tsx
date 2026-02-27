import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, LogIn } from "lucide-react";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        const userInfo = localStorage.getItem("webUserInfo");
        if (userInfo) {
            navigate("/web/dashboard");
        }
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch("/api/users/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (res.ok) {
                // Wrap response under 'user' key so sidebar/components can access userInfo.user.kycStatus, etc.
                const stored = { user: data, token: data.token };
                localStorage.setItem("webUserInfo", JSON.stringify(stored));
                toast({
                    title: "Welcome back!",
                    description: "Logged in successfully.",
                });
                navigate("/web/dashboard");
            } else {
                // Handle "Verify" error specifically?
                if (data.message && data.message.includes("verify")) {
                    navigate("/web/verify", { state: { email } });
                }
                throw new Error(data.message || "Login failed");
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
        <div className="min-h-screen w-full flex bg-background font-sans">
            {/* Left Side - Branding/Marketing (Hidden on very small screens, but this is the web version) */}
            <div className="hidden lg:flex lg:flex-1 bg-[#0b0e11] flex-col justify-between p-12 relative overflow-hidden">
                <div className="relative z-10">
                    <Link to="/" className="flex items-center gap-2 mb-12">
                        <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center font-bold text-background text-2xl">S</div>
                        <span className="text-2xl font-bold tracking-tight text-white">StableX Web</span>
                    </Link>
                    <h1 className="text-5xl font-bold text-white leading-tight mb-6">
                        Securely manage your<br />
                        <span className="text-primary">crypto assets.</span>
                    </h1>
                    <p className="text-lg text-white/70 max-w-md">
                        Experience the full power of StableX on your desktop. Multi-chain custody, instant swaps, and enterprise-grade security.
                    </p>
                </div>

                {/* Abstract geometric shapes or glowing orbs for decoration */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="relative z-10 text-white/50 text-sm">
                    &copy; {new Date().getFullYear()} StableX. All rights reserved.
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex-1 flex items-center justify-center p-8 lg:p-12 relative z-10 bg-background/95 backdrop-blur-sm">
                <div className="w-full max-w-md">
                    <div className="text-left mb-8">
                        <div className="inline-flex lg:hidden items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-6">
                            <LogIn className="w-6 h-6 text-primary" />
                        </div>
                        <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
                        <p className="text-muted-foreground">Sign in to your StableX web account</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
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

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="font-semibold">Password</Label>
                                <Link to="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                                    Forgot password?
                                </Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="h-12"
                            />
                        </div>

                        <Button className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20" type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Signing In...
                                </>
                            ) : (
                                "Sign In"
                            )}
                        </Button>
                    </form>

                    {/* Google Sign-In */}
                    <div className="mt-6">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">or continue with</span>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            className="w-full h-12 bg-card border-border hover:bg-muted rounded-md text-foreground font-medium flex items-center justify-center gap-3 transition-colors"
                            onClick={() => window.location.href = '/api/auth/google'}
                        >
                            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"></path><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"></path></svg>
                            Sign in with Google
                        </Button>
                    </div>

                    <div className="mt-8 pt-8 border-t border-border">
                        <p className="text-center text-sm text-muted-foreground">
                            Don't have a Web account?{" "}
                            <Link to="/web/signup" className="text-primary hover:underline font-bold">
                                Create Account
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
