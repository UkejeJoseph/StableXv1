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
    const { toast } = useToast();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            const res = await fetch('/api/admin/users?limit=50', {
                credentials: "include",
        
            });
            const data = await res.json();
            setUsers(data.users);
        } catch (error) {
            console.error("Failed to load users", error);
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
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Users & KYC</h2>
                    <p className="text-muted-foreground mt-2">Manage customer accounts and view wallet stats.</p>
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
                                    <TableHead>Total NGN Vol</TableHead>
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
                                                    <p className="font-medium text-sm">@{user.username}</p>
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
                                                Tier {user.kycLevel}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                                                {user.totalActiveWallets} active
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                            {/* Placeholder for future aggregation query */}
                                            --
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {user.role === 'admin' && (
                                                <div className="flex justify-end pr-2">
                                                    <ShieldCheck className="w-5 h-5 text-green-500" title="Admin User" />
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
