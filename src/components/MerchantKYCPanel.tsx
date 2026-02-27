import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";

export function MerchantKYCPanel() {
    return (
        <Card className="p-4 md:p-6 bg-gradient-to-r from-[#12161a] to-[#1e2329] border-border/40 w-full mb-6 relative overflow-hidden group">
            {/* Background design elements */}
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <ShieldCheck className="w-32 h-32" />
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                        <ShieldCheck className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-white font-bold text-lg">Identity Verification Complete</h3>
                            <span className="bg-green-500/20 text-green-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-green-500/20">KYC Level 2</span>
                        </div>
                        <p className="text-muted-foreground text-sm mt-1">Your business is fully verified. You can process unlimited global transaction volumes.</p>
                    </div>
                </div>

                <div className="flex items-center gap-6 bg-black/40 px-5 py-3 rounded-xl border border-border/30 w-full md:w-auto">
                    <div className="space-y-1 w-full md:w-auto">
                        <div className="flex justify-between items-center text-xs gap-8">
                            <span className="text-muted-foreground">Daily Limit</span>
                            <span className="text-white font-bold tracking-wide">Unlimited</span>
                        </div>
                        <div className="flex justify-between items-center text-xs gap-8">
                            <span className="text-muted-foreground">Withdrawal Limit</span>
                            <span className="text-white font-bold tracking-wide">100,000,000 NGN</span>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
