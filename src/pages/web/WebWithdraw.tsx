import { useState, useEffect } from "react";
import { WebLayout } from "@/components/WebSidebar";
import { PaymentMethodCard } from "@/components/PaymentMethodCard";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowUpRight, Building2, CheckCircle2, Loader2, Wallet, AlertCircle } from "lucide-react";
import { SiVisa, SiMastercard, SiTether } from "react-icons/si";
import { useNavigate } from "react-router-dom";
import { useBalances } from "@/hooks/useBalances";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

interface Bank {
  Code: string;
  Name: string;
}

type WalletType = "NGN" | "USDT_ERC20" | "USDT" | "BTC" | "ETH" | "SOL" | "TRX" | "ETH_TRC20" | "SOL_TRC20";

export default function WebWithdraw() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: balancesData } = useBalances();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("method_selection");
  const [selectedWallet, setSelectedWallet] = useState<WalletType>("NGN");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");

  // Crypto withdraw state
  const [cryptoAddress, setCryptoAddress] = useState("");

  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [isVerifyingName, setIsVerifyingName] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successRef, setSuccessRef] = useState("");

  const [korapayBanks, setKorapayBanks] = useState<Bank[]>([]);
  const [isLoadingKorapayBanks, setIsLoadingKorapayBanks] = useState(false);

  // Load Banks on Mount
  useEffect(() => {
    const fetchBanks = async () => {
      setIsLoadingBanks(true);
      try {
        const res = await fetch("/api/interswitch/banks", {
          credentials: "include"
        });
        if (!res.ok) throw new Error("Could not load banks");
        const data = await res.json();
        if (data.success && Array.isArray(data.banks)) {
          const formattedBanks = data.banks.map((b: any) => ({
            Code: b.cbnCode || b.Code || b.CbnCode || b.code || b.bankCode,
            Name: b.bankName || b.Name || b.BankName || b.name
          }));
          setBanks(formattedBanks);
        }
      } catch (error: any) {
        console.warn("Failed to fetch banks:", error.message);
        setBanks([
          { Code: "044", Name: "Access Bank" },
          { Code: "058", Name: "GTBank" },
          { Code: "033", Name: "UBA" },
          { Code: "232", Name: "Sterling Bank" },
          { Code: "057", Name: "Zenith Bank" },
          { Code: "100004", Name: "OPay" },
          { Code: "090267", Name: "Kuda" },
        ]);
      } finally {
        setIsLoadingBanks(false);
      }
    };
    fetchBanks();
  }, []);

  // Handle Account Name Inquiry
  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank) {
      const verifyAccount = async () => {
        setIsVerifyingName(true);
        setAccountName("");
        setErrorMessage("");

        try {
          const res = await fetch(`/api/interswitch/name-enquiry?bankCode=${selectedBank}&accountId=${accountNumber}`, {
            credentials: "include"
          });
          if (!res.ok) throw new Error("Name enquiry failed");
          const data = await res.json();

          if (data.success && data.accountName) {
            setAccountName(data.accountName);
          }
        } catch (error: any) {
          console.warn("Name enquiry failed:", error.message);
        } finally {
          setIsVerifyingName(false);
        }
      };

      const timer = setTimeout(verifyAccount, 800);
      return () => clearTimeout(timer);
    }
  }, [accountNumber, selectedBank]);

  // Handle Korapay Banks Fetching
  useEffect(() => {
    if (activeTab === "korapay_form" && korapayBanks.length === 0) {
      const fetchKorapayBanks = async () => {
        setIsLoadingKorapayBanks(true);
        try {
          const res = await fetch("/api/korapay/banks", {
            credentials: "include"
          });
          if (!res.ok) throw new Error("Failed to fetch Korapay banks");
          const data = await res.json();
          if (Array.isArray(data)) {
            const formatted = data.map((b: any) => ({ Code: b.bank_code, Name: b.name }));
            setKorapayBanks(formatted);
          }
        } catch (error: any) {
          console.warn("Korapay Banks Error:", error.message);
        } finally {
          setIsLoadingKorapayBanks(false);
        }
      };
      fetchKorapayBanks();
    }
  }, [activeTab]);

  const handleWithdraw = async () => {
    if (!amount || isNaN(Number(amount))) {
      setErrorMessage("Please enter a valid amount");
      return;
    }

    const numAmount = Number(amount);
    if (numAmount < 500) {
      setErrorMessage("Minimum withdrawal is 500 NGN");
      return;
    }

    if (selectedWallet === "NGN") {
      if (!accountNumber || accountNumber.length !== 10) {
        setErrorMessage("Please enter a valid 10-digit account number");
        return;
      }

      if (!selectedBank) {
        setErrorMessage("Please select a bank");
        return;
      }

      if (!accountName) {
        setErrorMessage("Account name could not be verified. Please check details.");
        return;
      }
    } else {
      if (!cryptoAddress) {
        setErrorMessage("Please provide a valid destination address.");
        return;
      }
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      if (selectedWallet === "NGN") {
        const payload = {
          amount,
          accountNumber,
          bankCode: selectedBank,
          beneficiaryName: accountName,
          narration: "Withdrawal from StableX",
        };

        const res = await fetch("/api/transactions/withdraw", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || "Withdrawal failed");
        }
        const data = await res.json();

        await queryClient.invalidateQueries({ queryKey: ["userBalances"] });
        setSuccessRef(data.transactionRef);
        setShowSuccess(true);
        setAmount("");
        setAccountNumber("");
        setAccountName("");
        toast({
          title: "Withdrawal Sent",
          description: `Successfully sent ₦${amount} to ${accountName}`
        });
      } else {
        const payload = {
          currency: selectedWallet,
          amount,
          address: cryptoAddress,
        };

        const res = await fetch("/api/transactions/withdraw-crypto", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || "Crypto withdrawal failed");
        }
        const data = await res.json();

        await queryClient.invalidateQueries({ queryKey: ["userBalances"] });
        setSuccessRef(data.transactionRef || `TXN-${Date.now()}`);
        setShowSuccess(true);
        toast({
          title: "Withdrawal Sent",
          description: `Successfully sent ${amount} ${selectedWallet} to recipient.`
        });
        setAmount("");
        setCryptoAddress("");
      }
    } catch (error) {
      console.error("Withdraw error:", error);
      setErrorMessage("Network error. Please try again.");
      toast({
        title: "Network Error",
        description: "Could not process withdrawal request.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKorapayWithdraw = async () => {
    if (!amount || isNaN(Number(amount))) {
      setErrorMessage("Please enter a valid amount");
      return;
    }

    const numAmount = Number(amount);
    if (numAmount < 1000) {
      setErrorMessage("Minimum Korapay withdrawal is 1,000 NGN");
      return;
    }

    if (!accountNumber || accountNumber.length !== 10) {
      setErrorMessage("Please enter a valid 10-digit account number");
      return;
    }

    if (!selectedBank) {
      setErrorMessage("Please select a bank");
      return;
    }

    if (!accountName) {
      setErrorMessage("Account name is required.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/korapay/payout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          accountNumber,
          bankCode: selectedBank,
          accountName,
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Korapay withdrawal failed");
      }
      const data = await res.json();

      await queryClient.invalidateQueries({ queryKey: ["userBalances"] });
      setSuccessRef(data.reference);
      setShowSuccess(true);
      setAmount("");
      setAccountNumber("");
      setAccountName("");
      setSelectedBank("");
      toast({
        title: "Payout Initiated",
        description: `Korapay withdrawal for ₦${amount} sent.`
      });
    } catch (e: any) {
      console.warn("Korapay Payout Error:", e.message);
      setErrorMessage(e.message || "Network error connecting to Korapay.");
    } finally {
      setIsProcessing(false);
    }
  };

  const currencySymbols: Record<WalletType, string> = {
    NGN: "₦",
    USDT_ERC20: "$",
    USDT: "₮",
    BTC: "₿",
    ETH: "Ξ",
    SOL: "◎",
    TRX: "TRX",
    ETH_TRC20: "WETH",
    SOL_TRC20: "WSOL",
  };

  const getBalance = () => {
    if (!balancesData) return 0;
    const key = selectedWallet as keyof typeof balancesData;
    return balancesData[key] || 0;
  };

  return (
    <WebLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-2">
            <ArrowUpRight className="w-6 h-6 text-red-500" />
            Withdraw
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            Send funds from your {selectedWallet} wallet
          </p>

          {/* Wallet selector */}
          <div className="mb-6">
            <Label className="text-sm text-muted-foreground mb-2 block">Select Source Wallet</Label>
            <Select value={selectedWallet} onValueChange={(v) => { setSelectedWallet(v as WalletType); setErrorMessage(""); setActiveTab("method_selection"); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select wallet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NGN">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-green-500" />
                    Naira Wallet (NGN)
                  </div>
                </SelectItem>
                <SelectItem value="USDT">
                  <div className="flex items-center gap-2">
                    <SiTether className="w-4 h-4 text-teal-500" />
                    USDT (TRC20)
                  </div>
                </SelectItem>
                <SelectItem value="USDT_ERC20">
                  <div className="flex items-center gap-2">
                    <SiTether className="w-4 h-4 text-emerald-500" />
                    USDT (ERC20)
                  </div>
                </SelectItem>
                <SelectItem value="BTC">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">₿</div>
                    Bitcoin (BTC)
                  </div>
                </SelectItem>
                <SelectItem value="ETH">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-[10px] text-white">Ξ</div>
                    Ethereum (ETH)
                  </div>
                </SelectItem>
                <SelectItem value="SOL">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gradient-to-tr from-green-400 to-purple-500 rounded flex items-center justify-center text-[8px] text-white">SOL</div>
                    Solana (SOL)
                  </div>
                </SelectItem>
                <SelectItem value="TRX">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold">TRX</div>
                    Tron (TRX)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border mb-6">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Available Balance</span>
            </div>
            <span className="font-bold text-lg">
              {currencySymbols[selectedWallet]}{getBalance().toLocaleString()}
            </span>
          </div>

          {/* FIAT WITHDRAWAL METHODS */}
          {selectedWallet === "NGN" && activeTab === "method_selection" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h3 className="text-lg font-semibold mb-4">Select Withdrawal Method</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PaymentMethodCard
                  id="bank_transfer"
                  title="Direct Bank Transfer"
                  icon={<Building2 className="w-5 h-5" />}
                  processingTime="Instant"
                  fee="₦50 flat"
                  limits="₦1,000 - ₦50,000,000"
                  recommended={true}
                  onClick={() => setActiveTab("bank_form")}
                />
                <PaymentMethodCard
                  id="korapay_transfer"
                  title="Alternative Bank Transfer"
                  icon={<Building2 className="w-5 h-5 text-purple-600" />}
                  processingTime="Instant"
                  fee="₦50 flat (Korapay)"
                  limits="₦1,000 - ₦5,000,000"
                  recommended={false}
                  onClick={() => {
                    setActiveTab("korapay_form");
                    setAccountNumber("");
                    setAccountName("");
                    setAmount("");
                  }}
                />
              </div>
            </div>
          )}

          {/* BANK WITHDRAW FORM */}
          {selectedWallet === "NGN" && activeTab === "bank_form" && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <Button variant="ghost" className="mb-4 pl-0" onClick={() => setActiveTab("method_selection")}>
                ← Back to Methods
              </Button>
              <Card className="p-6 space-y-6 shadow-md border-muted">
                <div className="flex items-center gap-3 border-b pb-4 mb-4">
                  <Building2 className="w-6 h-6 text-primary" />
                  <div>
                    <h3 className="font-semibold text-lg">Send to Bank Account</h3>
                    <p className="text-xs text-muted-foreground">Arrives instantly via NIP</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Amount to Withdraw (₦)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Select Bank</Label>
                  <Select value={selectedBank} onValueChange={setSelectedBank}>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingBanks ? "Loading banks..." : "Choose a bank"} />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((b) => (
                        <SelectItem key={b.Code} value={b.Code}>
                          {b.Name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <div className="relative">
                    <Input
                      type="text"
                      maxLength={10}
                      placeholder="0123456789"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                      className={accountName ? "border-green-500 focus-visible:ring-green-500" : ""}
                    />
                    {isVerifyingName && (
                      <div className="absolute right-3 top-2.5">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {accountName && (
                    <div className="flex items-center gap-2 mt-1 text-sm text-green-600 font-medium animate-in slide-in-from-top-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{accountName}</span>
                    </div>
                  )}
                  {!accountName && isVerifyingName && accountNumber.length === 10 && selectedBank && (
                    <p className="text-xs text-muted-foreground animate-in fade-in">
                      Verifying account...
                    </p>
                  )}
                  {!accountName && !isVerifyingName && accountNumber.length === 10 && selectedBank && (
                    <p className="text-xs text-red-500 animate-in fade-in">
                      Unable to verify account name. Please check details.
                    </p>
                  )}
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    {errorMessage}
                  </div>
                )}

                <Button
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-6"
                  size="lg"
                  onClick={handleWithdraw}
                  disabled={!accountName || !amount || isProcessing}
                >
                  {isProcessing ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing Transfer...</>
                  ) : (
                    "Confirm Withdrawal"
                  )}
                </Button>
              </Card>
            </div>
          )}

          {/* KORAPAY WITHDRAW FORM */}
          {selectedWallet === "NGN" && activeTab === "korapay_form" && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <Button variant="ghost" className="mb-4 pl-0" onClick={() => setActiveTab("method_selection")}>
                ← Back to Methods
              </Button>
              <Card className="p-6 space-y-6 shadow-md border-purple-100 dark:border-purple-900">
                <div className="flex items-center gap-3 border-b pb-4 mb-4">
                  <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Send via Korapay</h3>
                    <p className="text-xs text-muted-foreground">Alternative payout gateway</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Amount to Withdraw (₦)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Select Bank</Label>
                  <Select value={selectedBank} onValueChange={setSelectedBank}>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingKorapayBanks ? "Loading banks..." : "Choose a bank"} />
                    </SelectTrigger>
                    <SelectContent>
                      {korapayBanks.map((b) => (
                        <SelectItem key={b.Code} value={b.Code}>
                          {b.Name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    type="text"
                    maxLength={10}
                    placeholder="0123456789"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input
                    type="text"
                    placeholder="Legal Name on Account"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Please type your account name exactly as it appears.</p>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    {errorMessage}
                  </div>
                )}

                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-6"
                  size="lg"
                  onClick={handleKorapayWithdraw}
                  disabled={!accountName || !amount || !accountNumber || !selectedBank || isProcessing}
                >
                  {isProcessing ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing Payout...</>
                  ) : (
                    "Confirm Payout"
                  )}
                </Button>
              </Card>
            </div>
          )}

          {/* CRYPTO WITHDRAWAL */}
          {selectedWallet !== "NGN" && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-teal-500/20 rounded-full flex items-center justify-center">
                    <ArrowUpRight className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Send {selectedWallet}</h3>
                    <p className="text-sm text-muted-foreground">Withdraw crypto to an external wallet</p>
                  </div>
                </div>

                <div className="text-sm p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg mb-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-800 dark:text-amber-200 leading-relaxed">
                    Ensure the destination address supports <strong>{selectedWallet}</strong> on the correct network. Sending to a wrong address or network will result in permanent loss.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Destination Address</Label>
                    <Input
                      type="text"
                      placeholder={`Enter ${selectedWallet} recipient address`}
                      value={cryptoAddress}
                      onChange={(e) => setCryptoAddress(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex justify-between items-center">
                      <span>Amount</span>
                      <Button variant="link" className="h-auto p-0 text-xs text-primary" onClick={() => setAmount(String(getBalance()))}>MAX</Button>
                    </Label>
                    <Input
                      type="number"
                      placeholder={`0.00 ${selectedWallet}`}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                </div>

                {errorMessage && (
                  <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    {errorMessage}
                  </div>
                )}

                <Button
                  className="w-full mt-6 bg-red-600 hover:bg-red-700 text-white font-semibold py-6"
                  size="lg"
                  onClick={handleWithdraw}
                  disabled={!cryptoAddress || !amount || isProcessing}
                >
                  {isProcessing ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    `Send ${amount || '0'} ${selectedWallet}`
                  )}
                </Button>
              </Card>
            </div>
          )}

        </div>

        {/* Success Dialog */}
        <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex flex-col items-center gap-4 text-center">
                <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <span className="text-2xl text-green-700">Withdrawal Successful</span>
              </DialogTitle>
              <DialogDescription className="text-center pt-2 space-y-1">
                <p>You have sent <span className="font-bold text-foreground">{currencySymbols[selectedWallet]}{parseFloat(amount).toLocaleString()}</span></p>
                <p>To: <span className="font-medium text-foreground truncate block max-w-full">{selectedWallet === "NGN" ? accountName : cryptoAddress}</span></p>
                <p className="text-xs text-muted-foreground mt-2 break-all">Ref: {successRef}</p>
              </DialogDescription>
            </DialogHeader>
            <div className="pt-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowSuccess(false)}>
                Close
              </Button>
              <Button className="flex-1" onClick={() => navigate("/dashboard")}>
                Go Home
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </WebLayout>
  );
}
