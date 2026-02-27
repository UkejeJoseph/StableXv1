import { Link, useLocation } from "react-router-dom";
import { Home, Send, QrCode, LayoutDashboard, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/swap", label: "Swap", icon: Repeat },
  { path: "/transfer", label: "Transfer", icon: Send },
  { path: "/qr", label: "QR Pay", icon: QrCode },
  { path: "/merchant", label: "Dashboard", icon: LayoutDashboard },
];

export const Navigation = () => {
  const location = useLocation();

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-6 overflow-x-auto py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
