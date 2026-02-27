import { Gift, ChevronRight, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

const giftcards = [
  { id: "amazon", name: "Amazon", description: "Shop millions of products", rate: "₦1,450/$" },
  { id: "itunes", name: "iTunes", description: "Music, movies & apps", rate: "₦1,400/$" },
  { id: "google", name: "Google Play", description: "Apps & games", rate: "₦1,350/$" },
  { id: "steam", name: "Steam", description: "PC gaming platform", rate: "₦1,300/$" },
];

export default function Giftcard() {
  return (
    <div className="flex flex-col min-h-screen pb-20 bg-background">
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-1" data-testid="giftcard-title">Gift Cards</h1>
        <p className="text-sm text-muted-foreground mb-4">Buy and sell gift cards at great rates</p>

        <Card className="p-4 bg-amber-500/10 border-amber-500/30 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-600 dark:text-amber-400 text-sm">Coming Soon</p>
              <p className="text-xs text-muted-foreground">Gift card trading is not yet available.</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4 mb-6 opacity-50 pointer-events-none">
          <Card className="p-4 text-center bg-navy text-white" data-testid="button-buy-giftcard">
            <Gift className="w-8 h-8 mx-auto mb-2" />
            <p className="font-medium">Buy Giftcard</p>
          </Card>
          <Card className="p-4 text-center" data-testid="button-sell-giftcard">
            <Gift className="w-8 h-8 mx-auto mb-2 text-navy" />
            <p className="font-medium">Sell Giftcard</p>
          </Card>
        </div>

        <h2 className="text-sm font-semibold text-foreground mb-4">Popular Gift Cards</h2>

        <div className="space-y-2 opacity-50">
          {giftcards.map((card) => (
            <Card
              key={card.id}
              className="p-4 flex items-center justify-between"
              data-testid={`giftcard-${card.id}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                  <Gift className="w-6 h-6 text-navy" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{card.name}</p>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{card.rate}</span>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
