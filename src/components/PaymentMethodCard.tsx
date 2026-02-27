import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReactNode } from "react";

interface PaymentMethodCardProps {
    id: string;
    title: string;
    icon: ReactNode;
    processingTime: string;
    fee: string;
    limits: string;
    recommended?: boolean;
    onClick: (id: string) => void;
}

export function PaymentMethodCard({
    id,
    title,
    icon,
    processingTime,
    fee,
    limits,
    recommended,
    onClick
}: PaymentMethodCardProps) {
    return (
        <Card
            onClick={() => onClick(id)}
            className="bg-card border-border/50 hover:border-primary/50 cursor-pointer transition-all hover:bg-white/5 active:scale-[0.98] group relative overflow-hidden"
        >
            <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-sm">
                            {icon}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{title}</span>
                        </div>
                    </div>
                    {recommended && (
                        <Badge variant="outline" className="border-green-500/30 text-green-500 bg-green-500/10 text-[10px] font-medium tracking-wide px-2 shrink-0">
                            Recommended
                        </Badge>
                    )}
                </div>

                <div className="space-y-2 mt-4 text-xs">
                    <div className="flex justify-between items-center text-muted-foreground">
                        <span>Processing time</span>
                        <span className="text-foreground font-medium">{processingTime}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                        <span>Fee</span>
                        <span className="text-foreground font-medium">{fee}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                        <span>Limits</span>
                        <span className="text-foreground font-medium">{limits}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
