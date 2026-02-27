import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { SiBitcoin, SiEthereum, SiSolana, SiTether, SiRipple } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  saveWalletReference,
  getNetworkDisplayName,
  type WalletData,
  type NetworkType,
} from "@/lib/wallet";
import { ConnectWeb3Wallet } from "@/components/ConnectWeb3Wallet";

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
  {
    network: "BTC",
    name: "Bitcoin",
    description: "The original cryptocurrency",
    icon: SiBitcoin,
    iconColor: "text-orange-500",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  {
    network: "ETH",
    name: "Ethereum",
    description: "Smart contract platform",
    icon: SiEthereum,
    iconColor: "text-slate-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    network: "SOL",
    name: "Solana",
    description: "Fast, low-cost transactions",
    icon: SiSolana,
    iconColor: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    network: "XRP",
    name: "XRP (Ripple)",
    description: "Fast cross-border payments",
    icon: SiRipple,
    iconColor: "text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    network: "USDT_ERC20",
    name: "USDT (ERC20)",
    description: "Tether on Ethereum network",
    icon: SiTether,
    iconColor: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  {
    network: "USDT_TRC20",
    name: "USDT (TRC20)",
    description: "Tether on Tron - Lower fees",
    icon: SiTether,
    iconColor: "text-red-500",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  {
    network: "USDC_ERC20",
    name: "USDC (ERC20)",
    description: "USD Coin on Ethereum",
    icon: USDCIcon,
    iconColor: "",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    network: "WBTC",
    name: "Wrapped BTC (ERC20)",
    description: "Bitcoin on Ethereum network",
    icon: SiBitcoin,
    iconColor: "text-yellow-600",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  {
    network: "DAI",
    name: "DAI (ERC20)",
    description: "Decentralized stablecoin",
    icon: DAIIcon,
    iconColor: "",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
];

export default function CreateWallet() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<"choose" | "create" | "import">("choose");
  const [network, setNetwork] = useState<NetworkType>("ETH");
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importMethod, setImportMethod] = useState<"mnemonic" | "privateKey">("mnemonic");
  const [importValue, setImportValue] = useState("");

  const handleCreateWallet = async (selectedNetwork: NetworkType) => {
    setNetwork(selectedNetwork);
    setIsProcessing(true);
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
      if (!userInfo.token) throw new Error("Not authenticated");

      const response = await fetch("/api/wallets/generate", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({ network: selectedNetwork }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to generate wallet");
      }

      setWalletData({
        address: data.address,
        network: data.network,
        privateKey: "", // No longer sent to client
        mnemonic: "",   // No longer sent to client
      });
      setStep("create");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create wallet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast({
      title: "Copied!",
      description: `${field} copied to clipboard`,
    });
  };

  const handleSaveWallet = () => {
    if (walletData) {
      saveWalletReference(walletData);
      toast({
        title: "Wallet Created!",
        description: "Your deposit address is ready.",
      });
      navigate("/wallet");
    }
  };

  const handleImportWallet = async () => {
    setIsProcessing(true);
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
      if (!userInfo.token) throw new Error("Not authenticated");

      const response = await fetch("/api/wallets/import", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({
          network,
          importMethod,
          importValue: importValue.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to import wallet");
      }

      setWalletData({
        address: data.address,
        network: data.network,
        privateKey: "",
        mnemonic: "",
      });

      saveWalletReference({
        address: data.address,
        network: data.network,
        privateKey: "",
        mnemonic: "",
      });

      toast({
        title: "Wallet Imported!",
        description: "Your wallet has been securely imported to the exchange.",
      });
      navigate("/wallet");
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Invalid mnemonic or private key. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === "choose") {
    return (
      <div className="flex flex-col min-h-screen pb-20 bg-background">
        <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Create Wallet</h1>
        </div>

        <div className="px-4 py-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-2">Choose Blockchain</h2>
            <p className="text-sm text-muted-foreground">
              Select the blockchain for your new wallet
            </p>
          </div>

          <div className="space-y-3">
            {networkOptions.map((option) => {
              const IconComp = option.icon;
              return (
                <Card
                  key={option.network}
                  className="p-4 cursor-pointer border-2 border-transparent hover:border-primary transition-colors"
                  onClick={() => handleCreateWallet(option.network)}
                  data-testid={`button-create-${option.network.toLowerCase()}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full ${option.bgColor} flex items-center justify-center`}>
                      {option.iconColor ? (
                        <IconComp className={`w-6 h-6 ${option.iconColor}`} />
                      ) : (
                        <IconComp />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{option.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="border-t border-border pt-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-3">Connect External Wallet</h3>
              <ConnectWeb3Wallet />
            </div>

            <Button
              variant="outline"
              className="w-full text-muted-foreground mt-4"
              disabled
            >
              Importing Keys Disabled (Custodial Platform)
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "import") {
    return (
      <div className="flex flex-col min-h-screen pb-20 bg-background">
        <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setStep("choose")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Import Wallet</h1>
        </div>

        <div className="px-4 py-6 space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Blockchain</label>
            <div className="grid grid-cols-2 gap-2">
              {networkOptions.map((option) => {
                const IconComp = option.icon;
                return (
                  <Button
                    key={option.network}
                    variant={network === option.network ? "default" : "outline"}
                    className="justify-start gap-2"
                    onClick={() => setNetwork(option.network)}
                    data-testid={`import-select-${option.network.toLowerCase()}`}
                  >
                    {option.iconColor ? (
                      <IconComp className={`w-4 h-4 ${network === option.network ? "" : option.iconColor}`} />
                    ) : (
                      <IconComp />
                    )}
                    <span className="text-xs">{option.name}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <Tabs value={importMethod} onValueChange={(v) => setImportMethod(v as "mnemonic" | "privateKey")}>
            <TabsList className="w-full">
              <TabsTrigger value="mnemonic" className="flex-1" data-testid="tab-mnemonic">Mnemonic</TabsTrigger>
              <TabsTrigger value="privateKey" className="flex-1" data-testid="tab-private-key">Private Key</TabsTrigger>
            </TabsList>
            <TabsContent value="mnemonic" className="mt-4">
              <Input
                placeholder="Enter your 12 or 24 word recovery phrase"
                value={importValue}
                onChange={(e) => setImportValue(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-mnemonic"
              />
            </TabsContent>
            <TabsContent value="privateKey" className="mt-4">
              <Input
                placeholder="Enter your private key"
                value={importValue}
                onChange={(e) => setImportValue(e.target.value)}
                type="password"
                data-testid="input-private-key"
              />
            </TabsContent>
          </Tabs>

          <Button
            className="w-full bg-navy"
            onClick={handleImportWallet}
            disabled={!importValue.trim()}
            data-testid="button-confirm-import"
          >
            Import Wallet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-background">
      <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => setStep("choose")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">{getNetworkDisplayName(network)} Wallet Created</h1>
      </div>

      <div className="px-4 py-6 space-y-6">
        <Card className="p-4 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">Important!</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Save your recovery phrase and private key securely. Anyone with access can control your funds.
              </p>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <label className="text-sm font-medium text-foreground mb-2 block">Deposit Address</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-secondary p-3 rounded-lg text-sm break-all" data-testid="text-wallet-address">
              {walletData?.address}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCopy(walletData?.address || "", "Address")}
              data-testid="button-copy-address"
            >
              {copiedField === "Address" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      <Button className="w-full bg-navy" onClick={handleSaveWallet} data-testid="button-save-wallet">
        Done
      </Button>
    </div>
  );
}
