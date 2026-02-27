import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Globe, ChevronDown } from "lucide-react";

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-[100] bg-background/80 backdrop-blur-md border-b border-border/50 h-16 sm:h-20">
      <div className="max-w-[1400px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              SX
            </div>
            <span className="font-bold text-lg sm:text-xl text-foreground">StableX</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-6">
            <Link to="#" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors flex items-center gap-1">
              Buy Crypto <ChevronDown className="w-3 h-3" />
            </Link>
            <Link to="#" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Markets</Link>
            <Link to="#" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors flex items-center gap-1">
              Trade <ChevronDown className="w-3 h-3" />
            </Link>
            <Link to="#" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">StableX Earn</Link>
            <Link to="#" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Institutional</Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/web/login">
            <Button variant="ghost" className="text-sm font-bold hover:text-primary">
              Log In
            </Button>
          </Link>
          <Link to="/web/signup" className="hidden sm:block">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6">
              Register
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="text-foreground/60 hidden md:flex">
             <Globe className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
