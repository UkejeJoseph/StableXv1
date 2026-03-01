import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { PaymentMethodCard } from "@/components/PaymentMethodCard";
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
import {
  CreditCard,
  Building2,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Phone,
  Timer,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import { SiVisa, SiMastercard, SiTether } from "react-icons/si";
import { useWallets } from "@/hooks/useWallets";
import { useToast } from "@/components/ui/use-toast";

declare global {
  interface Window {
    webpayCheckout: (config: any) => void;
  }
}

type WalletType = "NGN" | "USDT_ERC20" | "USDT" | "BTC" | "ETH" | "SOL" | "TRX" | "ETH_TRC20" | "SOL_TRC20";

interface VirtualAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

interface USSDBank {
  bankCode: string;
  bankName: string;
  ussdCode?: string;
}

import { useUser } from "@/contexts/UserContext";
import { useQueryClient } from "@tanstack/react-query";

export default function Deposit() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("checkout");
  const [selectedWallet, setSelectedWallet] = useState<WalletType>("NGN");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [config, setConfig] = useState<{
    merchantCode: string;
    payItemId: string;
    checkoutScript: string;
    mode: string;
  } | null>(null);

  // Web Redirect State
  const [redirectPayload, setRedirectPayload] = useState<{
    hash: string;
    amount: number;
    ref: string;
    redirectUrl: string;
  } | null>(null);

  // USSD state
  const [ussdBanks, setUssdBanks] = useState<USSDBank[]>([]);
  const [selectedUssdBank, setSelectedUssdBank] = useState("");
  const [ussdCode, setUssdCode] = useState("");
  const [isLoadingUssdBanks, setIsLoadingUssdBanks] = useState(false);

  // Dynamic Virtual Account state
  const [dynamicAccount, setDynamicAccount] = useState<{
    bankName: string;
    accountNumber: string;
    accountName: string;
    expiryDateTime: string;
  } | null>(null);

  // KoraPay Jeroid-Style state
  const [korapayAccount, setKorapayAccount] = useState<{
    bankName: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    accountReference?: string;
  } | null>(null);

  // Static virtual accounts (manual transfer)
  const virtualAccounts: Record<string, VirtualAccount> = {
    NGN: {
      bankName: "OPay",
      accountNumber: "7087232777",
      accountName: "StableX / Joseph Ukeje",
    },
    USD: {
      bankName: "Providus Bank",
      accountNumber: "9400012345",
      accountName: "StableX DOM",
    },
  };

  // Crypto Deposit Addresses (Real + Fallback)
  const [cryptoAddresses, setCryptoAddresses] = useState<Record<string, string>>({
    BTC: "bc1q...",
    ETH: "0x...",
    SOL: "Sol...",
    TRX: "T...",
    ETH_TRC20: "T...",
    SOL_TRC20: "T...",
  });

  const { data: storedWallets = [] } = useWallets();

  // Fetch User Wallets
  useEffect(() => {
    if (storedWallets.length > 0) {
      const newAddresses: Record<string, string> = {};

      storedWallets.forEach((w) => {
        const net = w.network || w.currency;
        if (net === "USDT_TRC20") newAddresses.USDT = w.address;
        if (net === "USDT_ERC20") newAddresses.USDT_ERC20 = w.address;
        if (net === "BTC") newAddresses.BTC = w.address;
        if (net === "ETH") newAddresses.ETH = w.address;
        if (net === "SOL") newAddresses.SOL = w.address;
        if (net === "TRX") newAddresses.TRX = w.address;
        if (net === "ETH_TRC20") newAddresses.ETH_TRC20 = w.address;
        if (net === "SOL_TRC20") newAddresses.SOL_TRC20 = w.address;
        if (net === "USDC_ERC20") newAddresses.USDC_ERC20 = w.address;
      });

      setCryptoAddresses(prev => ({ ...prev, ...newAddresses }));
    }
  }, [storedWallets]);

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

  const verifyKorapayDeposit = async (ref?: string) => {
    const targetRef = ref || korapayAccount?.accountReference;
    if (!targetRef) return;

    setIsProcessing(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/korapay/deposit/verify/${targetRef}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Korapay verification failed");
      }
      const data = await res.json();
      if (data.transaction?.status === "completed") {
        await queryClient.invalidateQueries({ queryKey: ["userBalances"] });
        setShowSuccess(true);
        if (ref)
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
      } else {
        setErrorMessage(data.message || "Deposit is still pending verification.");
      }
    } catch (e: any) {
      console.warn("Korapay Verify Error:", e.message);
      setErrorMessage(e.message || "Failed to verify deposit via Korapay");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/interswitch/config", { credentials: "include" });
        if (!res.ok) throw new Error("Could not load checkout config");
        const data = await res.json();
        setConfig(data);

        if (data.checkoutScript) {
          const existingScript = document.querySelector(
            `script[src="${data.checkoutScript}"]`
          );
          if (!existingScript) {
            const script = document.createElement("script");
            script.src = data.checkoutScript;
            script.async = true;
            document.body.appendChild(script);
          }
        }
      } catch (e: any) {
        console.warn("Config loading error:", e.message);
        toast({
          title: "Service Unavailable",
          description: "Payment system initialization failed. Some payment methods may be unavailable.",
          variant: "destructive"
        });
      }
    };
    fetchConfig();
  }, []);

  // Handle Korapay Redirect Verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    const koraStatus = params.get("status");

    if (reference && (koraStatus === "success" || !koraStatus)) {
      verifyKorapayDeposit(reference);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "ussd" && ussdBanks.length === 0) {
      setIsLoadingUssdBanks(true);
      fetch("/api/interswitch/ussd-banks", { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to fetch USSD banks");
          return res.json();
        })
        .then((data) => {
          if (data.success && Array.isArray(data.banks)) {
            setUssdBanks(data.banks);
          }
        })
        .catch(err => console.warn("USSD Banks Error:", err.message))
        .finally(() => setIsLoadingUssdBanks(false));
    }
  }, [activeTab]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateTransactionRef = (): string => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `STX${timestamp}${random}`.toUpperCase();
  };

  const handlePaymentConfirmation = async () => {
    setIsProcessing(true);
    setErrorMessage("");

    try {
      const isCrypto = selectedWallet !== "NGN";
      const ref = transactionRef || `REF-${Date.now()}`;
      const endpoint = isCrypto ? "/api/transactions/deposit-pending" : "/api/transactions/deposit";

      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency: selectedWallet,
          reference: ref,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to record deposit");
      }

      await res.json();
      await queryClient.invalidateQueries({ queryKey: ["userBalances"] });
      setShowSuccess(true);
      setAmount("");
      setUssdCode("");
      setDynamicAccount(null);
      setKorapayAccount(null);

      toast({
        title: "Deposit Recorded",
        description: isCrypto ? "Waiting for blockchain confirmation." : "Your account has been credited."
      });
    } catch (error: any) {
      console.warn("Deposit confirmation error:", error.message);
      setErrorMessage(error.message || "Network error. Could not complete deposit.");
      toast({
        title: "Deposit Error",
        description: error.message || "Network connection failed.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Card Payment ──
  const handleCardPayment = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage("Please enter a valid amount");
      return;
    }
    if (parseFloat(amount) < 100) {
      setErrorMessage("Minimum deposit amount is ₦100");
      return;
    }
    if (!config) {
      setErrorMessage("Payment system is still loading. Please wait.");
      return;
    }

    setErrorMessage("");
    setIsProcessing(true);

    const ref = generateTransactionRef();
    setTransactionRef(ref);
    const amountInKobo = Math.round(parseFloat(amount) * 100);

    const checkoutConfig = {
      merchant_code: config.merchantCode,
      pay_item_name: "StableX Wallet Deposit",
      txn_ref: ref,
      amount: amountInKobo,
      currency: 566,
      cust_name: user?.fullName || "StableX Customer",
      cust_email: user?.email || "",
      cust_id: user?._id || "",
      onComplete: async (response: any) => {
        if (response.resp === "00" || response.responseCode === "00") {
          try {
            const verifyRes = await fetch(
              `/api/interswitch/transaction-status?transactionRef=${ref}&amount=${amount}`,
              { credentials: "include" }
            );
            if (!verifyRes.ok) throw new Error("Verification service unavailable");
            const verifyData = await verifyRes.json();

            if (verifyData.success && verifyData.ResponseCode === "00") {
              await queryClient.invalidateQueries({ queryKey: ["userBalances"] });
              setShowSuccess(true);
              setAmount("");
              toast({
                title: "Payment Successful",
                description: `₦${amount} has been deposited via card.`
              });
            } else {
              setErrorMessage("Payment verification failed. Please contact support.");
              toast({
                title: "Payment Verification Failed",
                description: "Payment status could not be confirmed.",
                variant: "destructive"
              });
            }
          } catch (e: any) {
            console.warn("Card Verify Error:", e.message);
            setErrorMessage("Could not verify payment automatically. Please click 'I have paid'.");
          }
        } else {
          const err = response.message || response.desc || "Payment failed. Please try again.";
          setErrorMessage(err);
        }
        setIsProcessing(false);
      },
      mode: config.mode,
      site_redirect_url: window.location.href,
    };

    if (typeof window.webpayCheckout === "function") {
      console.log("INTERSWITCH WEBPAY PAYLOAD [Card] =>", JSON.stringify(checkoutConfig, null, 2));
      window.webpayCheckout(checkoutConfig);
    } else {
      setErrorMessage("Payment system is loading. Please try again in a moment.");
      setIsProcessing(false);
    }
  };

  // ── USSD Payment ──
  const handleUssdPayment = async () => {
    if (!amount || parseFloat(amount) < 1000) {
      setErrorMessage("Minimum deposit amount is ₦1,000");
      return;
    }
    if (!selectedUssdBank) {
      setErrorMessage("Please select a bank");
      return;
    }

    setErrorMessage("");
    setIsProcessing(true);
    setUssdCode("");

    const ref = generateTransactionRef();
    setTransactionRef(ref);

    try {
      const response = await fetch("/api/interswitch/pay-ussd", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          transactionRef: ref,
          bankCode: selectedUssdBank,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Failed to generate USSD code");
      }
      const data = await response.json();

      if (data.success && data.ussdCode) {
        setUssdCode(data.ussdCode);
        setTransactionRef(data.transactionRef);
        toast({
          title: "USSD Code Generated",
          description: "Please dial the code to complete your payment."
        });
      } else {
        const bank = ussdBanks.find((b) => b.bankCode === selectedUssdBank);
        if (bank?.ussdCode) {
          setUssdCode(bank.ussdCode);
        } else {
          throw new Error(data.error || "Failed to generate USSD code");
        }
      }
    } catch (error: any) {
      console.warn("USSD Error:", error.message);
      setErrorMessage(error.message || "Network error. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Korapay Bank Transfer (Jeroid Style) ──
  const handleKorapayBankTransfer = async () => {
    if (!amount || parseFloat(amount) < 1000) {
      setErrorMessage("Minimum deposit amount is ₦1,000");
      return;
    }

    setErrorMessage("");
    setIsProcessing(true);
    setKorapayAccount(null);

    try {
      const response = await fetch("/api/korapay/deposit/bank-transfer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (response.ok && data.virtualAccount) {
        setKorapayAccount(data.virtualAccount);
      } else {
        setErrorMessage(data.message || "Failed to generate bank account. Try another method.");
      }
    } catch (error) {
      console.error("Kora Transfer Error:", error);
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };




  // ── Korapay Checkout (Modal) ──
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js";
    script.async = true;
    script.onload = () => console.log("[KORAPAY-CHECKOUT] ✅ Script loaded");
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const verifyPaymentServerSide = async (reference: string) => {
    console.log("[KORAPAY-CHECKOUT] Verifying payment server-side, ref:", reference);
    try {
      const res = await fetch(`/api/korapay/deposit/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const result = await res.json();
      console.log("[KORAPAY-CHECKOUT] Verification response:", JSON.stringify(result));
      if (result.success) {
        toast({
          title: "Deposit Successful",
          description: `₦${result.amount} credited to your wallet!`,
        });
        // refreshUserBalance(); // If available
      } else {
        setErrorMessage(result.message || "Verification failed");
      }
    } catch (err: any) {
      console.error("[KORAPAY-CHECKOUT] Verification error:", err);
    }
  };

  const handleKorapayCheckout = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage("Please enter a valid amount");
      return;
    }

    setErrorMessage("");
    setIsProcessing(true);

    try {
      const res = await fetch("/api/korapay/deposit/initialize", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Korapay initialization failed");
      }
      const data = await res.json();

      if (data.reference) {
        // @ts-ignore
        window.Korapay.initialize({
          key: data.publicKey,
          reference: data.reference,
          amount: parseFloat(amount),
          currency: "NGN",
          customer: {
            name: user?.fullName || "StableX Customer",
            email: user?.email || "",
          },
          merchant_bears_cost: true,
          channels: ["bank_transfer", "card", "pay_with_bank"],
          notification_url: `${window.location.origin}/webhook/korapay`,
          onSuccess: function (data: any) {
            console.log("[KORAPAY-CHECKOUT] onSuccess fired:", JSON.stringify(data));
            verifyPaymentServerSide(data.reference);
          },
          onFailed: function (data: any) {
            console.log("[KORAPAY-CHECKOUT] onFailed fired:", JSON.stringify(data));
            setErrorMessage("Payment failed. Please try again.");
          },
          onPending: function (data: any) {
            console.log("[KORAPAY-CHECKOUT] onPending fired:", JSON.stringify(data));
            toast({
              title: "Payment Pending",
              description: "Your bank transfer is being processed. We will credit your account once confirmed.",
            });
          },
          onClose: function () {
            console.log("[KORAPAY-CHECKOUT] Modal closed by user");
          },
        });
      } else {
        throw new Error(data.message || "Failed to initialize checkout.");
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "Network error connecting to Korapay.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Korapay Web Redirect (Hosted Checkout) ──
  const handleKorapayWebRedirect = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage("Please enter a valid amount");
      return;
    }

    setErrorMessage("");
    setIsProcessing(true);

    try {
      const redirectUrl = `${window.location.origin}/dashboard/wallet/deposit-verify`;

      const res = await fetch("/api/korapay/deposit/initialize", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          redirectUrl
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to initialize Korapay Redirect.");
      }

      const data = await res.json();

      if (data.checkoutUrl) {
        // Redirect browser to the secure hosted Korapay checkout page
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("Korapay did not return a valid checkout URL.");
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "Network error connecting to Korapay.");
      setIsProcessing(false);
    }
  };

  // ── Korapay Pay with Bank (Direct Debit) ──
  const handleKorapayPayWithBank = async (bankCode: string) => {
    if (!amount || parseFloat(amount) < 200) {
      setErrorMessage("Minimum deposit amount for Pay with Bank is ₦200");
      return;
    }

    setErrorMessage("");
    setIsProcessing(true);

    try {
      const res = await fetch("/api/korapay/deposit/pay-with-bank", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          bankCode
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to initialize Pay with Bank.");
      }

      const data = await res.json();

      if (data.checkoutUrl) {
        // Redirect browser to the bank's authorization page
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("Korapay did not return a valid checkout URL.");
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "Network error connecting to Korapay.");
      setIsProcessing(false);
    }
  };

  // ── Web Redirect (Form Post Method) ──
  const handleWebRedirect = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage("Please enter a valid amount");
      return;
    }
    if (parseFloat(amount) < 100) {
      setErrorMessage("Minimum deposit amount is ₦100");
      return;
    }

    setErrorMessage("");
    setIsProcessing(true);

    const ref = generateTransactionRef();
    setTransactionRef(ref);

    try {
      const redirectUrl = `${window.location.origin}/dashboard/wallet/deposit-verify`;

      const hashRes = await fetch("/api/interswitch/generate-checkout-hash", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          txn_ref: ref,
          redirect_url: redirectUrl,
        }),
      });

      if (!hashRes.ok) throw new Error("Failed to generate security hash");
      const { hash, amount: amountInKobo } = await hashRes.json();

      // Set the payload, which triggers the form rendering in the UI
      setRedirectPayload({
        hash,
        amount: amountInKobo,
        ref,
        redirectUrl
      });

    } catch (err: any) {
      setErrorMessage(err.message || "Failed to initiate web redirect.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Web Checkout (ALL payment methods in one popup) ──
  const handleWebCheckout = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage("Please enter a valid amount");
      return;
    }
    if (parseFloat(amount) < 100) {
      setErrorMessage("Minimum deposit amount is ₦100");
      return;
    }
    if (!config) {
      setErrorMessage("Payment system is still loading. Please wait.");
      return;
    }

    setErrorMessage("");
    setIsProcessing(true);

    const ref = generateTransactionRef();
    setTransactionRef(ref);

    try {
      // 1. Fetch SHA512 Hash from Backend (includes internal validation and kobo conversion)
      console.log("[WebCheckout] Fetching hash from backend...");
      const hashRes = await fetch("/api/interswitch/generate-checkout-hash", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          txn_ref: ref,
          redirect_url: window.location.href, // Must be HTTPS in prod
        }),
      });

      if (!hashRes.ok) {
        const errorData = await hashRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate security hash");
      }

      const { hash, amount: amountInKobo } = await hashRes.json();

      const checkoutConfig = {
        merchant_code: config.merchantCode,
        pay_item_id: config.payItemId,
        pay_item_name: "StableX Wallet Deposit",
        txn_ref: ref,
        amount: amountInKobo,
        currency: "566",
        cust_name: user?.fullName || "StableX Customer",
        cust_email: user?.email || "customer@stablex.com",
        cust_id: user?._id || "guest",
        onComplete: async (response: any) => {
          try {
            const verifyRes = await fetch(
              `/api/interswitch/web-checkout-confirm?transactionRef=${ref}&amount=${amount}`,
              {
                credentials: "include",
              }
            );
            if (!verifyRes.ok) throw new Error("Web checkout verification failed");
            const verifyData = await verifyRes.json();

            if (verifyData.success && verifyData.ResponseCode === "00") {
              await queryClient.invalidateQueries({ queryKey: ["userBalances"] });
              setShowSuccess(true);
              setAmount("");
              toast({
                title: "Payment Successful",
                description: `₦${amount} deposit confirmed.`
              });
            } else {
              setErrorMessage("Payment verification failed. Ref: " + ref);
            }
          } catch (err: any) {
            console.warn("WebCheckout Verify Error:", err.message);
            setErrorMessage("Verification error. Please contact support with ref: " + ref);
          }
          setIsProcessing(false);
        },
        mode: config.mode,
      };

      if (typeof window.webpayCheckout === "function") {
        console.log("[WebCheckout] Registering pending transaction...");

        // 2. Create Pending Transaction on Backend
        await fetch("/api/transactions/deposit-pending", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: parseFloat(amount),
            currency: "NGN",
            reference: ref,
          }),
        });

        console.log("INTERSWITCH WEBPAY PAYLOAD =>", JSON.stringify(checkoutConfig, null, 2));
        window.webpayCheckout(checkoutConfig);
      } else {
        throw new Error("Payment script not fully loaded. Please refresh.");
      }

    } catch (err: any) {
      console.error("[WebCheckout] Initiation error:", err);
      setErrorMessage(err.message || "Failed to initiate payment");
      setIsProcessing(false);
    }
  };

  // ── Dynamic Virtual Account ──
  const handleDynamicTransfer = async () => {
    if (!amount || parseFloat(amount) < 1000) {
      setErrorMessage("Minimum deposit amount is ₦1,000");
      return;
    }

    setErrorMessage("");
    setIsProcessing(true);
    setDynamicAccount(null);

    const ref = generateTransactionRef();
    setTransactionRef(ref);

    try {
      const response = await fetch("/api/interswitch/pay-transfer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          transactionRef: ref,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Failed to generate virtual account");
      }
      const data = await response.json();

      if (data.success && data.accountNumber) {
        setDynamicAccount({
          bankName: data.bankName || "Interswitch",
          accountNumber: data.accountNumber,
          accountName: data.accountName || "StableX",
          expiryDateTime: data.expiryDateTime || "",
        });
      } else {
        throw new Error(data.error || "Failed to generate virtual account. Please try again.");
      }
    } catch (error: any) {
      console.error("Dynamic transfer error:", error);
      setErrorMessage(error.message || "Network error. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-background">
      <Header />

      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Deposit</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Fund your {selectedWallet} wallet
        </p>

        {config?.mode === "TEST" && selectedWallet === "NGN" && (
          <Card className="bg-amber-500/10 border-amber-500/30 p-3 mb-4">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Test Mode Active</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
                  Use test card: 5060990580000217499 | Exp: 03/50 | CVV: 111 | PIN: 1111 | OTP: 123456
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Wallet selector */}
        <div className="mb-6">
          <Label className="text-sm text-muted-foreground mb-2 block">Select Wallet to Credit</Label>
          <Select value={selectedWallet} onValueChange={(v) => { setSelectedWallet(v as WalletType); setErrorMessage(""); }}>
            <SelectTrigger className="w-full" data-testid="select-wallet">
              <SelectValue placeholder="Select wallet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NGN" data-testid="select-ngn">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-green-500" />
                  Naira Wallet (NGN)
                </div>
              </SelectItem>
              <SelectItem value="USDT" data-testid="select-usdt">
                <div className="flex items-center gap-2">
                  <SiTether className="w-4 h-4 text-teal-500" />
                  USDT (TRC20)
                </div>
              </SelectItem>
              <SelectItem value="USDT_ERC20" data-testid="select-usd">
                <div className="flex items-center gap-2">
                  <SiTether className="w-4 h-4 text-emerald-500" />
                  USDT (ERC20)
                </div>
              </SelectItem>
              <SelectItem value="BTC" data-testid="select-btc">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">₿</div>
                  Bitcoin (BTC)
                </div>
              </SelectItem>
              <SelectItem value="ETH" data-testid="select-eth">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-[10px] text-white">Ξ</div>
                  Ethereum (ETH)
                </div>
              </SelectItem>
              <SelectItem value="SOL" data-testid="select-sol">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-tr from-green-400 to-purple-500 rounded flex items-center justify-center text-[8px] text-white">SOL</div>
                  Solana (SOL)
                </div>
              </SelectItem>
              <SelectItem value="TRX" data-testid="select-trx">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold">TRX</div>
                  Tron (TRX)
                </div>
              </SelectItem>
              <SelectItem value="ETH_TRC20" data-testid="select-eth-trc">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-[10px] text-white">Ξ</div>
                  ETH (TRC20 - Wrapped)
                </div>
              </SelectItem>
              <SelectItem value="SOL_TRC20" data-testid="select-sol-trc">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-tr from-green-400 to-purple-500 rounded flex items-center justify-center text-[8px] text-white">SOL</div>
                  SOL (TRC20 - Wrapped)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ─── CONDITIONAL LAYOUT BASED ON WALLET TYPE ─── */}

        {/* NGN = FIAT DEPOSIT METHODS */}
        {selectedWallet === "NGN" && activeTab === "checkout" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h3 className="text-lg font-semibold mb-4">Select Payment Method</h3>

            <div className="grid grid-cols-1 gap-4">
              <PaymentMethodCard
                id="korapay-transfer"
                title="Bank Transfer (Kora)"
                icon={<Building2 className="w-5 h-5 text-purple-600" />}
                processingTime="Instant - 10 minutes"
                fee="₦50 flat"
                limits="₦100 - ₦10,000,000"
                recommended={true}
                onClick={() => setActiveTab("korapay_transfer")}
              />
              <PaymentMethodCard
                id="checkout"
                title="Interswitch (Inline)"
                icon={<ShieldCheck className="w-5 h-5" />}
                processingTime="Instant popup"
                fee="0%"
                limits="₦1,000 - ₦5,000,000"
                recommended={false}
                onClick={() => setActiveTab("checkout_form")}
              />
              <PaymentMethodCard
                id="redirect"
                title="Interswitch (Redirect)"
                icon={<Building2 className="w-5 h-5" />}
                processingTime="Secure Page"
                fee="0%"
                limits="₦1,000 - ₦5,000,000"
                recommended={false}
                onClick={() => setActiveTab("redirect_form")}
              />
              <PaymentMethodCard
                id="korapay"
                title="Kora Gateway (Card/USSD)"
                icon={<ShieldCheck className="w-5 h-5 text-purple-600" />}
                processingTime="Instant - 5 minutes"
                fee="0%"
                limits="₦1,000 - ₦50,000,000"
                recommended={false}
                onClick={() => setActiveTab("korapay_form")}
              />
              <PaymentMethodCard
                id="korapay-redirect"
                title="Kora (Web Redirect)"
                icon={<ArrowUpRight className="w-5 h-5 text-purple-600" />}
                processingTime="Secure Page"
                fee="0%"
                limits="₦1,000 - ₦50,000,000"
                recommended={false}
                onClick={() => setActiveTab("korapay_redirect_form")}
              />
              <PaymentMethodCard
                id="korapay-opay"
                title="Opay (Direct)"
                icon={<div className="w-5 h-5 bg-[#00D161] rounded-full flex items-center justify-center text-[10px] text-white font-bold">O</div>}
                processingTime="Instant Bank App"
                fee="0%"
                limits="₦200 - ₦10,000,000"
                recommended={false}
                onClick={() => setActiveTab("korapay_opay_form")}
              />
              <PaymentMethodCard
                id="korapay-palmpay"
                title="PalmPay (Direct)"
                icon={<div className="w-5 h-5 bg-[#613EEA] rounded-full flex items-center justify-center text-[10px] text-white font-bold">P</div>}
                processingTime="Instant Bank App"
                fee="0%"
                limits="₦200 - ₦10,000,000"
                recommended={false}
                onClick={() => setActiveTab("korapay_palmpay_form")}
              />
              <PaymentMethodCard
                id="transfer"
                title="Online Bank Transfer"
                icon={<Building2 className="w-5 h-5" />}
                processingTime="Instant - 15 minutes"
                fee="₦50 flat"
                limits="₦1,000 - ₦1,000,000"
                onClick={() => setActiveTab("transfer_form")}
              />
              <PaymentMethodCard
                id="card"
                title="Bank Card (Visa/MC)"
                icon={<CreditCard className="w-5 h-5" />}
                processingTime="Instant"
                fee="1.5%"
                limits="₦500 - ₦500,000"
                onClick={() => setActiveTab("card_form")}
              />
              <PaymentMethodCard
                id="ussd"
                title="Pay with USSD"
                icon={<Phone className="w-5 h-5" />}
                processingTime="Instant - 5 minutes"
                fee="₦20 flat"
                limits="₦500 - ₦250,000"
                onClick={() => setActiveTab("ussd_form")}
              />
            </div>
          </div>
        )}

        {/* ─── SPECIFIC FORM VIEWS ─── */}

        {selectedWallet === "NGN" && activeTab === "korapay_transfer" && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Button variant="ghost" className="mb-4 pl-0" onClick={() => setActiveTab("checkout")}>
              ← Back to Methods
            </Button>
            <Card className="p-4 bg-card border-border/50">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-8 h-8 text-purple-600" />
                <div>
                  <h3 className="font-bold text-lg text-purple-600">Bank Transfer (Jeroid Style)</h3>
                  <p className="text-sm text-muted-foreground">Fast, Automated funding with no up-front KYC</p>
                </div>
              </div>

              {!korapayAccount ? (
                <div className="space-y-4">
                  <div className="bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg text-xs text-purple-700 dark:text-purple-300">
                    <p className="font-medium mb-1">⚡ Instant Funding</p>
                    <p>Enter an amount to generate a temporary account for payment. No NIN/BVN required!</p>
                  </div>
                  <Label>Amount (NGN)</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="Enter amount to deposit"
                  />
                  <Button
                    className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold"
                    onClick={handleKorapayBankTransfer}
                    disabled={isProcessing || !amount || parseFloat(amount) < 100}
                  >
                    {isProcessing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Account...</>
                    ) : (
                      <>Generate Payment Account</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-muted/50 rounded-xl p-5 space-y-4 border border-border mb-4">
                    <div className="flex justify-between items-center border-b border-border/50 pb-2">
                      <span className="text-sm text-muted-foreground">Bank Name</span>
                      <span className="font-bold text-purple-600">{korapayAccount.bankName}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-border/50 pb-2">
                      <span className="text-sm text-muted-foreground">Account Name</span>
                      <span className="font-medium">{korapayAccount.accountName}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground block mb-1">Account Number</span>
                      <div className="flex items-center justify-between bg-background p-3 rounded-lg border border-border">
                        <span className="font-mono text-2xl font-bold tracking-wider text-foreground">{korapayAccount.accountNumber}</span>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(korapayAccount.accountNumber)}>
                          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-6 border border-blue-100 dark:border-blue-900/30">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Timer className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Temporary Account</span>
                    </div>
                    <p className="text-xs text-blue-600/80 dark:text-blue-300/80">
                      Transfer exactly <strong className="text-blue-700 dark:text-blue-300">₦{amount}</strong>.
                      This account is for this transaction only.
                    </p>
                  </div>

                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg font-bold shadow-lg"
                    onClick={handlePaymentConfirmation}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                    I have sent the money
                  </Button>

                  <Button variant="link" className="w-full mt-4 text-muted-foreground" onClick={() => setKorapayAccount(null)}>
                    Cancel and try another amount
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}

        {selectedWallet === "NGN" && activeTab === "checkout_form" && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Button variant="ghost" className="mb-4 pl-0" onClick={() => setActiveTab("checkout")}>
              ← Back to Methods
            </Button>
            <Card className="p-4 bg-card border-border/50">
              <div className="flex items-center gap-3 mb-6">
                <ShieldCheck className="w-8 h-8 text-primary" />
                <div>
                  <h3 className="font-bold text-lg">Secure Web Checkout</h3>
                  <p className="text-sm text-muted-foreground">Redirects to Interswitch Payment Gateway</p>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs text-blue-700 dark:text-blue-300 mb-4">
                <p className="font-medium mb-1">🔒 Most secure option</p>
                <p>Opens the Interswitch payment popup with all available payment methods. You never leave the page.</p>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <SiVisa className="w-8 h-5 text-blue-600" />
                <SiMastercard className="w-8 h-5 text-orange-500" />
                <div className="w-8 h-5 bg-green-600 rounded text-white text-[9px] flex items-center justify-center font-bold">VERVE</div>
                <Building2 className="w-5 h-5 text-muted-foreground" />
                <Phone className="w-5 h-5 text-muted-foreground" />
                <Wallet className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="space-y-4">
                <Label>Amount (NGN)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount to deposit"
                />
                <Button
                  className="w-full mt-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
                  onClick={handleWebCheckout}
                  disabled={isProcessing || !amount}
                  data-testid="btn-web-checkout"
                >
                  {isProcessing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    <>Pay ₦{amount || "0"} — Interswitch Checkout</>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ─── INTERSWITCH WEB REDIRECT FORM ─── */}
        {selectedWallet === "NGN" && activeTab === "redirect_form" && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Button variant="ghost" className="mb-4 pl-0" onClick={() => { setActiveTab("checkout"); setRedirectPayload(null); }}>
              ← Back to Methods
            </Button>
            <Card className="p-4 bg-card border-border/50">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-8 h-8 text-primary" />
                <div>
                  <h3 className="font-bold text-lg">Web Redirect Checkout</h3>
                  <p className="text-sm text-muted-foreground">Redirects to official Interswitch site</p>
                </div>
              </div>

              {!redirectPayload ? (
                <div className="space-y-4">
                  <Label>Amount (NGN)</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="Enter amount"
                  />
                  <Button
                    className="w-full mt-2 bg-slate-800 hover:bg-slate-900 text-white"
                    onClick={handleWebRedirect}
                    disabled={isProcessing || !amount}
                  >
                    {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing...</> : "Generate Secure Payment Link"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in">
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-4 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200 font-medium text-center">
                      Ready! Click below to proceed to the Interswitch payment gateway.
                    </p>
                  </div>
                  <form
                    method="post"
                    action={config?.mode === "TEST" ? "https://newwebpay.qa.interswitchng.com/collections/w/pay" : "https://newwebpay.interswitchng.com/collections/w/pay"}
                  >
                    <input type="hidden" name="merchant_code" value={config?.merchantCode} />
                    <input type="hidden" name="pay_item_id" value={config?.payItemId} />
                    <input type="hidden" name="site_redirect_url" value={redirectPayload.redirectUrl} />
                    <input type="hidden" name="txn_ref" value={redirectPayload.ref} />
                    <input type="hidden" name="amount" value={redirectPayload.amount} />
                    <input type="hidden" name="currency" value="566" />
                    <input type="hidden" name="hash" value={redirectPayload.hash} />

                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg">
                      Proceed to Secure Gateway →
                    </Button>
                  </form>
                  <Button variant="ghost" className="w-full" onClick={() => setRedirectPayload(null)}>Cancel</Button>
                </div>
              )}
            </Card>
          </div>
        )}

        {selectedWallet === "NGN" && activeTab === "korapay_opay_form" && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Button variant="ghost" className="mb-4 pl-0" onClick={() => setActiveTab("checkout")}>
              ← Back to Methods
            </Button>
            <Card className="p-6 bg-card border-border/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#00D161] rounded-full flex items-center justify-center text-xl text-white font-bold">O</div>
                <div>
                  <h3 className="font-bold text-lg text-[#00D161]">Opay Direct</h3>
                  <p className="text-sm text-muted-foreground">Authorize via Opay App/OTP</p>
                </div>
              </div>
              <div className="bg-[#00D161]/10 p-3 rounded-lg text-xs text-[#00D161] font-medium mb-4">
                <p className="mb-1">⚡ Fast & Automated</p>
                <p>You will be redirected to Opay's secure authorization page.</p>
              </div>
              <div className="space-y-4">
                <Label>Amount (NGN)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount (min ₦200)"
                />
                <Button
                  className="w-full mt-2 bg-[#00D161] hover:bg-[#00B151] text-white font-semibold py-6 text-lg"
                  onClick={() => handleKorapayPayWithBank("100004")}
                  disabled={isProcessing || !amount || parseFloat(amount) < 200}
                >
                  {isProcessing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing...</>
                  ) : (
                    <>Pay with Opay Direct →</>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {selectedWallet === "NGN" && activeTab === "korapay_palmpay_form" && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Button variant="ghost" className="mb-4 pl-0" onClick={() => setActiveTab("checkout")}>
              ← Back to Methods
            </Button>
            <Card className="p-6 bg-card border-border/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#613EEA] rounded-full flex items-center justify-center text-xl text-white font-bold">P</div>
                <div>
                  <h3 className="font-bold text-lg text-[#613EEA]">PalmPay Direct</h3>
                  <p className="text-sm text-muted-foreground">Authorize via PalmPay App/OTP</p>
                </div>
              </div>
              <div className="bg-[#613EEA]/10 p-3 rounded-lg text-xs text-[#613EEA] font-medium mb-4">
                <p className="mb-1">⚡ Instant Authorization</p>
                <p>You will be redirected to PalmPay's secure authorization page.</p>
              </div>
              <div className="space-y-4">
                <Label>Amount (NGN)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount (min ₦200)"
                />
                <Button
                  className="w-full mt-2 bg-[#613EEA] hover:bg-[#512EDA] text-white font-semibold py-6 text-lg"
                  onClick={() => handleKorapayPayWithBank("100033")}
                  disabled={isProcessing || !amount || parseFloat(amount) < 200}
                >
                  {isProcessing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing...</>
                  ) : (
                    <>Pay with PalmPay Direct →</>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ─── KORAPAY CHECKOUT FORM ─── */}
        {selectedWallet === "NGN" && activeTab === "korapay_form" && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Button variant="ghost" className="mb-4 pl-0" onClick={() => setActiveTab("checkout")}>
              ← Back to Methods
            </Button>
            <Card className="p-6 bg-card border-border/50">
              <div className="flex items-center gap-3 mb-6">
                <ShieldCheck className="w-8 h-8 text-purple-600" />
                <div>
                  <h3 className="font-bold text-lg">Korapay Checkout (Inline)</h3>
                  <p className="text-sm text-muted-foreground">Secure Payment Gateway Popup</p>
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg text-xs text-purple-700 dark:text-purple-300 mb-4">
                <p className="font-medium mb-1">⚡ Instant popup</p>
                <p>Pay with Bank Transfer, USSD, or Card via Korapay.</p>
              </div>
              <div className="space-y-4">
                <Label>Amount (NGN)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount to deposit"
                />
                <Button
                  className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-6 text-lg"
                  onClick={handleKorapayCheckout}
                  disabled={isProcessing || !amount}
                >
                  {isProcessing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Initializing...</>
                  ) : (
                    <>Pay ₦{amount || "0"} with Korapay Modal</>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {selectedWallet === "NGN" && activeTab === "korapay_redirect_form" && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Button variant="ghost" className="mb-4 pl-0" onClick={() => setActiveTab("checkout")}>
              ← Back to Methods
            </Button>
            <Card className="p-6 bg-card border-border/50">
              <div className="flex items-center gap-3 mb-6">
                <ArrowUpRight className="w-8 h-8 text-purple-600" />
                <div>
                  <h3 className="font-bold text-lg">Korapay Web Redirect</h3>
                  <p className="text-sm text-muted-foreground">Secure Hosted Payment Page</p>
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg text-xs text-purple-700 dark:text-purple-300 mb-4">
                <p className="font-medium mb-1">🔒 Highly Secure</p>
                <p>You will be redirected to Korapay's hosted checkout page to complete your transaction.</p>
              </div>
              <div className="space-y-4">
                <Label>Amount (NGN)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount to deposit"
                />
                <Button
                  className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-6 text-lg"
                  onClick={handleKorapayWebRedirect}
                  disabled={isProcessing || !amount}
                >
                  {isProcessing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing Redirect...</>
                  ) : (
                    <>Redirect to Korapay Checkout →</>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ─── CARD PAYMENT VIEW ─── */}
        {selectedWallet === "NGN" && activeTab === "card_form" && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Button variant="ghost" className="mb-4 pl-0" onClick={() => setActiveTab("checkout")}>
              ← Back to Methods
            </Button>
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <SiVisa className="w-10 h-6 text-blue-600" />
                  <SiMastercard className="w-10 h-6 text-orange-500" />
                  <div className="w-10 h-6 bg-green-600 rounded text-white text-xs flex items-center justify-center font-bold">
                    VERVE
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">Secured by Interswitch</span>
              </div>
              <div className="space-y-4">
                <Label>Amount (NGN)</Label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                <Button className="w-full mt-2" onClick={handleCardPayment} disabled={isProcessing || !amount}>
                  {isProcessing ? "Processing..." : "Pay with Card"}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ─── BANK TRANSFER VIEW ─── */}
        {selectedWallet === "NGN" && activeTab === "transfer_form" && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Button variant="ghost" className="mb-4 pl-0" onClick={() => setActiveTab("checkout")}>
              ← Back to Methods
            </Button>
            <Card className="p-4">
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Instant Bank Transfer
                </h3>

                {!dynamicAccount ? (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Generate a unique account number for this transaction.
                    </p>
                    <Label>Amount (NGN)</Label>
                    <Input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="Enter amount to deposit"
                    />
                    <Button
                      className="w-full mt-2"
                      onClick={handleDynamicTransfer}
                      disabled={isProcessing || !amount || parseFloat(amount) < 100}
                    >
                      {isProcessing ? "Generating Account..." : "Generate Payment Account"}
                    </Button>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-muted/50 rounded-lg p-4 space-y-4 border border-border mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Bank Name</span>
                        <span className="font-medium">{dynamicAccount.bankName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Account Name</span>
                        <span className="font-medium">{dynamicAccount.accountName}</span>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground block mb-1">Account Number</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xl font-bold text-primary">{dynamicAccount.accountNumber}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(dynamicAccount.accountNumber)}>
                            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                      {dynamicAccount.expiryDateTime && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/20 p-2 rounded">
                          <Timer className="w-3 h-3" />
                          <span>Expires: {new Date(dynamicAccount.expiryDateTime).toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-xs text-blue-700 dark:text-blue-300 mb-4">
                      Transfer exactly <strong>₦{amount}</strong> to this account using your bank app.
                    </div>

                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      onClick={handlePaymentConfirmation}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      I have sent the money
                    </Button>

                    <Button variant="ghost" className="w-full mt-2 text-xs" onClick={() => setDynamicAccount(null)}>
                      Cancel / New Transaction
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ─── USSD PAYMENT VIEW ─── */}
        {selectedWallet === "NGN" && activeTab === "ussd_form" && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Button variant="ghost" className="mb-4 pl-0" onClick={() => setActiveTab("checkout")}>
              ← Back to Methods
            </Button>
            <Card className="p-4">
              <h3 className="font-semibold mb-2">USSD Payment</h3>
              <div className="space-y-4">
                <Input type="number" placeholder="Enter Amount" value={amount} onChange={e => setAmount(e.target.value)} />
                <Select value={selectedUssdBank} onValueChange={setSelectedUssdBank}>
                  <SelectTrigger><SelectValue placeholder="Select Bank" /></SelectTrigger>
                  <SelectContent>
                    {ussdBanks.map(b => <SelectItem key={b.bankCode} value={b.bankCode}>{b.bankName}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button className="w-full" onClick={handleUssdPayment} disabled={isProcessing}>
                  {isProcessing ? "Generating..." : "Generate USSD Code"}
                </Button>
                {ussdCode && (
                  <div className="p-4 bg-green-100 rounded text-center">
                    <p className="font-bold text-xl">{ussdCode}</p>
                    <Button
                      className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white"
                      onClick={handlePaymentConfirmation}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      I have completed payment
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* USDT / USD / BTC / ETH / SOL / TRX = CRYPTO DEPOSIT */}
        {(selectedWallet !== "NGN") && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-teal-500/20 rounded-full flex items-center justify-center">
                <Wallet className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Deposit {selectedWallet}</h3>
                <p className="text-sm text-muted-foreground">Send {selectedWallet} to the address below</p>
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-xl border border-border mb-6">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Network</span>
                <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {selectedWallet === "USDT" || selectedWallet === "TRX" || selectedWallet === "ETH_TRC20" || selectedWallet === "SOL_TRC20" ? "TRC20" :
                    selectedWallet === "USDT_ERC20" || selectedWallet === "ETH" ? "ERC20" :
                      selectedWallet === "BTC" ? "BTC" :
                        selectedWallet === "SOL" ? "SOLANA" : "CHAIN"}
                </span>
              </div>

              <div className="mt-4">
                <span className="text-xs text-muted-foreground block mb-2">Wallet Address</span>
                <div className="flex items-center gap-2 bg-background p-3 rounded-lg border border-border">
                  <code className="text-sm font-mono flex-1 break-all">
                    {cryptoAddresses[selectedWallet] || "Generating address..."}
                  </code>
                  <Button size="icon" variant="ghost" onClick={() => copyToClipboard(cryptoAddresses[selectedWallet])}>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg mb-6">
              <AlertCircle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Send only <strong>{selectedWallet}</strong> to this address.
                Sending any other asset or using the wrong network will result in permanent loss.
              </p>
            </div>

            <div className="mt-4 border-t pt-4">
              <Label>Amount Sent</Label>
              <Input
                type="number"
                placeholder={`Amount in ${selectedWallet}`}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="mt-2"
              />
              <div className="flex flex-col gap-3 mt-4">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => verifyKorapayDeposit()}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Timer className="w-5 h-5 mr-2" />}
                  Check Payment Status
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setKorapayAccount(null);
                    setActiveTab("checkout");
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          </Card>
        )}

      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-6 h-6" />
              Deposit Successful!
            </DialogTitle>
            <DialogDescription>
              Your deposit has been processed. Logic: "Jeroid-like" individual accounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-green-500/10 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Amount Credited</span>
                <span className="font-bold text-lg text-green-600">
                  {currencySymbols[selectedWallet]}{amount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Wallet</span>
                <span className="font-medium text-xs">{selectedWallet}</span>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => setShowSuccess(false)}
              data-testid="button-close-success"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
