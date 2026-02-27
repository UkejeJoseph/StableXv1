import { useState, useEffect } from "react";
import { Gift, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Giftcard() {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<any>(null);

  const [paymentCurrency, setPaymentCurrency] = useState("USDT_TRC20");
  const [rates, setRates] = useState({ NGN_USDT: 1 / 1600 });

  useEffect(() => {
    const fetchCards = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/giftcards?country=NG", {
          credentials: "include"
        });
        if (!res.ok) throw new Error("Failed to load gift cards");
        const data = await res.json();
        if (data.success) {
          setCards(data.data?.content || []);
        } else {
          throw new Error(data.message || "Failed to load gift cards");
        }
      } catch (err: any) {
        toast({
          title: "Failed to load gift cards",
          description: err.message,
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    const fetchRates = async () => {
      try {
        const res = await fetch("/api/transactions/rates");
        if (!res.ok) throw new Error("Could not fetch rates");
        const data = await res.json();
        if (data.success && data.rates?.USDT?.NGN) {
          setRates({ NGN_USDT: 1 / data.rates.USDT.NGN });
        }
      } catch (err: any) {
        console.warn("Giftcard Rates Error:", err.message);
      }
    };

    fetchCards();
    fetchRates();
  }, [toast]);

  const handlePurchase = async () => {
    if (!selectedAmount || !recipientEmail || !selectedCard) return;
    setIsPurchasing(true);
    try {
      const res = await fetch("/api/giftcards/purchase", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedCard.productId,
          unitPrice: selectedAmount,
          quantity: 1,
          recipientEmail,
          paymentCurrency,
          productCurrency: selectedCard.recipientCurrencyCode || 'NGN'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Purchase failed");

      setPurchaseSuccess(data.order);
      toast({
        title: "Gift card purchased!",
        description: `Code sent to ${recipientEmail}`
      });
    } catch (err: any) {
      toast({
        title: "Purchase failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const calculateTotal = () => {
    if (!selectedAmount) return "0";
    const markup = 1.05;
    if (paymentCurrency.startsWith("USDT")) {
      return (selectedAmount * rates.NGN_USDT * markup).toFixed(2);
    }
    return Math.round(selectedAmount * markup).toLocaleString();
  };

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-background">
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Gift Cards</h1>
        <p className="text-sm text-muted-foreground mb-6">Buy gift cards at great rates</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card className="p-4 text-center bg-primary text-primary-foreground card-elevated shadow-teal-500/20">
            <Gift className="w-8 h-8 mx-auto mb-2" />
            <p className="font-medium">Buy Gift Card</p>
          </Card>
          <Card className="p-4 text-center opacity-50 cursor-not-allowed">
            <Gift className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="font-medium">Sell Gift Card</p>
          </Card>
        </div>

        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Available Gift Cards</h2>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {cards.map((card: any) => (
              <Card
                key={card.productId}
                className="cursor-pointer hover:border-primary transition-all card-elevated group"
                onClick={() => {
                  setSelectedCard(card);
                  setShowPurchaseDialog(true);
                }}
              >
                <CardContent className="p-3 flex flex-col items-center gap-2">
                  <div className="h-16 w-full flex items-center justify-center p-2 mb-1">
                    {card.logoUrls?.[0] ? (
                      <img
                        src={card.logoUrls[0]}
                        alt={card.name}
                        className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform"
                      />
                    ) : (
                      <Gift className="h-10 w-10 text-primary" />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-center text-foreground line-clamp-2 h-8">
                    {card.name}
                  </p>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                    {card.recipientCurrencyCode}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={showPurchaseDialog}
        onOpenChange={(o) => {
          if (!o) {
            setShowPurchaseDialog(false);
            setPurchaseSuccess(null);
            setSelectedAmount(null);
            setRecipientEmail("");
          }
        }}
      >
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedCard?.name}</DialogTitle>
            <DialogDescription>
              Select an amount and enter recipient email
            </DialogDescription>
          </DialogHeader>

          {purchaseSuccess ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
              <p className="font-semibold text-foreground text-lg text-center">Purchase Successful!</p>
              <p className="text-sm text-muted-foreground text-center px-4">
                Gift card code has been sent to <span className="text-foreground font-medium">{recipientEmail}</span>
              </p>
              <div className="bg-muted rounded-lg p-4 w-full text-center border border-border">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Order ID</p>
                <p className="font-mono text-sm font-bold text-foreground">{purchaseSuccess.transactionId || purchaseSuccess.orderId}</p>
              </div>
              <Button onClick={() => setShowPurchaseDialog(false)} className="w-full mt-2">
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-6 pt-4">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-3 block uppercase tracking-wide">
                  Select Amount
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {(selectedCard?.fixedRecipientDenominations || selectedCard?.fixedSenderDenominations || []).slice(0, 9).map((amount: number) => (
                    <button
                      key={amount}
                      onClick={() => setSelectedAmount(amount)}
                      className={`rounded-lg border p-2 text-sm font-medium transition-all ${selectedAmount === amount
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border text-foreground hover:border-primary/50"
                        }`}
                    >
                      {selectedCard?.recipientCurrencyCode} {amount}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-3 block uppercase tracking-wide">
                  Purchase With
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={paymentCurrency === "USDT_TRC20" ? "default" : "outline"}
                    onClick={() => setPaymentCurrency("USDT_TRC20")}
                    className="text-xs h-9"
                  >
                    USDT (TRC20)
                  </Button>
                  <Button
                    variant={paymentCurrency === "NGN" ? "default" : "outline"}
                    onClick={() => setPaymentCurrency("NGN")}
                    className="text-xs h-9"
                  >
                    NGN (Wallet)
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientEmail" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Recipient Email
                </Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  placeholder="email@example.com"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  className="bg-muted/50"
                />
              </div>

              {selectedAmount && (
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Card value</span>
                    <span className="font-medium text-foreground">{selectedCard.recipientCurrencyCode} {selectedAmount}</span>
                  </div>
                  <div className="flex justify-between text-base pt-1 border-t border-primary/5">
                    <span className="font-semibold">Estimated Cost</span>
                    <span className="font-bold text-primary">
                      {calculateTotal()} {paymentCurrency === 'NGN' ? 'NGN' : 'USDT'}
                    </span>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setShowPurchaseDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  disabled={!selectedAmount || !recipientEmail || isPurchasing}
                  onClick={handlePurchase}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isPurchasing ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>
                  ) : "Confirm Purchase"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
