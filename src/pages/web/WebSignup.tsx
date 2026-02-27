import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, User, Store, ArrowLeft } from "lucide-react";

export default function Signup() {
    const [role, setRole] = useState("user");
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        firstName: "",
        lastName: "",
        phone: "",
        businessName: "",
    });
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { toast } = useToast();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            toast({
                variant: "destructive",
                title: "Passwords do not match",
                description: "Please check your password confirmation.",
            });
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    name: `${formData.firstName} ${formData.lastName}`.trim(),
                    role,
                    phoneNumber: formData.phone,
                    ...(role === "merchant" && {
                        merchantProfile: { businessName: formData.businessName }
                    }),
                }),
            });

            const data = await res.json();

            if (res.ok) {
                toast({
                    title: "Account Created",
                    description: "Please verify your email address.",
                });
                navigate("/web/verify", { state: { email: formData.email } });
            } else {
                throw new Error(data.message || "Signup failed");
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Signup Failed",
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
                        Join the next generation of<br />
                        <span className="text-primary">digital finance.</span>
                    </h1>
                    <p className="text-lg text-white/70 max-w-md">
                        Create your free Web account today. Experience lightning fast swaps, global rails, and full-custody HD wallets.
                    </p>
                </div>

                {/* Abstract geometric shapes or glowing orbs for decoration */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="relative z-10 text-white/50 text-sm">
                    &copy; {new Date().getFullYear()} StableX. All rights reserved.
                </div>
            </div>

            {/* Right Side - Signup Form */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 relative z-10 bg-background/95 backdrop-blur-sm overflow-y-auto w-full">
                <div className="w-full max-w-md py-8">
                    <div className="mb-8">
                        <div
                            onClick={() => {
                                localStorage.removeItem("webUserInfo");
                                navigate("/web/login");
                            }}
                            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Login
                        </div>
                        <h1 className="text-3xl font-bold mb-2">Create Account</h1>
                        <p className="text-muted-foreground">Join StableX Web today</p>
                    </div>

                    <Tabs defaultValue="user" value={role} onValueChange={setRole} className="mb-8">
                        <TabsList className="grid w-full grid-cols-2 h-12">
                            <TabsTrigger value="user" className="flex items-center gap-2 text-base">
                                <User className="w-4 h-4" />
                                Personal
                            </TabsTrigger>
                            <TabsTrigger value="merchant" className="flex items-center gap-2 text-base">
                                <Store className="w-4 h-4" />
                                Merchant
                            </TabsTrigger>
                        </TabsList>

                        <div className="mt-4">
                            <TabsContent value="user">
                                <p className="text-sm text-muted-foreground text-center">
                                    For individuals to send, receive, and swap assets.
                                </p>
                            </TabsContent>

                            <TabsContent value="merchant">
                                <p className="text-sm text-muted-foreground text-center">
                                    For businesses to accept payments and manage funds.
                                </p>
                            </TabsContent>
                        </div>
                    </Tabs>

                    <form onSubmit={handleSignup} className="space-y-5">
                        {role === "merchant" && (
                            <div className="space-y-2">
                                <Label htmlFor="businessName" className="font-semibold">Business Name</Label>
                                <Input
                                    id="businessName"
                                    placeholder="Your Business Ltd."
                                    value={formData.businessName}
                                    onChange={handleChange}
                                    required
                                    className="h-12"
                                />
                            </div>
                        )}

                        {!role || role === "user" ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName" className="font-semibold">First Name</Label>
                                    <Input id="firstName" placeholder="John" value={formData.firstName} onChange={handleChange} className="h-12" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName" className="font-semibold">Last Name</Label>
                                    <Input id="lastName" placeholder="Doe" value={formData.lastName} onChange={handleChange} className="h-12" />
                                </div>
                            </div>
                        ) : null}

                        <div className="space-y-2">
                            <Label htmlFor="email" className="font-semibold">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className="h-12"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone" className="font-semibold">Phone Number</Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="+234..."
                                value={formData.phone}
                                onChange={handleChange}
                                className="h-12"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="font-semibold">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className="h-12"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="font-semibold">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                className="h-12"
                            />
                        </div>

                        <Button className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20 mt-4" type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Creating Account...
                                </>
                            ) : (
                                "Create Account"
                            )}
                        </Button>
                    </form>

                    {/* Google Sign-Up */}
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
                            Sign up with Google
                        </Button>
                    </div>

                    <div className="mt-8 pt-8 border-t border-border">
                        <p className="text-center text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link to="/web/login" className="text-primary hover:underline font-bold">
                                Log in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
