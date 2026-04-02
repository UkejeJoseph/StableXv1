import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/WebSidebar";
import { ArrowLeft, Copy, Check, AlertTriangle, Plus, Download, Loader2, Wallet } from "lucide-react";
import { SiBitcoin, SiEthereum, SiSolana, SiTether, SiRipple } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/contexts/UserContext";
import {
    saveWalletReference,
    getNetworkDisplayName,
    type WalletData,
    type NetworkType,
} from "@/lib/wallet";
import { ConnectWeb3Wallet } from "@/components/ConnectWeb3Wallet";
import { apiFetch } from "@/lib/api";

type IconComponent = typeof SiBitcoin;

const USDCIcon = () => (
    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">$</div>
);
const DAIIcon = () => (
    <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">D</div>
);

interface NetworkOption {
    network: NetworkType;
    name: string;
    description: string;
    icon: IconComponent | (() => JSX.Element);
    iconColor: string;
    bgColor: string;
}

const networkOptions: NetworkOption[] = [
    { network: "BTC", name: "Bitcoin", description: "The original cryptocurrency", icon: SiBitcoin, iconColor: "text-orange-500", bgColor: "bg-orange-500/10" },
    { network: "ETH", name: "Ethereum", description: "Smart contract platform", icon: SiEthereum, iconColor: "text-blue-400", bgColor: "bg-blue-500/10" },
    { network: "SOL", name: "Solana", description: "Fast, low-cost transactions", icon: SiSolana, iconColor: "text-purple-500", bgColor: "bg-purple-500/10" },
    { network: "XRP", name: "XRP (Ripple)", description: "Fast cross-border payments", icon: SiRipple, iconColor: "text-blue-400", bgColor: "bg-blue-400/10" },
    { network: "USDT_ERC20", name: "USDT (ERC20)", description: "Tether on Ethereum", icon: SiTether, iconColor: "text-green-500", bgColor: "bg-green-500/10" },
    { network: "USDT_TRC20", name: "USDT (TRC20)", description: "Tether on Tron — Lower fees", icon: SiTether, iconColor: "text-red-500", bgColor: "bg-red-500/10" },
    { network: "USDC_ERC20", name: "USDC (ERC20)", description: "USD Coin on Ethereum", icon: USDCIcon, iconColor: "", bgColor: "bg-blue-500/10" },
    { network: "WBTC", name: "Wrapped BTC (ERC20)", description: "Bitcoin on Ethereum", icon: SiBitcoin, iconColor: "text-yellow-500", bgColor: "bg-yellow-500/10" },
    { network: "DAI", name: "DAI (ERC20)", description: "Decentralized stablecoin", icon: DAIIcon, iconColor: "", bgColor: "bg-amber-500/10" },
];

export default function WebCreateWallet() {
    const { user } = useUser();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [step, setStep] = useState<"choose" | "create" | "import">("choose");
    const [network, setNetwork] = useState<NetworkType>("ETH");
    const [walletData, setWalletData] = useState<WalletData | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importMethod, setImportMethod] = useState<"mnemonic" | "privateKey">("mnemonic");
    const [importValue, setImportValue] = useState("");

    const handleCreateWallet = async (selectedNetwork: NetworkType) => {
        if (!user) {
            toast({ title: "Auth Required", description: "Log in to create a wallet", variant: "destructive" });
            return;
        }
        setNetwork(selectedNetwork);
        setIsProcessing(true);
        try {
            const response = await apiFetch("/api/wallets/generate", {
                method: "POST",
                body: JSON.stringify({ network: selectedNetwork }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Failed to generate wallet");

            setWalletData({
                address: data.address,
                network: data.network,
                privateKey: "",
                mnemonic: "",
            });
            setStep("create");
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to create wallet.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCopy = async (text: string, field: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
        toast({ title: "Copied!", description: `${field} copied to clipboard` });
    };

    const handleSaveWallet = () => {
        if (walletData) {
            saveWalletReference(walletData);
            toast({ title: "Wallet Created!", description: "Your deposit address is ready." });
            navigate("/web/wallet");
        }
    };

    const handleImportWallet = async () => {
        if (!user) return;
        setIsProcessing(true);
        try {
            const response = await apiFetch("/api/wallets/import", {
                method: "POST",
                body: JSON.stringify({ network, importMethod, importValue: importValue.trim() }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Failed to import wallet");

            saveWalletReference({ address: data.address, network: data.network, privateKey: "", mnemonic: "" });
            setImportValue("");
            toast({ title: "Wallet Imported!", description: "Your wallet has been securely imported." });
            navigate("/web/wallet");
        } catch (error: any) {
            setImportValue("");
            toast({ title: "Import Failed", description: error.message || "Invalid mnemonic or private key.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    // ─── Import Step ───
    if (step === "import") {
        return (
            <WebLayout>
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setStep("choose")} className="text-muted-foreground hover:text-white">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Import Wallet</h1>
                            <p className="text-sm text-muted-foreground">Enter your recovery phrase or private key</p>
                        </div>
                    </div>

                    <Card className="p-6 bg-[#1e2329] border-border/20">
                        <label className="text-sm font-medium text-muted-foreground mb-3 block">Select Blockchain</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                            {networkOptions.map((option) => {
                                const IconComp = option.icon;
                                return (
                                    <Button
                                        key={option.network}
                                        variant={network === option.network ? "default" : "outline"}
                                        className={`justify-start gap-2 h-10 text-xs ${network === option.network ? "bg-[#F0B90B] text-black hover:bg-[#F0B90B]/90" : "border-border/30 text-muted-foreground hover:text-white"}`}
                                        onClick={() => setNetwork(option.network)}
                                    >
                                        {option.iconColor ? <IconComp className={`w-4 h-4 ${network === option.network ? "" : option.iconColor}`} /> : <IconComp />}
                                        {option.name}
                                    </Button>
                                );
                            })}
                        </div>

                        <Tabs value={importMethod} onValueChange={(v) => setImportMethod(v as "mnemonic" | "privateKey")}>
                            <TabsList className="w-full bg-[#12161a]">
                                <TabsTrigger value="mnemonic" className="flex-1 data-[state=active]:bg-[#F0B90B] data-[state=active]:text-black">Mnemonic</TabsTrigger>
                                <TabsTrigger value="privateKey" className="flex-1 data-[state=active]:bg-[#F0B90B] data-[state=active]:text-black">Private Key</TabsTrigger>
                            </TabsList>
                            <TabsContent value="mnemonic" className="mt-4">
                                <textarea
                                    placeholder="Enter your 12 or 24 word recovery phrase"
                                    value={importValue}
                                    onChange={(e) => setImportValue(e.target.value)}
                                    className="w-full min-h-[100px] p-3 rounded-lg bg-[#12161a] border border-border/30 text-sm text-white placeholder:text-muted-foreground focus:ring-1 focus:ring-[#F0B90B] outline-none resize-none"
                                />
                            </TabsContent>
                            <TabsContent value="privateKey" className="mt-4">
                                <Input
                                    placeholder="Enter your private key"
                                    value={importValue}
                                    onChange={(e) => setImportValue(e.target.value)}
                                    type="password"
                                    className="bg-[#12161a] border-border/30"
                                />
                            </TabsContent>
                        </Tabs>

                        <Button
                            className="w-full mt-6 bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-black font-bold"
                            onClick={handleImportWallet}
                            disabled={!importValue.trim() || isProcessing}
                        >
                            {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Importing...</> : <><Download className="w-4 h-4 mr-2" /> Import Wallet</>}
                        </Button>
                    </Card>
                </div>
            </WebLayout>
        );
    }

    // ─── Created Step ───
    if (step === "create" && walletData) {
        return (
            <WebLayout>
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setStep("choose")} className="text-muted-foreground hover:text-white">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-white">{getNetworkDisplayName(network)} Wallet Created</h1>
                            <p className="text-sm text-muted-foreground">Your new deposit address is ready</p>
                        </div>
                    </div>

                    <Card className="p-6 bg-amber-500/5 border-amber-500/20">
                        <div className="flex gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-amber-400">Important!</p>
                                <p className="text-sm text-amber-400/80">
                                    Your private key is stored securely on the server. Only deposit funds to the address below.
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-[#1e2329] border-border/20">
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">Deposit Address</label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-[#12161a] p-3 rounded-lg text-sm break-all text-[#F0B90B] font-mono border border-border/20">
                                {walletData.address}
                            </code>
                            <Button
                                variant="outline"
                                size="icon"
                                className="border-border/30 hover:border-[#F0B90B] hover:text-[#F0B90B]"
                                onClick={() => handleCopy(walletData.address || "", "Address")}
                            >
                                {copiedField === "Address" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </Button>
                        </div>
                    </Card>

                    <Button className="w-full bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-black font-bold" onClick={handleSaveWallet}>
                        Done — Go to Wallet
                    </Button>
                </div>
            </WebLayout>
        );
    }

    // ─── Choose Step (Default) ───
    return (
        <WebLayout>
            <div className="max-w-3xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#F0B90B]/10 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-[#F0B90B]" />
                        </div>
                        Create Wallet
                    </h1>
                    <p className="text-muted-foreground mt-2">Generate a new custodial wallet or connect an external one</p>
                </div>

                {isProcessing && (
                    <Card className="p-6 bg-[#1e2329] border-border/20 flex items-center justify-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-[#F0B90B]" />
                        <span className="text-sm text-muted-foreground">Generating wallet...</span>
                    </Card>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {networkOptions.map((option) => {
                        const IconComp = option.icon;
                        return (
                            <Card
                                key={option.network}
                                className="p-4 cursor-pointer border-2 border-transparent hover:border-[#F0B90B]/50 bg-[#1e2329] transition-all group"
                                onClick={() => !isProcessing && handleCreateWallet(option.network)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl ${option.bgColor} flex items-center justify-center transition-transform group-hover:scale-110`}>
                                        {option.iconColor ? (
                                            <IconComp className={`w-5 h-5 ${option.iconColor}`} />
                                        ) : (
                                            <IconComp />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm text-white">{option.name}</p>
                                        <p className="text-xs text-muted-foreground">{option.description}</p>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                <div className="border-t border-border/20 pt-6 space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground">Other Options</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Card className="p-4 bg-[#1e2329] border-border/20">
                            <h4 className="text-sm font-semibold text-white mb-2">Connect External Wallet</h4>
                            <ConnectWeb3Wallet />
                        </Card>
                        <Card
                            className="p-4 bg-[#1e2329] border-border/20 cursor-pointer hover:border-[#F0B90B]/30 transition-colors"
                            onClick={() => setStep("import")}
                        >
                            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                                <Download className="w-4 h-4 text-[#F0B90B]" />
                                Import Existing Wallet
                            </h4>
                            <p className="text-xs text-muted-foreground">Import using mnemonic or private key</p>
                        </Card>
                    </div>
                </div>
            </div>
        </WebLayout>
    );
}
