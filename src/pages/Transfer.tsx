import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Send,
  Wallet,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Fuel,
  Info,
} from "lucide-react";
import { SiBitcoin, SiEthereum, SiSolana } from "react-icons/si";
import { NetworkType, getNetworkDisplayName } from "@/lib/wallet";
import { useWallets } from "@/hooks/useWallets";
import {
  estimateGasFee,
  sendTransaction,
  validateAddress,
  GasFeeEstimate,
  TransactionResult,
} from "@/lib/transactions";

export default function Transfer() {
  const { toast } = useToast();
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>("ETH");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");

  const [gasFee, setGasFee] = useState<GasFeeEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [addressError, setAddressError] = useState("");

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [transactionResult, setTransactionResult] = useState<TransactionResult | null>(null);

  const { data: wallets = [] } = useWallets();
  const selectedWallet = wallets.find(w => w.network === selectedNetwork);

  const networkIcons: Record<NetworkType, JSX.Element> = {
    BTC: <SiBitcoin className="w-5 h-5 text-orange-500" />,
    ETH: <SiEthereum className="w-5 h-5 text-blue-500" />,
    SOL: <SiSolana className="w-5 h-5 text-purple-500" />,
    USDT_ERC20: <span className="text-green-500 font-bold text-sm">USDT</span>,
    USDT_TRC20: <span className="text-green-500 font-bold text-sm">TRC20</span>,
    TRX: <span className="text-red-500 font-bold text-sm">TRX</span>,
    ETH_TRC20: <SiEthereum className="w-5 h-5 text-green-500" />,
    SOL_TRC20: <SiSolana className="w-5 h-5 text-green-600" />,
    XRP: <span className="text-blue-400 font-bold text-sm">XRP</span>,
    USDC_ERC20: <span className="text-blue-500 font-bold text-sm">USDC</span>,
    WBTC: <span className="text-orange-500 font-bold text-sm">WBTC</span>,
    DAI: <span className="text-yellow-500 font-bold text-sm">DAI</span>,
  };

  useEffect(() => {
    if (toAddress && amount && parseFloat(amount) > 0) {
      estimateGas();
    }
  }, [selectedNetwork, toAddress, amount]);

  useEffect(() => {
    if (toAddress) {
      const isValid = validateAddress(selectedNetwork, toAddress);
      setAddressError(isValid ? "" : "Invalid address for this network");
    } else {
      setAddressError("");
    }
  }, [toAddress, selectedNetwork]);

  const estimateGas = async () => {
    if (!toAddress || !amount) return;

    setIsEstimating(true);
    try {
      const estimate = await estimateGasFee(selectedNetwork, toAddress, amount);
      setGasFee(estimate);
    } catch (err) {
      console.error("Gas estimation error:", err);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleTransfer = () => {
    setError("");

    if (!selectedWallet) {
      setError("No wallet found for this network. Please create one first.");
      return;
    }

    if (!toAddress) {
      setError("Please enter a recipient address");
      return;
    }

    if (!validateAddress(selectedNetwork, toAddress)) {
      setError("Invalid recipient address");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmTransfer = async () => {
    setIsSending(true);
    setError("");

    try {
      const result = await sendTransaction({
        network: selectedNetwork,
        fromAddress: selectedWallet?.address || "",
        toAddress,
        amount,
      });

      setTransactionResult(result);
      if (result.success) {
        toast({
          title: "Transfer Initiated",
          description: `Transaction sent successfully to ${toAddress.slice(0, 6)}...`,
        });
        setShowConfirmDialog(false);
        setShowSuccessDialog(true);
        resetForm();
      } else {
        const errorMsg = result.error || "Transaction failed";
        setError(errorMsg);
        toast({
          title: "Transfer Failed",
          description: errorMsg,
          variant: "destructive"
        });
      }
    } catch (err: any) {
      const errorMsg = err.message || "Transaction failed";
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const resetForm = () => {
    setToAddress("");
    setAmount("");
    setGasFee(null);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />

      <main className="p-4 max-w-md mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Transfer</h1>
          <p className="text-muted-foreground text-sm">Send crypto to any wallet address</p>
        </div>

        <Card className="p-4 space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Select Network</Label>
            <Select value={selectedNetwork} onValueChange={(v) => setSelectedNetwork(v as NetworkType)}>
              <SelectTrigger data-testid="select-network">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ETH">
                  <div className="flex items-center gap-2">
                    <SiEthereum className="w-4 h-4 text-blue-500" />
                    Ethereum (ETH)
                  </div>
                </SelectItem>
                <SelectItem value="SOL">
                  <div className="flex items-center gap-2">
                    <SiSolana className="w-4 h-4 text-purple-500" />
                    Solana (SOL)
                  </div>
                </SelectItem>
                <SelectItem value="USDT_ERC20">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 font-bold text-xs">USDT</span>
                    USDT (ERC20)
                  </div>
                </SelectItem>
                <SelectItem value="BTC">
                  <div className="flex items-center gap-2">
                    <SiBitcoin className="w-4 h-4 text-orange-500" />
                    Bitcoin (BTC)
                  </div>
                </SelectItem>
                <SelectItem value="USDT_TRC20">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 font-bold text-xs">TRC20</span>
                    USDT (TRC20)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedWallet ? (
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="w-4 h-4" />
                <span>From:</span>
              </div>
              <p className="text-xs font-mono mt-1 break-all">{selectedWallet.address}</p>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">No wallet found for {getNetworkDisplayName(selectedNetwork)}</span>
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Recipient Address</Label>
            <Input
              placeholder={`Enter ${getNetworkDisplayName(selectedNetwork)} address`}
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              className={addressError ? "border-red-500" : ""}
              data-testid="input-to-address"
            />
            {addressError && (
              <p className="text-xs text-red-500 mt-1">{addressError}</p>
            )}
          </div>

          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Amount</Label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-16"
                data-testid="input-amount"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                {selectedNetwork === "USDT_ERC20" || selectedNetwork === "USDT_TRC20" ? "USDT" : selectedNetwork}
              </span>
            </div>
          </div>

          {gasFee && (
            <div className="bg-muted/50 p-3 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Fuel className="w-4 h-4" />
                <span>Network Fee</span>
                {isEstimating && <Loader2 className="w-3 h-3 animate-spin" />}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Gas Price:</span>
                  <p>{gasFee.gasPrice}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Fee:</span>
                  <p>{gasFee.totalFee}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-green-600">
                Estimated: {gasFee.feeInUSD}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleTransfer}
            disabled={!selectedWallet || !toAddress || !amount || !!addressError}
            data-testid="button-transfer"
          >
            <Send className="w-4 h-4 mr-2" />
            Transfer
          </Button>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-xs text-blue-700 dark:text-blue-400">
                <p className="font-medium">Real Transaction</p>
                <p>This will send actual crypto on the mainnet. Double-check the address before confirming.</p>
              </div>
            </div>
          </div>
        </Card>
      </main>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Transfer</DialogTitle>
            <DialogDescription>
              Review the transaction details before sending
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network</span>
                <span className="font-medium flex items-center gap-2">
                  {networkIcons[selectedNetwork]}
                  {getNetworkDisplayName(selectedNetwork)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{amount} {selectedNetwork === "USDT_ERC20" || selectedNetwork === "USDT_TRC20" ? "USDT" : selectedNetwork}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">To:</span>
                <p className="font-mono text-xs break-all mt-1">{toAddress}</p>
              </div>
              {gasFee && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Network Fee</span>
                  <span className="font-medium">{gasFee.feeInUSD}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowConfirmDialog(false);
                  setError("");
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={confirmTransfer}
                disabled={isSending}
                data-testid="button-confirm"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Confirm & Send"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              Transaction Sent
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-muted-foreground">
              Your transaction has been broadcast to the network.
            </p>

            {transactionResult?.txHash && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
                <p className="font-mono text-xs break-all">{transactionResult.txHash}</p>
              </div>
            )}

            {transactionResult?.explorerUrl && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(transactionResult.explorerUrl, "_blank")}
                data-testid="button-view-explorer"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View on Explorer
              </Button>
            )}

            <Button
              className="w-full"
              onClick={() => setShowSuccessDialog(false)}
              data-testid="button-done"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
