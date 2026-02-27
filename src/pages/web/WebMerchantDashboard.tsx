import { useState, useEffect } from "react";
import { WebLayout } from "@/components/WebSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Key, Link as LinkIcon, RefreshCw, Copy, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { TransactionHistory } from "@/components/TransactionHistory";
import { QuickActionsGrid } from "@/components/QuickActionsGrid";
import { AssetDistributionChart } from "@/components/AssetDistributionChart";
import { DashboardSidebarWidgets } from "@/components/DashboardSidebarWidgets";
import { MerchantBalances } from "@/components/MerchantBalances";
import { MerchantKYCPanel } from "@/components/MerchantKYCPanel";

const WebMerchantDashboard = () => {
    const { toast } = useToast();
    const [kycStatus, setKycStatus] = useState<string>("pending");
    const [apiKeys, setApiKeys] = useState<{ publicKey: string | null; secretKey: string | null }>({ publicKey: null, secretKey: null });
    const [webhookUrl, setWebhookUrl] = useState<string>("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
    const token = userInfo?.token;

    useEffect(() => {
        fetchDeveloperSettings();
    }, []);

    const fetchDeveloperSettings = async () => {
        if (!token) return;
        try {
            const res = await fetch("/api/developer/keys", {
                credentials: "include",
        
            });
            const data = await res.json();
            if (data.success) {
                setApiKeys(data.apiKeys);
                setWebhookUrl(data.webhookUrl || "");
            }

            // Fetch User for KYC
            const userRes = await fetch("/api/users/profile", {
                credentials: "include",
        
            });
            const userData = await userRes.json();
            if (userData._id) {
                setKycStatus(userData.kycStatus || 'pending');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const generateKeys = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch("/api/developer/keys", {
                method: "POST",
                credentials: "include",
        
            });
            const data = await res.json();
            if (data.success) {
                setApiKeys(data.apiKeys);
                toast({ title: "Keys Generated", description: "New API keys have been generated." });
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    const updateWebhook = async () => {
        try {
            const res = await fetch("/api/developer/webhook", {
                method: "PUT",
                credentials: "include",
        headers: {
                    "Content-Type": "application/json",
                    },
                body: JSON.stringify({ webhookUrl })
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: "Webhook Updated", description: "Your webhook URL was saved." });
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied", description: "Copied to clipboard" });
    };

    return (
        <WebLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                            Merchant Gateway
                        </h1>
                        <p className="text-muted-foreground">Manage your API integrations and business checkouts</p>
                    </div>

                    {kycStatus === 'verified' ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 text-sm font-medium border border-green-500/20">
                            <CheckCircle2 className="w-4 h-4" /> Business Verified
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-500 text-sm font-medium border border-yellow-500/20">
                            <ShieldAlert className="w-4 h-4" /> KYC Pending
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content (Left 2/3) */}
                    <div className="lg:col-span-2 space-y-6">
                        <MerchantKYCPanel />
                        <MerchantBalances />
                        <QuickActionsGrid />
                        <TransactionHistory />
                    </div>

                    {/* Developer Settings Sidebar (Right 1/3) */}
                    <div className="space-y-6 lg:col-span-1">
                        <AssetDistributionChart />
                        <DashboardSidebarWidgets />

                        <Card className="p-5 border-border/40 bg-card card-elevated">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Key className="w-5 h-5 text-primary" /> API Keys
                            </h3>

                            {isLoading ? (
                                <div className="h-32 flex items-center justify-center"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm text-muted-foreground">Public Key</label>
                                        <div className="flex border border-border/50 rounded-md overflow-hidden bg-background">
                                            <Input readOnly value={apiKeys.publicKey || "Not Generated"} className="border-0 bg-transparent focus-visible:ring-0 font-mono text-xs" />
                                            {apiKeys.publicKey && (
                                                <Button variant="ghost" size="icon" className="rounded-none hover:bg-muted" onClick={() => copyToClipboard(apiKeys.publicKey!)}>
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm text-muted-foreground">Secret Key (Keep private!)</label>
                                        <div className="flex border border-border/50 rounded-md overflow-hidden bg-background">
                                            <Input readOnly type="password" value={apiKeys.secretKey || "Not Generated"} className="border-0 bg-transparent focus-visible:ring-0 font-mono text-xs" />
                                            {apiKeys.secretKey && (
                                                <Button variant="ghost" size="icon" className="rounded-none hover:bg-muted" onClick={() => copyToClipboard(apiKeys.secretKey!)}>
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full mt-2"
                                        variant={apiKeys.publicKey ? "outline" : "default"}
                                        onClick={generateKeys}
                                        disabled={isGenerating}
                                    >
                                        {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                                        {apiKeys.publicKey ? "Roll API Keys" : "Generate API Keys"}
                                    </Button>

                                    {apiKeys.publicKey && (
                                        <p className="text-xs text-yellow-500 mt-2">Warning: Rolling keys will invalidate your existing integrations.</p>
                                    )}
                                </div>
                            )}
                        </Card>

                        <Card className="p-5 border-border/40 bg-card card-elevated">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <LinkIcon className="w-5 h-5 text-primary" /> Webhook Integration
                            </h3>

                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">Receive real-time HTTP POST alerts when checkout payments are completed.</p>

                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground">Webhook URL</label>
                                    <Input
                                        placeholder="https://yourdomain.com/webhook"
                                        value={webhookUrl}
                                        onChange={(e) => setWebhookUrl(e.target.value)}
                                        className="border-border/50 bg-background"
                                    />
                                </div>

                                <Button className="w-full" onClick={updateWebhook}>Save Webhook</Button>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </WebLayout>
    );
};

export default WebMerchantDashboard;
