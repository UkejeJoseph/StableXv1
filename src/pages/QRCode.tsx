import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QrCode, Camera, Copy, Check, Send, AlertTriangle, ArrowUpRight, Loader2 } from "lucide-react";
import { getNetworkDisplayName, type NetworkType } from "@/lib/wallet";
import { useWallets } from "@/hooks/useWallets";
import { sendTransaction } from "@/lib/transactions";
import QRCodeLib from "qrcode";
import { Html5Qrcode } from "html5-qrcode";
import { SiBitcoin, SiEthereum, SiSolana, SiTether } from "react-icons/si";

const networkIcons: Record<string, JSX.Element> = {
  BTC: <SiBitcoin className="w-5 h-5 text-orange-500" />,
  ETH: <SiEthereum className="w-5 h-5 text-blue-500" />,
  SOL: <SiSolana className="w-5 h-5 text-purple-500" />,
  USDT_ERC20: <SiTether className="w-5 h-5 text-green-500" />,
  USDT_TRC20: <SiTether className="w-5 h-5 text-green-500" />,
};

export default function QRCodePage() {
  const [activeTab, setActiveTab] = useState("receive");
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [wallets, setWallets] = useState<Array<{ address: string; network: NetworkType }>>([]);
  const [copied, setCopied] = useState(false);

  const [scannedAddress, setScannedAddress] = useState("");
  const [scannedAmount, setScannedAmount] = useState("");
  const [scannedNetwork, setScannedNetwork] = useState<NetworkType | "">("");
  const [isScanning, setIsScanning] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [txHash, setTxHash] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const { data: storedWallets = [] } = useWallets();

  useEffect(() => {
    setWallets(storedWallets);
    if (storedWallets.length > 0 && !selectedWallet) {
      setSelectedWallet(`${storedWallets[0].network}:${storedWallets[0].address}`);
    }
  }, [storedWallets]);

  useEffect(() => {
    if (selectedWallet) {
      generateQRCode();
    }
  }, [selectedWallet, amount]);

  const generateQRCode = async () => {
    if (!selectedWallet) return;

    const [network, address] = selectedWallet.split(":");
    let qrData = `stablex:${network}:${address}`;
    if (amount) {
      qrData += `:${amount}`;
    }

    try {
      const url = await QRCodeLib.toDataURL(qrData, {
        width: 256,
        margin: 2,
        color: {
          dark: "#1a2f5a",
          light: "#ffffff",
        },
      });
      setQrCodeUrl(url);
    } catch (err) {
      console.error("Error generating QR code:", err);
    }
  };

  const copyAddress = () => {
    if (selectedWallet) {
      const [, address] = selectedWallet.split(":");
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const startScanning = async () => {
    setIsScanning(true);
    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanResult(decodedText);
          stopScanning();
        },
        () => { }
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current = null;
        setIsScanning(false);
      }).catch(console.error);
    }
  };

  const handleScanResult = (data: string) => {
    if (data.startsWith("stablex:")) {
      const parts = data.split(":");
      if (parts.length >= 3) {
        setScannedNetwork(parts[1] as NetworkType);
        setScannedAddress(parts[2]);
        if (parts.length >= 4) {
          setScannedAmount(parts[3]);
        }
        setShowTransferDialog(true);
      }
    } else if (data.startsWith("0x") || data.startsWith("T") || data.length > 30) {
      setScannedAddress(data);
      setScannedNetwork("");
      setScannedAmount("");
      setShowTransferDialog(true);
    }
  };

  const handleSend = async () => {
    if (!scannedAddress || !scannedAmount) {
      setSendError("Please fill in all fields.");
      return;
    }

    const network = (scannedNetwork || "ETH") as NetworkType;
    const senderWallet = wallets.find((w) => w.network === network);

    if (!senderWallet) {
      setSendError(`No ${getNetworkDisplayName(network)} wallet found. Create one first.`);
      return;
    }

    setIsSending(true);
    setSendError("");
    setTxHash("");

    try {
      const result = await sendTransaction({
        network,
        fromAddress: senderWallet.address,
        toAddress: scannedAddress,
        amount: scannedAmount,
      });

      if (result.success) {
        setTxHash(result.txHash || "");
        setShowTransferDialog(false);
        setScannedAddress("");
        setScannedAmount("");
        setScannedNetwork("");

        alert(
          `✅ Transaction sent!\n\nHash: ${result.txHash}\n\nView on explorer:\n${result.explorerUrl}`
        );
      } else {
        setSendError(result.error || "Transaction failed. Please try again.");
      }
    } catch (err: any) {
      setSendError(err.message || "Transaction failed.");
    } finally {
      setIsSending(false);
    }
  };

  const resetScan = () => {
    setScannedAddress("");
    setScannedAmount("");
    setScannedNetwork("");
    setSendError("");
    setTxHash("");
    setShowTransferDialog(false);
  };

  const selectedNetwork = selectedWallet ? selectedWallet.split(":")[0] as NetworkType : null;

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-background">
      <Header />

      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">QR Code</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Scan or share QR codes for quick transfers
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="receive" data-testid="tab-receive">
              <QrCode className="w-4 h-4 mr-2" />
              Receive
            </TabsTrigger>
            <TabsTrigger value="scan" data-testid="tab-scan">
              <Camera className="w-4 h-4 mr-2" />
              Scan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="receive">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Select Wallet & Network</Label>
                  <Select value={selectedWallet} onValueChange={setSelectedWallet}>
                    <SelectTrigger data-testid="select-wallet">
                      <SelectValue placeholder="Select a wallet" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.map((w) => (
                        <SelectItem key={`${w.network}:${w.address}`} value={`${w.network}:${w.address}`}>
                          <div className="flex items-center gap-2">
                            {networkIcons[w.network]}
                            <span>{getNetworkDisplayName(w.network)} - {w.address.slice(0, 8)}...</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedNetwork && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      {networkIcons[selectedNetwork]}
                      <div>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                          {getNetworkDisplayName(selectedNetwork)} Network
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-500">
                          Only send {selectedNetwork.replace("_", " ")} to this address
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">
                    Amount (Optional)
                  </Label>
                  <Input
                    type="number"
                    placeholder="Enter amount to request"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    data-testid="input-amount"
                  />
                </div>

                {qrCodeUrl && (
                  <div className="flex flex-col items-center py-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm">
                      <img
                        src={qrCodeUrl}
                        alt="QR Code"
                        className="w-56 h-56"
                        data-testid="qr-code-image"
                      />
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-xs text-muted-foreground break-all px-4">
                        {selectedWallet.split(":")[1]}
                      </p>
                      {amount && (
                        <p className="text-sm font-medium mt-1">
                          Amount: {amount} {selectedNetwork}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={copyAddress}
                      data-testid="button-copy-address"
                    >
                      {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                      {copied ? "Copied!" : "Copy Address"}
                    </Button>
                  </div>
                )}

                {wallets.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Create a wallet first to generate QR codes
                  </p>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="scan">
            <Card className="p-6">
              <div className="space-y-4">
                <div
                  id="qr-reader"
                  className={`w-full aspect-square bg-muted rounded-lg overflow-hidden ${isScanning ? "" : "hidden"}`}
                />

                {!isScanning && (
                  <div className="flex flex-col items-center py-8">
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Camera className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-center mb-4">
                      Scan a QR code to send crypto
                    </p>
                    <Button
                      className="bg-navy"
                      onClick={startScanning}
                      data-testid="button-start-scan"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Start Scanning
                    </Button>
                  </div>
                )}

                {isScanning && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={stopScanning}
                    data-testid="button-stop-scan"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5" />
              Send Transfer
            </DialogTitle>
            <DialogDescription>
              Review and confirm the transfer details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {scannedNetwork && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                {networkIcons[scannedNetwork]}
                <div>
                  <p className="text-sm font-medium">{getNetworkDisplayName(scannedNetwork as NetworkType)}</p>
                  <p className="text-xs text-muted-foreground">Network</p>
                </div>
              </div>
            )}

            {!scannedNetwork && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Network not specified</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">Make sure you're sending to the correct blockchain</p>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">To Address</Label>
              <p className="font-mono text-sm bg-muted p-2 rounded break-all">
                {scannedAddress}
              </p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Amount</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={scannedAmount}
                onChange={(e) => setScannedAmount(e.target.value)}
                className="text-lg font-medium"
                data-testid="input-transfer-amount"
              />
            </div>

            {sendError && (
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <p className="text-sm text-red-600">{sendError}</p>
              </div>
            )}

            <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                ⚠️ This sends <strong>real crypto on mainnet</strong>. Double-check the address and amount.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={resetScan}
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-navy"
                onClick={handleSend}
                disabled={!scannedAmount || isSending}
                data-testid="button-confirm-send"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
