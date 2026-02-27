import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, Hexagon, ShieldCheck, CheckCircle2, ChevronRight } from "lucide-react";

interface WalletProvider {
    id: string;
    name: string;
    icon: any;
    description: string;
    detector: () => boolean;
    color: string;
    bg: string;
}

const EVM_PROVIDERS: WalletProvider[] = [
    {
        id: "metamask",
        name: "MetaMask",
        icon: Hexagon,
        description: "Browser extension",
        detector: () => typeof window !== 'undefined' && !!(window.ethereum?.isMetaMask),
        color: "text-orange-500",
        bg: "bg-orange-100 dark:bg-orange-900/20"
    },
    {
        id: "trust",
        name: "Trust Wallet",
        icon: ShieldCheck,
        description: "Mobile & Extension",
        detector: () => typeof window !== 'undefined' && !!(window.ethereum?.isTrust || window.trustwallet),
        color: "text-blue-600",
        bg: "bg-blue-100 dark:bg-blue-900/20"
    }
];

const SOLANA_PROVIDERS: WalletProvider[] = [
    {
        id: "phantom",
        name: "Phantom",
        icon: Wallet,
        description: "Solana Extension",
        detector: () => typeof window !== 'undefined' && !!(window.solana?.isPhantom),
        color: "text-purple-500",
        bg: "bg-purple-100 dark:bg-purple-900/20"
    },
    {
        id: "solflare",
        name: "Solflare",
        icon: Wallet,
        description: "Solana Extension",
        detector: () => typeof window !== 'undefined' && !!(window.solflare?.isSolflare),
        color: "text-orange-600",
        bg: "bg-orange-100 dark:bg-orange-900/20"
    }
];

interface MultiChainWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: (providerId: string, address: string, network: string) => void;
}

export function MultiChainWalletModal({ isOpen, onClose, onConnect }: MultiChainWalletModalProps) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [detectedProviders, setDetectedProviders] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            const detected = [...EVM_PROVIDERS, ...SOLANA_PROVIDERS]
                .filter(p => p.detector())
                .map(p => p.id);
            setDetectedProviders(detected);
        }
    }, [isOpen]);

    const handleConnectEVM = async (provider: WalletProvider) => {
        setIsConnecting(true);
        try {
            if (typeof window.ethereum === "undefined") {
                alert(`${provider.name} is not installed.`);
                return;
            }
            const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
            if (accounts && accounts.length > 0) {
                onConnect(provider.id, accounts[0], "ETH");
                onClose();
            }
        } catch (error) {
            console.error(`Error connecting to ${provider.name}:`, error);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleConnectSolana = async (provider: WalletProvider) => {
        setIsConnecting(true);
        try {
            const solana = (window as any).solana;
            if (!solana) {
                alert(`${provider.name} is not installed.`);
                return;
            }
            const resp = await solana.connect();
            onConnect(provider.id, resp.publicKey.toString(), "SOL");
            onClose();
        } catch (error) {
            console.error(`Error connecting to ${provider.name}:`, error);
        } finally {
            setIsConnecting(false);
        }
    };

    const renderProviderButton = (provider: WalletProvider, type: 'EVM' | 'SOL') => {
        const isDetected = detectedProviders.includes(provider.id);
        const Icon = provider.icon;

        return (
            <Button
                key={provider.id}
                variant="outline"
                className="w-full justify-start gap-4 h-16 bg-muted/30 hover:bg-muted/50 border-border/50 group transition-all"
                onClick={() => type === 'EVM' ? handleConnectEVM(provider) : handleConnectSolana(provider)}
                disabled={isConnecting}
            >
                <div className={`w-10 h-10 rounded-full ${provider.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <Icon className={`w-6 h-6 ${provider.color}`} />
                </div>
                <div className="text-left flex-1">
                    <p className="font-bold text-sm">{provider.name}</p>
                    <p className="text-[10px] text-muted-foreground">{provider.description}</p>
                </div>
                {isDetected ? (
                    <div className="flex items-center gap-1 text-[10px] font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Detected
                    </div>
                ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                )}
            </Button>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-[#0b0e11] text-white border-border/20 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                        Connect Wallet
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Connect your self-custody wallet to interact with StableX
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-6">
                    <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                            <span className="w-1 h-3 bg-primary rounded-full" />
                            Ethereum & EVM Chains
                        </h4>
                        <div className="space-y-2">
                            {EVM_PROVIDERS.map(p => renderProviderButton(p, 'EVM'))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                            <span className="w-1 h-3 bg-purple-500 rounded-full" />
                            Solana Network
                        </h4>
                        <div className="space-y-2">
                            {SOLANA_PROVIDERS.map(p => renderProviderButton(p, 'SOL'))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border/10">
                        <Button
                            variant="ghost"
                            className="w-full text-xs text-muted-foreground hover:text-white"
                            onClick={() => {/* WalletConnect logic */ }}
                        >
                            <Wallet className="w-4 h-4 mr-2" />
                            Other Wallets (WalletConnect)
                        </Button>
                    </div>
                </div>

                {isConnecting && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-lg z-50">
                        <div className="text-center space-y-4">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-sm font-medium animate-pulse">Confirm in your wallet...</p>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
