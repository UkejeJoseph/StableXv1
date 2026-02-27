import { Link, useLocation } from "react-router-dom";
import {
    LayoutDashboard,
    Users,
    Activity,
    Settings,
    LogOut,
    ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
    children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
    const location = useLocation();
    const currentPath = location.pathname;

    const navigation = [
        { name: "Overview", href: "/web/admin", icon: LayoutDashboard },
        { name: "Users & KYC", href: "/web/admin/users", icon: Users },
        { name: "Global Ledger", href: "/web/admin/transactions", icon: Activity },
        { name: "System Settings", href: "/web/admin/settings", icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-card border-r border-border/40 hidden md:flex flex-col">
                <div className="p-6 flex items-center gap-3 border-b border-border/40">
                    <ShieldAlert className="w-8 h-8 text-primary" />
                    <h1 className="text-xl font-bold font-heading hidden lg:block">StableX Admin</h1>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navigation.map((item) => {
                        const isActive = currentPath === item.href || (item.href !== '/web/admin' && currentPath.startsWith(item.href));
                        const Icon = item.icon;

                        return (
                            <Link key={item.name} to={item.href}>
                                <Button
                                    variant={isActive ? "secondary" : "ghost"}
                                    className={`w-full justify-start gap-4 ${isActive ? 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary' : 'hover:bg-muted/50 text-muted-foreground'}`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="hidden lg:inline">{item.name}</span>
                                </Button>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-border/40">
                    <Link to="/web/dashboard">
                        <Button variant="outline" className="w-full justify-start gap-4 text-muted-foreground border-border/50">
                            <LogOut className="w-5 h-5" />
                            <span className="hidden lg:inline">Exit Admin</span>
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                <main className="flex-1 p-6 lg:p-10">
                    {children}
                </main>
            </div>
        </div>
    );
}
