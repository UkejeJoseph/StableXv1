import { FileText, MessageCircle, PiggyBank, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const services = [
  {
    icon: FileText,
    title: "Utility Bills",
    description: "Pay your bills easily with the app",
  },
  {
    icon: MessageCircle,
    title: "E-Funds",
    description: "Chat with an agent to trade unlisted assets",
  },
  {
    icon: PiggyBank,
    title: "Savings",
    description: "Maximize your financial growth",
  },
];

export function ServicesList() {
  const { toast } = useToast();

  const handleServiceClick = (title: string) => {
    toast({
      title: "Coming Soon",
      description: `${title} feature will be available soon.`,
    });
  };

  return (
    <Card className="mx-4 p-4" data-testid="services-list">
      <h2 className="text-sm font-semibold text-foreground mb-4">Services</h2>
      <div className="space-y-4">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <button
              key={service.title}
              onClick={() => handleServiceClick(service.title)}
              className="w-full flex items-center justify-between py-2 text-left"
              data-testid={`service-${service.title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Icon className="w-5 h-5 text-navy" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{service.title}</p>
                  <p className="text-xs text-muted-foreground">{service.description}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
