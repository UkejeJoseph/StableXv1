import { useState, useEffect } from "react";
import { WebLayout } from "@/components/WebSidebar";
import { Webhook, CheckCircle2, AlertCircle, RefreshCw, Loader2, SkipForward } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/contexts/UserContext";

interface WebhookLog {
    id: string;
    event: string;
    status: "success" | "failed" | "skipped";
    statusCode: number;
    timestamp: string;
    payload: string;
}

export default function WebMerchantWebhooks() {
    const { user } = useUser();
    const { toast } = useToast();
    const [webhookUrl, setWebhookUrl] = useState("");
    const [savedUrl, setSavedUrl] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [logs, setLogs] = useState<WebhookLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchWebhookData();
        }
    }, [user]);

    const fetchWebhookData = async () => {
        if (!user) return;
        try {
            // Fetch webhook URL and logs in parallel
            const [urlRes, logsRes] = await Promise.all([
                fetch("/api/merchant/webhook", { credentials: "include" }),
                fetch("/api/merchant/webhook-logs", { credentials: "include" }),
            ]);

            const urlData = await urlRes.json();
            const logsData = await logsRes.json();

            if (urlData.success) {
                setWebhookUrl(urlData.webhookUrl || "");
                setSavedUrl(urlData.webhookUrl || "");
            }
            if (logsData.success) {
                setLogs(logsData.data);
            }
        } catch (err) {
            console.error("Failed to fetch webhook data:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!webhookUrl) {
            toast({ title: "URL Required", description: "Please enter a valid webhook URL.", variant: "destructive" });
            return;
        }

        if (!webhookUrl.startsWith("http://") && !webhookUrl.startsWith("https://")) {
            toast({ title: "Invalid URL", description: "Webhook URL must start with http:// or https://", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch("/api/developer/webhook", {
                method: "PUT",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ webhookUrl }),
            });

            if (res.ok) {
                setSavedUrl(webhookUrl);
                toast({ title: "Webhook URL saved", description: "Your webhook endpoint has been updated." });
            } else {
                toast({ title: "Save failed", description: "Could not update webhook URL.", variant: "destructive" });
            }
        } catch {
            toast({ title: "Network error", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <WebLayout>
            <div className="space-y-6 max-w-4xl">

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Webhook className="w-8 h-8 text-[#F0B90B]" />
                        Webhooks
                    </h1>
                    <p className="text-muted-foreground">
                        Receive real-time notifications for payment events via HTTP POST requests.
                    </p>
                </div>

                {/* Webhook URL Configuration */}
                <Card className="bg-card/50 border-border/30 p-6 space-y-4">
                    <h2 className="text-lg font-semibold">Webhook Endpoint</h2>
                    <div className="flex gap-3">
                        <Input
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            placeholder="https://yourapp.com/api/webhooks/stablex"
                            className="flex-1 bg-background/50 border-border/30"
                        />
                        <Button
                            onClick={handleSave}
                            disabled={isSaving || webhookUrl === savedUrl}
                            className="bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-black font-semibold"
                        >
                            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save"}
                        </Button>
                    </div>
                    {savedUrl && (
                        <div className="flex items-center gap-2 text-sm text-green-500">
                            <CheckCircle2 className="w-4 h-4" />
                            Active: {savedUrl}
                        </div>
                    )}
                </Card>

                {/* Event Types */}
                <Card className="bg-card/50 border-border/30 p-6 space-y-4">
                    <h2 className="text-lg font-semibold">Supported Events</h2>
                    <div className="grid md:grid-cols-2 gap-3">
                        {[
                            { event: "payment.success", desc: "Customer payment completed" },
                            { event: "payment.pending", desc: "Payment received, awaiting confirmations" },
                            { event: "payment.failed", desc: "Payment attempt failed" },
                            { event: "payout.completed", desc: "Merchant payout processed" },
                        ].map(e => (
                            <div key={e.event} className="flex items-center gap-3 p-3 bg-background/30 rounded-lg border border-border/10">
                                <code className="text-xs text-[#F0B90B] bg-[#F0B90B]/10 px-2 py-1 rounded font-mono">{e.event}</code>
                                <span className="text-xs text-muted-foreground">{e.desc}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Recent Deliveries */}
                <Card className="bg-card/50 border-border/30 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Recent Deliveries</h2>
                        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={fetchWebhookData}>
                            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {loading ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground">
                                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading delivery logs...
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                No webhook deliveries yet. Set a webhook URL and make a transaction.
                            </div>
                        ) : (
                            logs.map(log => (
                                <div key={log.id} className="flex items-center justify-between p-3 bg-background/30 rounded-lg border border-border/10 hover:border-border/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        {log.status === "success" ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                        ) : log.status === "skipped" ? (
                                            <SkipForward className="w-4 h-4 text-muted-foreground" />
                                        ) : (
                                            <AlertCircle className="w-4 h-4 text-red-400" />
                                        )}
                                        <div>
                                            <code className="text-xs font-mono text-foreground">{log.event}</code>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {new Date(log.timestamp).toLocaleString()} · {log.statusCode ? `HTTP ${log.statusCode}` : 'No webhook URL'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`text-xs px-2 py-0.5 rounded ${log.status === "success" ? "bg-green-500/20 text-green-500" : log.status === "skipped" ? "bg-gray-500/20 text-gray-400" : "bg-red-500/20 text-red-400"}`}>
                                        {log.status}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

            </div>
        </WebLayout>
    );
}
