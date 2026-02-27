import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Copy, ShieldCheck, User as UserIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AdminUsers() {
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userStats, setUserStats] = useState<any>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetchUsers();
        fetchUserStats();
    }, []);

    const fetchUserStats = async () => {
        try {
            const res = await fetch('/api/admin/user-stats', {
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                setUserStats(data.stats);
            }
        } catch (err) {
            console.error('Failed to fetch user stats:', err);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users?limit=50', {
                credentials: "include",
            });
            const data = await res.json();
            if (data.users) {
                setUsers(data.users);
            }
        } catch (error) {
            console.error("Failed to load users", error);
            toast({ variant: "destructive", title: "Load Failed", description: "Could not fetch users list." });
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!", description: "Value copied to clipboard" });
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
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Users & KYC</h2>
                        <p className="text-muted-foreground mt-2">Manage customer accounts and view wallet stats.</p>
                    </div>
                </div>

                <Card className="bg-card border-border/50">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>KYC Level</TableHead>
                                    <TableHead>Wallets</TableHead>
                                    <TableHead>Joined On</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user._id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                                    <UserIcon className="w-4 h-4 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">@{user.username || 'unknown'}</p>
                                                    <p className="text-xs text-muted-foreground">ID: {user._id.slice(-6)}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm text-foreground/80">
                                                {user.email}
                                                <button onClick={() => copyToClipboard(user.email)}>
                                                    <Copy className="w-3 h-3 text-muted-foreground hover:text-primary transition-colors" />
                                                </button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.kycLevel > 1 ? "default" : "secondary"}>
                                                Tier {user.kycLevel || 0}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                                                {user.totalActiveWallets || 0} active
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '--'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {user.role === 'admin' && (
                                                <div className="flex justify-end pr-2">
                                                    <ShieldCheck className="w-5 h-5 text-green-500" />
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {users.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No users found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
