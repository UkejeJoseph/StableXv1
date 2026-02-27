import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Wallet,
    ArrowDownToLine,
    ArrowUpFromLine,
    ExternalLink,
    ShieldCheck,
    Lock,
    Globe
} from "lucide-react";
import { Link } from "react-router-dom";

interface WebAssetListProps {
    wallets: any[];
    isLoading: boolean;
}

export function WebAssetList({ wallets, isLoading }: WebAssetListProps) {
    const custodialWallets = wallets.filter(w => w.walletType !== 'external');
    const externalWallets = wallets.filter(w => w.walletType === 'external');

    const renderAssetRow = (w: any) => {
        const isCustodial = w.walletType !== 'external';
        const isNGN = w.currency === "NGN";

        return (
            <div key={w._id} className="flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 rounded-xl border border-border/30 transition-all group">
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isNGN ? "bg-green-100 text-green-600" : "bg-primary/10 text-primary"
                        }`}>
                        {isNGN ? "₦" : w.currency.slice(0, 1)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm tracking-tight">{w.currency}</span>
                            {isCustodial ? (
                                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-primary/20 text-primary rounded-md flex items-center gap-1">
                                    <ShieldCheck className="w-2.5 h-2.5" /> StableX
                                </span>
                            ) : (
                                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-muted text-muted-foreground rounded-md flex items-center gap-1">
                                    <Globe className="w-2.5 h-2.5" /> Web3
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">
                            {w.address || "Internal Wallet"}
                        </p>
                    </div>
                </div>

                <div className="text-right">
                    <p className="font-bold text-sm">{w.balance?.toLocaleString() || "0.00"}</p>
                    <div className="flex items-center gap-2 mt-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button asChild size="icon" variant="ghost" className="h-7 w-7 rounded-full bg-primary/10 hover:bg-primary/20 text-primary">
                            <Link to={`/web/deposit?wallet=${w.currency}`}>
                                <ArrowDownToLine className="w-3.5 h-3.5" />
                            </Link>
                        </Button>
                        <Button asChild size="icon" variant="ghost" className="h-7 w-7 rounded-full bg-muted hover:bg-muted-foreground/10 text-muted-foreground">
                            <Link to={`/web/withdraw?wallet=${w.currency}`}>
                                <ArrowUpFromLine className="w-3.5 h-3.5" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Lock className="w-3 h-3 text-primary" />
                        StableX Custodial Wallets
                    </h3>
                    <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold">Secured by StableX</span>
                </div>

                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted/20 animate-pulse rounded-xl" />)}
                    </div>
                ) : custodialWallets.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {custodialWallets.map(renderAssetRow)}
                    </div>
                ) : (
                    <Card className="p-8 border-dashed border-border/50 text-center bg-transparent">
                        <p className="text-sm text-muted-foreground italic">No custodial wallets found.</p>
                    </Card>
                )}
            </section>

            {externalWallets.length > 0 && (
                <section>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                        <Globe className="w-3 h-3 text-blue-400" />
                        Connected Web3 Assets
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {externalWallets.map(renderAssetRow)}
                    </div>
                </section>
            )}

            <Card className="p-4 bg-gradient-to-br from-primary/5 to-blue-500/5 border-primary/20 flex flex-col items-center text-center">
                <ShieldCheck className="w-8 h-8 text-primary mb-2" />
                <h4 className="text-sm font-bold mb-1 underline decoration-primary/30">StableX Custodial Advantage</h4>
                <p className="text-[10px] text-muted-foreground max-w-sm">
                    Keep your assets in StableX managed wallets for zero-fee internal transfers,
                    automated staking rewards, and instant fiat conversion.
                </p>
            </Card>
        </div>
    );
}
