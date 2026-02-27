import {
    Gift,
    Coins,
    Bot,
    MessageSquare,
    LayoutGrid,
    TrendingUp,
    Users
} from "lucide-react";
import { Link } from "react-router-dom";

export function QuickActionsGrid() {
    const actions = [
        { name: "Rewards Hub", icon: Gift, to: "#", color: "text-amber-500", bg: "bg-amber-500/10" },
        { name: "Earn", icon: Coins, to: "#", color: "text-yellow-500", bg: "bg-yellow-500/10" },
        { name: "Trading Bots", icon: Bot, to: "#", color: "text-blue-500", bg: "bg-blue-500/10" },
        { name: "Copy Trading", icon: Users, to: "#", color: "text-purple-500", bg: "bg-purple-500/10" },
        { name: "More", icon: LayoutGrid, to: "#", color: "text-muted-foreground", bg: "bg-muted/50" },
    ];

    return (
        <div className="grid grid-cols-5 gap-2 md:gap-4 py-2">
            {actions.map((action, index) => {
                const Icon = action.icon;
                const isWeb = window.location.pathname.startsWith('/web');
                const finalPath = action.to && isWeb && !action.to.startsWith('/web') && action.to !== "#"
                    ? `/web${action.to}`
                    : action.to;

                return (
                    <Link
                        key={index}
                        to={finalPath}
                        className="flex flex-col items-center justify-center gap-2 group cursor-pointer transition-transform hover:scale-105"
                    >
                        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center ${action.bg} transition-colors group-hover:bg-white/10`}>
                            <Icon className={`w-6 h-6 md:w-7 md:h-7 ${action.color}`} />
                        </div>
                        <span className="text-[10px] md:text-xs font-medium text-muted-foreground group-hover:text-white text-center whitespace-nowrap">
                            {action.name}
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}
