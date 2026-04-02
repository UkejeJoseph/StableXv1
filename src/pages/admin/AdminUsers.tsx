import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ShieldCheck, User as UserIcon, Loader2, Search, ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

interface UserData {
    _id: string;
    username: string;
    email: string;
    kycLevel: number;
    role: string;
    totalActiveWallets: number;
    createdAt: string;
}

export default function AdminUsers() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userStats, setUserStats] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        userId: string;
        field: "kycLevel" | "role";
        value: string | number;
        userName: string;
    }>({ open: false, userId: "", field: "kycLevel", value: 0, userName: "" });
    const { toast } = useToast();

    useEffect(() => {
        fetchUsers();
        fetchUserStats();
    }, []);

    const fetchUserStats = async () => {
        try {
            const res = await apiFetch('/api/admin/user-stats');
            const data = await res.json();
            if (data.success) setUserStats(data.stats);
        } catch (err) {
            console.error('Failed to fetch user stats:', err);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await apiFetch('/api/admin/users?limit=50');
            const data = await res.json();
            if (data.users) setUsers(data.users);
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

    const promptUpdate = (userId: string, field: "kycLevel" | "role", value: string | number, userName: string) => {
        setConfirmDialog({ open: true, userId, field, value, userName });
    };

    const handleUpdateUser = async () => {
        const { userId, field, value } = confirmDialog;
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setUpdatingUserId(userId);

        try {
            const body: Record<string, any> = {};
            body[field] = field === "kycLevel" ? Number(value) : value;

            const res = await apiFetch(`/api/admin/users/${userId}/kyc`, {
                method: "PUT",
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (res.ok) {
                toast({
                    title: "User Updated",
                    description: `${field === "kycLevel" ? "KYC Level" : "Role"} changed to ${value} for @${data.username || "user"}.`,
                });
                // Update local state
                setUsers(prev => prev.map(u =>
                    u._id === userId ? { ...u, [field]: field === "kycLevel" ? Number(value) : value } : u
                ));
            } else {
                throw new Error(data.message || data.error || "Update failed");
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Update Failed",
                description: error.message || "Could not update user.",
            });
        } finally {
            setUpdatingUserId(null);
        }
    };

    const filteredUsers = users.filter(u =>
        !searchQuery ||
        u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const kycBadgeColor = (level: number) => {
        if (level >= 3) return "bg-green-500/10 text-green-500 border-green-500/30";
        if (level >= 2) return "bg-blue-500/10 text-blue-500 border-blue-500/30";
        if (level >= 1) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
        return "bg-red-500/10 text-red-400 border-red-500/30";
    };

    const roleBadgeColor = (role: string) => {
        if (role === "admin") return "bg-purple-500/10 text-purple-400 border-purple-500/30";
        if (role === "merchant") return "bg-[#F0B90B]/10 text-[#F0B90B] border-[#F0B90B]/30";
        return "bg-muted text-muted-foreground border-border/50";
    };

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading users...</p>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Users & KYC</h2>
                        <p className="text-muted-foreground mt-1">Manage customer accounts, KYC levels, and roles.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 w-60 bg-card border-border/50"
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setIsLoading(true); fetchUsers(); }}>
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Stats Row */}
                {userStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4 bg-card/60 border-border/40">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Users</p>
                            <p className="text-2xl font-black text-foreground mt-1">{userStats.totalUsers || users.length}</p>
                        </Card>
                        <Card className="p-4 bg-card/60 border-border/40">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">KYC Verified</p>
                            <p className="text-2xl font-black text-green-500 mt-1">{userStats.verifiedCount || users.filter(u => u.kycLevel >= 2).length}</p>
                        </Card>
                        <Card className="p-4 bg-card/60 border-border/40">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Merchants</p>
                            <p className="text-2xl font-black text-[#F0B90B] mt-1">{userStats.merchantCount || users.filter(u => u.role === 'merchant').length}</p>
                        </Card>
                        <Card className="p-4 bg-card/60 border-border/40">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Admins</p>
                            <p className="text-2xl font-black text-purple-400 mt-1">{userStats.adminCount || users.filter(u => u.role === 'admin').length}</p>
                        </Card>
                    </div>
                )}

                <Card className="bg-card border-border/50">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>KYC Level</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Wallets</TableHead>
                                    <TableHead>Joined</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map((user) => (
                                    <TableRow key={user._id} className={updatingUserId === user._id ? "opacity-50" : ""}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                                    {user.role === 'admin' ? (
                                                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                                                    ) : (
                                                        <UserIcon className="w-4 h-4 text-primary" />
                                                    )}
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

                                        {/* KYC Level Dropdown */}
                                        <TableCell>
                                            <Select
                                                value={String(user.kycLevel || 0)}
                                                onValueChange={(val) => promptUpdate(user._id, "kycLevel", val, user.username || user.email)}
                                                disabled={updatingUserId === user._id}
                                            >
                                                <SelectTrigger className={`w-28 h-8 text-xs font-bold border ${kycBadgeColor(user.kycLevel || 0)}`}>
                                                    <SelectValue placeholder="Tier" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">Tier 0 — None</SelectItem>
                                                    <SelectItem value="1">Tier 1 — Basic</SelectItem>
                                                    <SelectItem value="2">Tier 2 — Verified</SelectItem>
                                                    <SelectItem value="3">Tier 3 — Full</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>

                                        {/* Role Dropdown */}
                                        <TableCell>
                                            <Select
                                                value={user.role || "user"}
                                                onValueChange={(val) => promptUpdate(user._id, "role", val, user.username || user.email)}
                                                disabled={updatingUserId === user._id}
                                            >
                                                <SelectTrigger className={`w-28 h-8 text-xs font-bold border ${roleBadgeColor(user.role)}`}>
                                                    <SelectValue placeholder="Role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="user">User</SelectItem>
                                                    <SelectItem value="merchant">Merchant</SelectItem>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>

                                        <TableCell>
                                            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                                                {user.totalActiveWallets || 0} active
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '--'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            {searchQuery ? `No users matching "${searchQuery}"` : "No users found."}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Confirmation Dialog */}
            <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirm User Update</DialogTitle>
                        <DialogDescription>
                            {confirmDialog.field === "kycLevel"
                                ? `Change KYC level for @${confirmDialog.userName} to Tier ${confirmDialog.value}?`
                                : `Change role for @${confirmDialog.userName} to "${confirmDialog.value}"?`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateUser}>
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
