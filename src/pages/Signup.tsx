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
                navigate("/verify", { state: { email: formData.email } });
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
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md border-none shadow-none sm:border sm:shadow-sm">
                <CardContent className="p-6">
                    <div className="mb-6">
                        <Link to="/login" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Login
                        </Link>
                        <h1 className="text-2xl font-bold mb-2">Create Account</h1>
                        <p className="text-muted-foreground">Join StableX today</p>
                    </div>

                    <Tabs defaultValue="user" value={role} onValueChange={setRole} className="mb-6">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="user" className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Personal
                            </TabsTrigger>
                            <TabsTrigger value="merchant" className="flex items-center gap-2">
                                <Store className="w-4 h-4" />
                                Merchant
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="user">
                            <p className="text-xs text-muted-foreground mb-4 text-center">
                                For individuals to send, receive, and swap assets.
                            </p>
                        </TabsContent>

                        <TabsContent value="merchant">
                            <p className="text-xs text-muted-foreground mb-4 text-center">
                                For businesses to accept payments and manage funds.
                            </p>
                        </TabsContent>
                    </Tabs>

                    <form onSubmit={handleSignup} className="space-y-4">
                        {role === "merchant" && (
                            <div className="space-y-2">
                                <Label htmlFor="businessName">Business Name</Label>
                                <Input
                                    id="businessName"
                                    placeholder="Your Business Ltd."
                                    value={formData.businessName}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        )}

                        {!role || role === "user" ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First Name</Label>
                                    <Input id="firstName" placeholder="John" value={formData.firstName} onChange={handleChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last Name</Label>
                                    <Input id="lastName" placeholder="Doe" value={formData.lastName} onChange={handleChange} />
                                </div>
                            </div>
                        ) : null}

                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="john@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="+234..."
                                value={formData.phone}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <Button className="w-full" type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating Account...
                                </>
                            ) : (
                                "Create Account"
                            )}
                        </Button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground mt-6">
                        Already have an account?{" "}
                        <Link to="/login" className="text-primary hover:underline font-medium">
                            Log in
                        </Link>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
