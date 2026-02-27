import { Bell, Wallet, TrendingUp, Gift, Moon, Sun, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "./ThemeProvider";

interface HeaderProps {
  userInitials?: string;
  currency?: string;
  onCurrencyChange?: (currency: string) => void;
}

export function Header({ userInitials = "JU", currency = "NGN", onCurrencyChange }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const isWeb = location.pathname.startsWith('/web');
  const showBackButton = location.pathname !== "/" && location.pathname !== "/dashboard" && location.pathname !== "/web/dashboard";

  const getDynamicPath = (path: string) => {
    if (isWeb && !path.startsWith('/web')) {
      return `/web${path}`;
    }
    return path;
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-card border-b border-border" data-testid="header">
      <div className="flex items-center gap-3">
        {showBackButton ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="mr-1 h-8 w-8"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        ) : (
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center text-white font-bold text-sm" data-testid="logo">
              SX
            </div>
            <span className="font-bold text-lg text-foreground">StableX</span>
          </Link>
        )}
        <div className="flex items-center gap-1.5 ml-1 px-2.5 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm border border-green-500/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Live
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </Button>
        <Link to={getDynamicPath("/wallet")}>
          <Button variant="ghost" size="icon" data-testid="button-wallet">
            <Wallet className="w-5 h-5" />
          </Button>
        </Link>
        <Link to={getDynamicPath("/trade")}>
          <Button variant="ghost" size="icon" data-testid="button-trade">
            <TrendingUp className="w-5 h-5" />
          </Button>
        </Link>
        <Link to={getDynamicPath("/giftcard")}>
          <Button variant="ghost" size="icon" data-testid="button-giftcard">
            <Gift className="w-5 h-5" />
          </Button>
        </Link>
        <Button variant="ghost" size="icon" data-testid="button-notifications">
          <Bell className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
