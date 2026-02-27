import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  LogOut, Wallet, LayoutGrid, ChevronDown, ChevronRight,
  ArrowDownToLine, ArrowUpFromLine, User, Bell, Search, Globe,
  Home, CreditCard, ArrowLeftRight, TrendingUp, Gift, Coins,
  Bot, Users, Activity, BarChart2, Compass, Briefcase, ArrowDownLeft,
  ArrowUpRight, Link as LinkIcon, MessageSquare, Replace,
  Sun, Moon, Shield, Webhook, Landmark, BookOpen, BadgeCheck, ArrowLeft
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

export function WebLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const userInfoStr = localStorage.getItem("webUserInfo");
  const userInfo = userInfoStr ? JSON.parse(userInfoStr) : null;
  const isMerchant = userInfo?.user?.kycStatus === 'verified';
  const kycLevel = userInfo?.user?.kycLevel || 1;
  const kycStatus = userInfo?.user?.kycStatus || 'pending';

  // Sidebar collapsible states
  const [openAssets, setOpenAssets] = useState(true);
  const [openBuyCrypto, setOpenBuyCrypto] = useState(true);
  const [openServices, setOpenServices] = useState(false);
  const [openSocial, setOpenSocial] = useState(false);
  const [openMerchant, setOpenMerchant] = useState(true);
  const [openTools, setOpenTools] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem("webUserInfo");
    navigate("/web/login");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-[#0b0e11] text-foreground flex flex-col font-sans">

      {/* Top Header - Bybit Style */}
      <header className="h-16 bg-[#12161a] border-b border-border/20 flex items-center justify-between px-4 sticky top-0 z-30">

        {/* Left Side Header Nav */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            {location.pathname !== "/web/dashboard" && location.pathname !== "/dashboard" && location.pathname !== "/" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/web/dashboard")}
                className="text-white hover:bg-white/10 h-8 w-8 mr-2"
                data-testid="button-back-web"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <Link to="/" className="flex items-center gap-2 mr-4">
              <div className="w-8 h-8 bg-[#F0B90B] rounded-md flex items-center justify-center font-bold text-black text-xl">S</div>
              <span className="text-xl font-bold tracking-tight text-white hidden sm:block">StableX</span>
            </Link>
          </div>

          <nav className="hidden lg:flex items-center text-sm font-medium text-muted-foreground gap-1">

            {/* Buy Crypto Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 hover:text-white px-3 py-2 rounded-md outline-none data-[state=open]:text-white">
                Buy Crypto <ChevronDown className="w-4 h-4 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 bg-[#1e2329] border-border/20 text-white">
                <DropdownMenuItem asChild className="hover:bg-white/10 cursor-pointer">
                  <Link to="/web/convert"><ArrowLeftRight className="w-4 h-4 mr-2" /> One-Click Buy</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="hover:bg-white/10 cursor-pointer">
                  <Link to="/web/deposit"><ArrowDownToLine className="w-4 h-4 mr-2" /> Fiat Deposit</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="hover:bg-white/10 cursor-pointer">
                  <Link to="/web/withdraw"><ArrowUpFromLine className="w-4 h-4 mr-2" /> Fiat Withdrawal</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="text-muted-foreground/50 cursor-not-allowed px-3 py-2 rounded-md text-sm">Markets</div>

            {/* Trade Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 hover:text-white px-3 py-2 rounded-md outline-none data-[state=open]:text-white">
                Trade <ChevronDown className="w-4 h-4 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40 bg-[#1e2329] border-border/20 text-white">
                <DropdownMenuItem asChild className="hover:bg-white/10 cursor-pointer">
                  <Link to="/web/trade">Spot Trading</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="hover:bg-white/10 cursor-pointer">
                  <Link to="/web/convert">Convert</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link to="/web/dashboard" className="hover:text-white px-3 py-2 rounded-md transition-colors">Finance</Link>
            <Link to="/web/dashboard" className="hover:text-white px-3 py-2 rounded-md transition-colors">Rewards Hub</Link>
          </nav>
        </div>

        {/* Right Side Header Nav */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center bg-[#1e2329] rounded-full px-3 py-1.5 focus-within:ring-1 ring-[#F0B90B]">
            <Search className="w-4 h-4 text-muted-foreground mr-2" />
            <input
              type="text"
              placeholder="Search coin..."
              className="bg-transparent border-none outline-none text-sm w-32 focus:w-48 transition-all"
            />
          </div>

          <Button asChild size="sm" className="bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-black font-semibold h-8 hidden sm:flex">
            <Link to="/web/deposit">Deposit</Link>
          </Button>

          {/* Assets Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-white outline-none data-[state=open]:text-white hidden lg:flex">
              Assets <ChevronDown className="w-4 h-4 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#1e2329] border-border/20 text-white p-2">
              <div className="flex items-center justify-between px-2 py-2 mb-2 border-b border-border/20">
                <span className="text-sm font-semibold">Total Equity</span>
                <Link to="/web/dashboard" className="text-xs text-[#F0B90B] hover:underline">Overview</Link>
              </div>
              <DropdownMenuItem asChild className="hover:bg-white/10 cursor-pointer justify-between">
                <Link to="/web/wallet"><span>Funding</span> <span className="text-muted-foreground">0.00</span></Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="hover:bg-white/10 cursor-pointer justify-between">
                <Link to="/web/trade"><span>Spot</span> <span className="text-muted-foreground">0.00</span></Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Orders Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-white outline-none data-[state=open]:text-white hidden lg:flex">
              Orders <ChevronDown className="w-4 h-4 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-[#1e2329] border-border/20 text-white">
              <DropdownMenuItem asChild className="hover:bg-white/10 cursor-pointer">
                <Link to="/web/orders">Spot Orders</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="hover:bg-white/10 cursor-pointer">
                <Link to="/web/orders">Buy Crypto History</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white h-8 w-8 hidden sm:flex">
            <Bell className="w-5 h-5" />
          </Button>

          {/* Unified Profile Dropdown (Mobile & Desktop) */}
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <div className="w-8 h-8 rounded-full bg-muted/30 border border-border/50 flex items-center justify-center font-bold text-[#F0B90B] text-sm hover:border-[#F0B90B] cursor-pointer transition-colors">
                {userInfo?.user?.firstName?.[0] || userInfo?.user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-[#1e2329] border-border/20 text-white p-2 z-50">
              <div className="px-2 py-3 border-b border-border/20 mb-2">
                <p className="font-semibold text-sm">{userInfo?.user?.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded ${kycStatus === 'verified' ? 'bg-green-500/20 text-green-500' : kycStatus === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {kycStatus === 'verified' ? '✓ Verified' : kycStatus === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                  </span>
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded flex items-center gap-1">
                    <Shield className="w-3 h-3" /> KYC Lv.{kycLevel}
                  </span>
                  <span className="text-xs text-muted-foreground">UID: {userInfo?.user?._id?.slice(-8).toUpperCase()}</span>
                </div>
              </div>

              {/* Merchant Access Button */}
              {isMerchant && (
                <DropdownMenuItem asChild className="hover:bg-white/10 cursor-pointer text-[#F0B90B] font-medium mb-1 border border-[#F0B90B]/30 rounded-lg p-2 flex items-center justify-between">
                  <Link to="/web/merchant">
                    <div className="flex items-center">
                      <Globe className="w-4 h-4 mr-2" /> Merchant Dashboard
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem asChild className="hover:bg-white/10 cursor-pointer">
                <Link to="/web/account"><User className="w-4 h-4 mr-2" /> Account & Security</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/20" />
              <DropdownMenuItem onClick={handleLogout} className="hover:bg-red-500/20 text-red-400 cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </header>

      {/* Main Body with Sidebar */}
      <div className="flex flex-1 overflow-hidden">

        {/* Deep Navigation Left Sidebar */}
        <aside className="w-64 bg-[#12161a] border-r border-border/20 hidden lg:flex flex-col h-[calc(100vh-4rem)] overflow-y-auto z-20">
          <nav className="flex-1 px-3 py-6 space-y-6">

            {/* Unified Trading / Assets */}
            <Collapsible open={openAssets} onOpenChange={setOpenAssets} className="space-y-1">
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-white transition-colors group">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  My Assets
                </div>
                {openAssets ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pl-6 pt-1">
                <Link
                  to="/web/dashboard"
                  className={`block px-3 py-2 text-sm rounded-md transition-colors ${isActive('/web/dashboard') ? 'bg-[#F0B90B]/10 text-[#F0B90B] font-medium' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                >
                  Overview
                </Link>
                <Link
                  to="/web/wallet"
                  className={`block px-3 py-2 text-sm rounded-md transition-colors ${isActive('/web/wallet') ? 'bg-[#F0B90B]/10 text-[#F0B90B] font-medium' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                >
                  Funding
                </Link>
                <Link
                  to="/web/trade"
                  className={`block px-3 py-2 text-sm rounded-md transition-colors ${isActive('/web/trade') ? 'bg-[#F0B90B]/10 text-[#F0B90B] font-medium' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                >
                  Spot
                </Link>
              </CollapsibleContent>
            </Collapsible>

            {/* Buy Crypto Section */}
            <Collapsible open={openBuyCrypto} onOpenChange={setOpenBuyCrypto} className="space-y-1">
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-white transition-colors group">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Buy Crypto
                </div>
                {openBuyCrypto ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pl-6 pt-1">
                <Link
                  to="/web/convert"
                  className={`block px-3 py-2 text-sm rounded-md transition-colors ${isActive('/web/convert') ? 'bg-[#F0B90B]/10 text-[#F0B90B] font-medium' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                >
                  One-Click Buy
                </Link>
                <Link
                  to="/web/deposit"
                  className={`block px-3 py-2 text-sm rounded-md transition-colors ${isActive('/web/deposit') ? 'bg-[#F0B90B]/10 text-[#F0B90B] font-medium' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                >
                  Fiat Deposit
                </Link>
                <Link
                  to="/web/withdraw"
                  className={`block px-3 py-2 text-sm rounded-md transition-colors ${isActive('/web/withdraw') ? 'bg-[#F0B90B]/10 text-[#F0B90B] font-medium' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                >
                  Fiat Withdrawal
                </Link>
              </CollapsibleContent>
            </Collapsible>

            {/* Services Section */}
            <Collapsible open={openServices} onOpenChange={setOpenServices} className="space-y-1">
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-white transition-colors group">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  Services
                </div>
                {openServices ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pl-6 pt-1">
                <Link to="/web/dashboard" className="block px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:text-white hover:bg-white/5 flex items-center gap-2">
                  <Gift className="w-3.5 h-3.5" /> Rewards Hub
                </Link>
                <Link to="/web/dashboard" className="block px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:text-white hover:bg-white/5 flex items-center gap-2">
                  <Coins className="w-3.5 h-3.5" /> Earn
                </Link>
                <Link to="/web/dashboard" className="block px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:text-white hover:bg-white/5 flex items-center gap-2">
                  <Bot className="w-3.5 h-3.5" /> Trading Bots
                </Link>
              </CollapsibleContent>
            </Collapsible>

            {/* Merchant Navigations */}
            <>
              {/* Tools Section */}
              <Collapsible open={openTools} onOpenChange={setOpenTools} className="space-y-1">
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-white transition-colors group">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-[#F0B90B]" />
                    Business Tools
                  </div>
                  {openTools ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pl-6 pt-1">
                  <Link to="/web/convert" className={`block px-3 py-2 text-sm rounded-md transition-colors ${isActive('/web/convert') ? 'bg-[#F0B90B]/10 text-[#F0B90B] font-medium' : 'text-muted-foreground hover:text-white hover:bg-white/5'} flex items-center gap-2`}>
                    <Replace className="w-3.5 h-3.5" /> Conversions
                  </Link>
                  <Link to="/web/dashboard" className={`block px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:text-white hover:bg-white/5 flex items-center gap-2`}>
                    <LinkIcon className="w-3.5 h-3.5" /> Payment Links
                  </Link>
                  <button
                    onClick={() => document.getElementById('chat-widget-trigger')?.click()}
                    className="w-full text-left block px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:text-white hover:bg-white/5 flex items-center gap-2"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-blue-400" /> StableX AI Chat
                  </button>
                </CollapsibleContent>
              </Collapsible>

              {/* Merchant Transactions */}
              <Collapsible open={openMerchant} onOpenChange={setOpenMerchant} className="space-y-1">
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-white transition-colors group">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#F0B90B]" />
                    Merchant Transactions
                  </div>
                  {openMerchant ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pl-6 pt-1">
                  <Link to="/web/merchant" className={`block px-3 py-2 text-sm rounded-md transition-colors ${isActive('/web/merchant') ? 'bg-[#F0B90B]/10 text-[#F0B90B] font-medium' : 'text-muted-foreground hover:text-white hover:bg-white/5'} flex items-center gap-2`}>
                    <Globe className="w-3.5 h-3.5" /> Merchant API
                  </Link>
                  <Link to="/web/merchant/pay-ins" className={`block px-3 py-2 text-sm rounded-md transition-colors ${isActive('/web/merchant/pay-ins') ? 'bg-[#F0B90B]/10 text-[#F0B90B] font-medium' : 'text-muted-foreground hover:text-white hover:bg-white/5'} flex items-center gap-2`}>
                    <ArrowDownLeft className="w-3.5 h-3.5" /> Pay-ins
                  </Link>
                  <Link to="/web/merchant/payouts" className={`block px-3 py-2 text-sm rounded-md transition-colors ${isActive('/web/merchant/payouts') ? 'bg-[#F0B90B]/10 text-[#F0B90B] font-medium' : 'text-muted-foreground hover:text-white hover:bg-white/5'} flex items-center gap-2`}>
                    <ArrowUpRight className="w-3.5 h-3.5" /> Payouts
                  </Link>
                  <Link to="/web/merchant/settlements" className={`block px-3 py-2 text-sm rounded-md transition-colors ${isActive('/web/merchant/settlements') ? 'bg-[#F0B90B]/10 text-[#F0B90B] font-medium' : 'text-muted-foreground hover:text-white hover:bg-white/5'} flex items-center gap-2`}>
                    <Landmark className="w-3.5 h-3.5" /> Settlements
                  </Link>
                  <Link to="/web/merchant/webhooks" className={`block px-3 py-2 text-sm rounded-md transition-colors ${isActive('/web/merchant/webhooks') ? 'bg-[#F0B90B]/10 text-[#F0B90B] font-medium' : 'text-muted-foreground hover:text-white hover:bg-white/5'} flex items-center gap-2`}>
                    <Webhook className="w-3.5 h-3.5" /> Webhooks
                  </Link>
                  <Link to="/web/merchant/guidelines" className={`block px-3 py-2 text-sm rounded-md transition-colors ${isActive('/web/merchant/guidelines') ? 'bg-[#F0B90B]/10 text-[#F0B90B] font-medium' : 'text-muted-foreground hover:text-white hover:bg-white/5'} flex items-center gap-2`}>
                    <BookOpen className="w-3.5 h-3.5" /> Guidelines
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            </>

            {/* Markets & Social */}
            <Collapsible open={openSocial} onOpenChange={setOpenSocial} className="space-y-1">
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-white transition-colors group">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Markets & Social
                </div>
                {openSocial ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pl-6 pt-1">
                <Link to="/web/dashboard" className="block px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:text-white hover:bg-white/5 flex items-center gap-2">
                  <BarChart2 className="w-3.5 h-3.5" /> Leaderboards
                </Link>
                <Link to="/web/dashboard" className="block px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:text-white hover:bg-white/5 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" /> Copy Trading
                </Link>
                <Link to="/web/dashboard" className="block px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:text-white hover:bg-white/5 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5" /> Alpha Signals
                </Link>
              </CollapsibleContent>
            </Collapsible>

          </nav>

          <div className="p-4 mt-auto mb-4 space-y-3">
            {/* Dark/Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#1e2329] rounded-xl border border-border/10 hover:border-[#F0B90B]/30 transition-colors group"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-white">
                {theme === 'dark' ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-yellow-400" />}
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-blue-500/30' : 'bg-yellow-500/30'}`}>
                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${theme === 'dark' ? 'left-0.5' : 'left-[22px]'}`} />
              </div>
            </button>

            <div className="bg-[#1e2329] p-4 rounded-xl border border-border/10">
              <h4 className="text-sm font-semibold text-white mb-2">Need Help?</h4>
              <p className="text-xs text-muted-foreground mb-3">Contact support or view our guides.</p>
              <Button size="sm" variant="outline" className="w-full h-8 text-xs border-border/30">
                Help Center
              </Button>
            </div>
          </div>
        </aside>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto h-[calc(100vh-4rem)] bg-[#0b0e11] relative">
          <div className="w-full max-w-[1400px] mx-auto p-4 lg:p-6 lg:pl-10 pb-24 lg:pb-20">
            {children}
          </div>
        </main>

      </div>

      {/* Mobile Bottom Navigation (Binance/Bybit Style) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#12161a] border-t border-border/20 flex items-center justify-around z-40 px-2 pb-safe">
        <Link to="/web/dashboard" className={`flex flex-col items-center justify-center gap-1 w-16 h-full ${isActive('/web/dashboard') ? 'text-[#F0B90B]' : 'text-muted-foreground hover:text-white'}`}>
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        <div className="flex flex-col items-center justify-center gap-1 w-16 h-full text-muted-foreground/30 cursor-not-allowed">
          <BarChart2 className="w-5 h-5" />
          <span className="text-[10px] font-medium">Markets</span>
        </div>
        <Link to="/web/trade" className={`flex flex-col items-center justify-center gap-1 w-16 h-full ${isActive('/web/trade') ? 'text-[#F0B90B]' : 'text-muted-foreground hover:text-white'}`}>
          <ArrowLeftRight className="w-5 h-5" />
          <span className="text-[10px] font-medium">Trade</span>
        </Link>
        <Link to="/web/dashboard" className={`flex flex-col items-center justify-center gap-1 w-16 h-full ${isActive('/web/discover') ? 'text-[#F0B90B]' : 'text-muted-foreground hover:text-white'}`}>
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-medium">Discover</span>
        </Link>
        <Link to="/web/wallet" className={`flex flex-col items-center justify-center gap-1 w-16 h-full ${isActive('/web/wallet') ? 'text-[#F0B90B]' : 'text-muted-foreground hover:text-white'}`}>
          <Wallet className="w-5 h-5" />
          <span className="text-[10px] font-medium">Assets</span>
        </Link>
      </nav>

    </div>
  );
}
