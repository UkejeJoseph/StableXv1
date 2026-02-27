import { WebLayout } from "@/components/WebSidebar";
import { BookOpen, Shield, CreditCard, Globe, Webhook, ArrowDownLeft, ArrowUpRight, Landmark, Users, AlertCircle, CheckCircle2, Code } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function WebMerchantGuidelines() {
    return (
        <WebLayout>
            <div className="space-y-8 max-w-4xl">

                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <BookOpen className="w-8 h-8 text-[#F0B90B]" />
                        Merchant Guidelines
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        Everything you need to know about your StableX Merchant account.
                    </p>
                </div>

                {/* KYC Requirements */}
                <Card className="bg-card/50 border-border/30 p-6 space-y-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Shield className="w-5 h-5 text-green-500" /> KYC Verification Levels
                    </h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="bg-background/50 rounded-xl p-4 border border-border/20">
                            <p className="text-sm font-semibold text-yellow-400 mb-2">Level 1 — Basic</p>
                            <ul className="text-xs text-muted-foreground space-y-1.5">
                                <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 shrink-0" /> Email verification</li>
                                <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 shrink-0" /> Phone number</li>
                                <li className="flex items-start gap-1.5"><AlertCircle className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" /> ₦50,000 daily limit</li>
                            </ul>
                        </div>
                        <div className="bg-background/50 rounded-xl p-4 border border-border/20">
                            <p className="text-sm font-semibold text-blue-400 mb-2">Level 2 — Verified</p>
                            <ul className="text-xs text-muted-foreground space-y-1.5">
                                <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 shrink-0" /> Government ID</li>
                                <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 shrink-0" /> BVN verification</li>
                                <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 shrink-0" /> ₦5,000,000 daily limit</li>
                            </ul>
                        </div>
                        <div className="bg-background/50 rounded-xl p-4 border border-[#F0B90B]/30">
                            <p className="text-sm font-semibold text-[#F0B90B] mb-2">Level 3 — Merchant</p>
                            <ul className="text-xs text-muted-foreground space-y-1.5">
                                <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 shrink-0" /> Business registration (CAC)</li>
                                <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 shrink-0" /> API keys & webhooks</li>
                                <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 shrink-0" /> Unlimited transactions</li>
                            </ul>
                        </div>
                    </div>
                </Card>

                {/* Features */}
                <Card className="bg-card/50 border-border/30 p-6 space-y-4">
                    <h2 className="text-xl font-semibold">Merchant Features</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        {[
                            { icon: CreditCard, title: "Accept Payments", desc: "Accept NGN, USDT, BTC, ETH, and SOL payments from customers via checkout links or API." },
                            { icon: Globe, title: "Merchant API", desc: "Generate API keys (public/secret) to integrate StableX payments into your app or website." },
                            { icon: ArrowDownLeft, title: "Pay-ins", desc: "View all incoming customer payments with status, amount, currency, and timestamps." },
                            { icon: ArrowUpRight, title: "Payouts", desc: "Withdraw settled funds to your bank account or external crypto wallet." },
                            { icon: Landmark, title: "Settlements", desc: "Track daily/weekly settlement batches — funds auto-settle to your linked bank account." },
                            { icon: Webhook, title: "Webhooks", desc: "Set a webhook URL to receive real-time payment notifications (success, failed, pending)." },
                        ].map(({ icon: Icon, title, desc }) => (
                            <div key={title} className="flex gap-3 p-3 rounded-lg bg-background/30 border border-border/10">
                                <Icon className="w-5 h-5 text-[#F0B90B] shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium">{title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* API Integration */}
                <Card className="bg-card/50 border-border/30 p-6 space-y-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Code className="w-5 h-5 text-blue-400" /> Quick API Integration
                    </h2>
                    <div className="bg-[#0d1117] rounded-xl p-4 text-sm font-mono overflow-x-auto">
                        <p className="text-green-400">// Initialize a checkout session</p>
                        <p className="text-slate-300">POST /api/v1/checkout/initialize</p>
                        <p className="text-slate-500 mt-2">Headers:</p>
                        <p className="text-yellow-300">  Authorization: Bearer sk_test_your_secret_key</p>
                        <p className="text-slate-500 mt-2">Body:</p>
                        <pre className="text-blue-300">{`  {
    "amount": 5000,
    "currency": "NGN",
    "customer_email": "buyer@email.com",
    "description": "Order #1234"
  }`}</pre>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        After a successful payment, StableX will send a POST request to your webhook URL with the transaction details.
                    </p>
                </Card>

                {/* Supported Currencies */}
                <Card className="bg-card/50 border-border/30 p-6 space-y-4">
                    <h2 className="text-xl font-semibold">Supported Currencies</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                            { name: "NGN", label: "Nigerian Naira", color: "text-green-500" },
                            { name: "USDT", label: "Tether (TRC20/ERC20)", color: "text-emerald-400" },
                            { name: "BTC", label: "Bitcoin", color: "text-orange-400" },
                            { name: "ETH", label: "Ethereum", color: "text-blue-400" },
                            { name: "SOL", label: "Solana", color: "text-purple-400" },
                            { name: "TRX", label: "TRON", color: "text-red-400" },
                        ].map(c => (
                            <div key={c.name} className="flex items-center gap-3 px-4 py-3 bg-background/30 rounded-lg border border-border/10">
                                <span className={`text-lg font-bold ${c.color}`}>{c.name}</span>
                                <span className="text-xs text-muted-foreground">{c.label}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Fees */}
                <Card className="bg-card/50 border-border/30 p-6 space-y-4">
                    <h2 className="text-xl font-semibold">Fee Schedule</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b border-border/20">
                                    <th className="pb-3 text-muted-foreground font-medium">Transaction Type</th>
                                    <th className="pb-3 text-muted-foreground font-medium">Fee</th>
                                    <th className="pb-3 text-muted-foreground font-medium">Settlement</th>
                                </tr>
                            </thead>
                            <tbody className="text-muted-foreground">
                                <tr className="border-b border-border/10">
                                    <td className="py-3">NGN Card Deposit</td>
                                    <td className="py-3 text-white">1.5%</td>
                                    <td className="py-3">Instant</td>
                                </tr>
                                <tr className="border-b border-border/10">
                                    <td className="py-3">NGN Bank Transfer</td>
                                    <td className="py-3 text-white">₦50 flat</td>
                                    <td className="py-3">Instant</td>
                                </tr>
                                <tr className="border-b border-border/10">
                                    <td className="py-3">USDT (TRC20) Deposit</td>
                                    <td className="py-3 text-green-500">Free</td>
                                    <td className="py-3">20 confirmations</td>
                                </tr>
                                <tr className="border-b border-border/10">
                                    <td className="py-3">USDT (TRC20) Withdrawal</td>
                                    <td className="py-3 text-white">1.5 USDT</td>
                                    <td className="py-3">~1 min</td>
                                </tr>
                                <tr className="border-b border-border/10">
                                    <td className="py-3">Internal Transfer</td>
                                    <td className="py-3 text-green-500">Free</td>
                                    <td className="py-3">Instant</td>
                                </tr>
                                <tr>
                                    <td className="py-3">Conversion / Swap</td>
                                    <td className="py-3 text-white">0.1%</td>
                                    <td className="py-3">Instant</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </Card>

            </div>
        </WebLayout>
    );
}
