import { useState, useEffect } from "react";
import {
  Building2,
  ArrowLeftRight,
  FileText,
  Shield,
  Settings,
  Gift,
  FileCheck,
  HelpCircle,
  ChevronRight,
  LogOut,
  Star
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallets } from "@/hooks/useWallets";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";

const settingsItems = [
  { icon: Building2, label: "Bank Account", path: "/settings/bank" },
  { icon: ArrowLeftRight, label: "Transfer Limits", path: "/settings/limits" },
  { icon: FileText, label: "Update KYC", path: "/settings/kyc" },
  { icon: Shield, label: "Security", path: "/settings/security" },
  { icon: Settings, label: "Preferences", path: "/settings/preferences" },
  { icon: Gift, label: "Refer & Earn", path: "/settings/referral" },
];

const otherItems = [
  { icon: FileCheck, label: "Terms & Conditions", path: "/terms" },
  { icon: HelpCircle, label: "Help & Support", path: "/support" },
];

export default function Account() {
  const { user, logout } = useUser();
  const [walletCount, setWalletCount] = useState(0);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const userEmail = user?.email || 'Not logged in';
  const userInitials = userEmail !== 'Not logged in'
    ? userEmail.substring(0, 2).toUpperCase()
    : '??';

  const { data: storedWallets = [] } = useWallets();

  useEffect(() => {
    setWalletCount(storedWallets.length);
  }, [storedWallets]);

  // Redirect to login if no user info
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      // Clear the react query cache to remove cached balances/wallets
      queryClient.clear();
      // Redirect to login page
      navigate("/login");
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-background">
      <div className="bg-navy text-white px-4 py-8 rounded-b-3xl">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold mb-3" data-testid="account-avatar">
            {userInitials}
          </div>
          <h1 className="text-xl font-bold" data-testid="account-name">{userEmail.split('@')[0]}</h1>
          <p className="text-sm text-white/70" data-testid="account-email">{userEmail}</p>
          <p className="text-sm text-white/70" data-testid="account-username">@{userEmail.split('@')[0]}</p>

          <Card className="w-full mt-6 bg-white/10 border-0 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                  <Star className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium">Standard</span>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-1">
                  <Shield className="w-4 h-4" />
                </div>
                <span className="text-xs">Provisioned</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-white/70">KYC Lvl</span>
                <div className="bg-white/20 rounded-full px-3 py-1 mt-1">
                  <span className="text-xs font-medium">Lvl {walletCount > 0 ? 1 : 0}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="px-4 py-6">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Settings</h2>
        <div className="space-y-1">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.label}
                variant="ghost"
                className="w-full justify-between h-12 px-0"
                data-testid={`settings-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-navy" />
                  <span className="text-foreground">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-6">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Others</h2>
        <div className="space-y-1">
          {otherItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.label}
                variant="ghost"
                className="w-full justify-between h-12 px-0"
                data-testid={`other-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-navy" />
                  <span className="text-foreground">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-6">
        <Button
          variant="outline"
          className="w-full text-destructive border-destructive"
          data-testid="button-logout"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>
    </div>
  );
}
