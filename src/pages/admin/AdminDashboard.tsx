import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, CheckCircle, Wallet } from "lucide-react";

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            const token = userInfo.token;

            // Parallel fetch using Promise.all
            const [usersRes, txRes, balRes] = await Promise.all([
                fetch('/api/admin/users?limit=1', { credentials: "include",
         }),
                fetch('/api/admin/transactions?limit=1', { credentials: "include",
         }),
                fetch('/api/admin/system-balances', { credentials: "include",
         })
            ]);

            const [usersData, txData, balData] = await Promise.all([
                usersRes.json(), txRes.json(), balRes.json()
            ]);

            setStats({
                totalUsers: usersData.totalUsers,
                totalTransactions: txData.totalTransactions,
                balances: balData
            });

        } catch (error) {
            console.error("Failed to load admin dashboard stats:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-8 animate-in fade-in duration-500">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
                    <p className="text-muted-foreground mt-2">Platform health and high-level metrics</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="bg-card border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                            <p className="text-xs text-muted-foreground text-green-500 mt-1">Verified accounts</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.totalTransactions || 0}</div>
                            <p className="text-xs text-muted-foreground mt-1">Across all networks</p>
                        </CardContent>
                    </Card>
                </div>

                <div>
                    <h3 className="text-xl font-bold tracking-tight mb-4 mt-8 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-primary" /> System Balances (Liabilities vs Hot Wallets)
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {Object.keys(stats?.balances?.liabilities || {}).map((currency) => (
                            <Card key={currency} className="bg-card border-border/50">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-lg font-bold">{currency}</CardTitle>
                                    <div className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">{stats?.balances?.hotWallets[currency] ? 'Hot Wallet Active' : 'Missing HW'}</div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">User Liabilities (In DB)</p>
                                        <p className="text-2xl font-bold text-red-400">
                                            {stats?.balances?.liabilities[currency]?.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                        </p>
                                    </div>
                                    <div className="pt-2 border-t border-border/40">
                                        <p className="text-xs text-muted-foreground font-mono truncate" title={stats?.balances?.hotWallets[currency]}>
                                            HW: {stats?.balances?.hotWallets[currency]}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
