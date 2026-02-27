import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Gift, Megaphone } from "lucide-react";

export function DashboardSidebarWidgets() {
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [rewards, setRewards] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const userInfoStr = localStorage.getItem("userInfo");
                const token = userInfoStr ? JSON.parse(userInfoStr).token : null;

                const annRes = await fetch("/api/dashboard/announcements");
                const annData = await annRes.json();
                if (annData.success) setAnnouncements(annData.announcements);

                if (token) {
                    const rewRes = await fetch("/api/dashboard/rewards", {
                        credentials: "include",
        
                    });
                    const rewData = await rewRes.json();
                    if (rewData.success) setRewards(rewData.rewards);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="space-y-4">
            {/* Announcements */}
            <Card className="p-4 bg-card border-border/40">
                <div className="flex items-center gap-2 mb-4 text-foreground">
                    <Megaphone className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">Announcements</h3>
                </div>
                <div className="space-y-3">
                    {announcements.map((ann) => (
                        <a key={ann.id} href="#" className="block group">
                            <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors line-clamp-2">
                                {ann.title}
                            </p>
                            <span className="text-[10px] text-muted-foreground/50 mt-1 block">
                                {new Date(ann.date).toLocaleDateString()}
                            </span>
                        </a>
                    ))}
                </div>
            </Card>

            {/* Rewards Hub */}
            <Card className="p-4 bg-gradient-to-br from-card to-card/50 border-border/40 relative overflow-hidden group">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                            <Gift className="w-4 h-4 text-[#F0B90B]" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">Rewards Hub</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                        Invite friends and earn up to 40% commission on their trading fees.
                    </p>
                    {rewards && (
                        <div className="bg-background/50 border rounded-md p-2 mb-4 flex items-center justify-between">
                            <span className="text-xs font-mono text-muted-foreground">{rewards.referralCode}</span>
                            <Button variant="ghost" size="sm" className="h-6 text-xs text-[#F0B90B] hover:text-[#F0B90B]/80 hover:bg-[#F0B90B]/10" onClick={() => navigator.clipboard.writeText(rewards.referralCode)}>
                                Copy
                            </Button>
                        </div>
                    )}
                    <Button className="w-full text-xs" variant="outline">
                        View Details <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                </div>

                {/* Background Decoration */}
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-[#F0B90B] opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity" />
            </Card>
        </div>
    );
}
