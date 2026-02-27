import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
    className?: string;
    variant?: "ghost" | "outline" | "default";
    size?: "default" | "sm" | "lg" | "icon";
}

export function BackButton({ className, variant = "ghost", size = "icon" }: BackButtonProps) {
    const navigate = useNavigate();

    return (
        <Button
            variant={variant}
            size={size}
            onClick={() => navigate(-1)}
            className={className}
            data-testid="button-back-component"
        >
            <ArrowLeft className="w-5 h-5" />
        </Button>
    );
}
