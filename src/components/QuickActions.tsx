import { Download, Send, Coins, TrendingUp, Wallet, Link2, Upload, CreditCard, Sparkles, Plus, ArrowLeftRight } from "lucide-react";
import { Link } from "react-router-dom";

interface QuickAction {
  icon: typeof Download;
  label: string;
  path?: string;
  onClick?: () => void;
  highlight?: boolean;
}

const walletActions: QuickAction[] = [
  { icon: Coins, label: "Buy", path: "/trade" },
  { icon: Send, label: "Sell", path: "/trade" },
  { icon: Upload, label: "Withdraw", path: "/withdraw" },
];

interface QuickActionsProps {
  variant?: "home" | "wallet";
  onConnect?: () => void;
  onQuickSend?: () => void;
}

export function QuickActions({ variant = "home", onConnect, onQuickSend }: QuickActionsProps) {
  const homeActions: QuickAction[] = [
    { icon: CreditCard, label: "Deposit", path: "/deposit", highlight: true },
    { icon: Plus, label: "Fund", path: "/deposit" },
    { icon: Send, label: "Transfer", onClick: onQuickSend },
    { icon: ArrowLeftRight, label: "Swap", path: "/convert" },
    { icon: Coins, label: "Buy", path: "/trade" },
    { icon: Download, label: "Sell", path: "/trade" },
    { icon: TrendingUp, label: "Trade", path: "/trade" },
    { icon: Wallet, label: "Wallet", path: "/wallet" },
    { icon: Link2, label: "Connect", path: "/wallet" },
    { icon: Upload, label: "Withdraw", path: "/withdraw" },
    { icon: Sparkles, label: "Earn", path: "/earn" },
  ];

  const actions = variant === "home" ? homeActions : walletActions;

  return (
    <div className="px-4" data-testid="quick-actions">
      <div className={`grid ${variant === "home" ? "grid-cols-5 gap-y-4" : "grid-cols-3"} gap-2`}>
        {actions.map((action) => {
          const Icon = action.icon;
          const isWeb = window.location.pathname.startsWith('/web');
          const finalPath = action.path && isWeb && !action.path.startsWith('/web')
            ? `/web${action.path}`
            : action.path || "/";

          if (action.onClick) {
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                className="flex flex-col items-center gap-2"
                data-testid={`action-${action.label.toLowerCase()}`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${action.highlight
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary border-border"
                  }`}>
                  <Icon className={`w-5 h-5 ${action.highlight ? "" : "text-foreground"}`} />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">{action.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={action.label}
              to={finalPath}
              className="flex flex-col items-center gap-2 group"
              data-testid={`action-${action.label.toLowerCase()}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all group-hover:scale-110 ${action.highlight
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary border-border"
                }`}>
                <Icon className={`w-5 h-5 ${action.highlight ? "" : "text-foreground"}`} />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-muted-foreground font-medium group-hover:text-primary transition-colors">{action.label}</span>
                {action.highlight && <span className="text-[8px] text-primary/70 font-bold uppercase tracking-tighter">StableX</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
