import { useLocation, Link } from "react-router-dom";
import { Home, ArrowLeftRight, QrCode, Banknote, User } from "lucide-react";

const navItems = [
  { path: "/dashboard", label: "Home", icon: Home },
  { path: "/convert", label: "Convert", icon: ArrowLeftRight },
  { path: "/qr", label: "QR", icon: QrCode },
  { path: "/withdraw", label: "Withdraw", icon: Banknote },
  { path: "/account", label: "Account", icon: User },
];

export function BottomNav() {
  const location = useLocation();

  const hideNav = ["/", "/login", "/signup", "/verify"].includes(location.pathname);
  if (hideNav) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 md:hidden" data-testid="bottom-nav">
      <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isWeb = location.pathname.startsWith('/web');
          const finalPath = isWeb && !item.path.startsWith('/web') ? `/web${item.path}` : item.path;
          const isActive = location.pathname === finalPath || location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={finalPath}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
                }`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
