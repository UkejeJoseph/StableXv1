import { useLocation, Link } from "react-router-dom";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen pb-20 px-4 bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-navy mb-4" data-testid="text-404">404</h1>
        <p className="text-xl text-foreground mb-2">Page not found</p>
        <p className="text-muted-foreground mb-6">
          The page "{location.pathname}" doesn't exist
        </p>
        <Link to="/">
          <Button className="bg-navy" data-testid="button-go-home">
            <Home className="w-4 h-4 mr-2" />
            Return to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
