import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "./lib/wagmi";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeProvider";
import { BottomNav } from "./components/BottomNav";
import { SplashScreen } from "./components/SplashScreen";
import { SpaceBackground } from "./components/SpaceBackground";
import { PageTransition } from "./components/PageTransition";
import { AnimatePresence } from "framer-motion";
import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Trade from "./pages/Trade";
import Wallet from "./pages/Wallet";
import Giftcard from "./pages/Giftcard";
import Account from "./pages/Account";
import CreateWallet from "./pages/CreateWallet";
import Convert from "./pages/Convert";
import QRCodePage from "./pages/QRCode";
import Withdraw from "./pages/Withdraw";
import Deposit from "./pages/Deposit";
import Earn from "./pages/Earn";
import Transfer from "./pages/Transfer";
import StableXSecure from "./pages/StableXSecure";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyOtp from "./pages/VerifyOtp";
import ProtectedRoute from "./components/ProtectedRoute";
import { AIChatWidget } from "./components/AIChatWidget";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";

// Web Versions
import WebLogin from "./pages/web/WebLogin";
import WebSignup from "./pages/web/WebSignup";
import WebVerifyOtp from "./pages/web/WebVerifyOtp";
import AuthCallback from "./pages/web/AuthCallback";
import WebPayPage from "./pages/web/WebPayPage";
import WebDashboard from "./pages/web/WebDashboard";
import WebMerchantDashboard from "./pages/web/WebMerchantDashboard";
import WebMerchantPayIns from "./pages/web/WebMerchantPayIns";
import WebMerchantPayouts from "./pages/web/WebMerchantPayouts";
import WebMerchantGuidelines from "./pages/web/WebMerchantGuidelines";
import WebMerchantWebhooks from "./pages/web/WebMerchantWebhooks";
import WebMerchantSettlements from "./pages/web/WebMerchantSettlements";
import CheckoutWidget from "./pages/CheckoutWidget";
import WebTrade from "./pages/web/WebTrade";
import WebConvert from "./pages/web/WebConvert";
import WebDeposit from "./pages/web/WebDeposit";
import WebWithdraw from "./pages/web/WebWithdraw";
import WebWallet from "./pages/web/WebWallet";
import WebAccount from "./pages/web/WebAccount";
import WebOrders from "./pages/web/WebOrders";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminTransactions from "./pages/admin/AdminTransactions";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();
  const isAuthPage = ['/login', '/signup', '/verify'].includes(location.pathname);
  const isWebMode = location.pathname.startsWith('/web');
  const isLandingPage = location.pathname === '/';

  return (
    <>
      {/* 3D Background: full on auth/landing pages, subtle on app pages */}
      <SpaceBackground intensity={isAuthPage || isLandingPage || isWebMode ? 'full' : 'subtle'} />

      <div className={`min-h-screen relative ${!isLandingPage && !isWebMode ? 'max-w-lg mx-auto' : ''}`}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            {/* Public Routes */}
            <Route path="/" element={
              <PageTransition><Landing /></PageTransition>
            } />
            {/* Public Routes (Mobile App Mode) */}
            <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
            <Route path="/signup" element={<PageTransition><Signup /></PageTransition>} />
            <Route path="/verify" element={<PageTransition><VerifyOtp /></PageTransition>} />
            <Route path="/terms" element={<PageTransition><TermsOfService /></PageTransition>} />
            <Route path="/privacy" element={<PageTransition><PrivacyPolicy /></PageTransition>} />

            {/* Public Routes (Desktop Web Mode) */}
            <Route path="/web/login" element={<PageTransition><WebLogin /></PageTransition>} />
            <Route path="/web/signup" element={<PageTransition><WebSignup /></PageTransition>} />
            <Route path="/web/verify" element={<PageTransition><WebVerifyOtp /></PageTransition>} />
            <Route path="/web/auth-callback" element={<AuthCallback />} />
            <Route path="/web/pay/:username" element={<PageTransition><WebPayPage /></PageTransition>} />
            <Route path="/checkout/:sessionId" element={<PageTransition><CheckoutWidget /></PageTransition>} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={
                <PageTransition><Home /></PageTransition>
              } />
              <Route path="/trade" element={
                <PageTransition><Trade /></PageTransition>
              } />
              <Route path="/wallet" element={
                <PageTransition><Wallet /></PageTransition>
              } />
              <Route path="/giftcard" element={
                <PageTransition><Giftcard /></PageTransition>
              } />
              <Route path="/account" element={
                <PageTransition><Account /></PageTransition>
              } />
              <Route path="/create-wallet" element={
                <PageTransition><CreateWallet /></PageTransition>
              } />
              <Route path="/convert" element={
                <PageTransition><Convert /></PageTransition>
              } />
              <Route path="/qr" element={
                <PageTransition><QRCodePage /></PageTransition>
              } />
              <Route path="/withdraw" element={
                <PageTransition><Withdraw /></PageTransition>
              } />
              <Route path="/deposit" element={
                <PageTransition><Deposit /></PageTransition>
              } />
              <Route path="/earn" element={
                <PageTransition><Earn /></PageTransition>
              } />
              <Route path="/transfer" element={
                <PageTransition><Transfer /></PageTransition>
              } />
              <Route path="/stablex-secure" element={
                <PageTransition><StableXSecure /></PageTransition>
              } />

              {/* Protected Routes (Desktop Web Mode) */}
              <Route path="/web/dashboard" element={
                <PageTransition><WebDashboard /></PageTransition>
              } />
              <Route path="/web/merchant" element={
                <PageTransition><WebMerchantDashboard /></PageTransition>
              } />
              <Route path="/web/merchant/pay-ins" element={
                <PageTransition><WebMerchantPayIns /></PageTransition>
              } />
              <Route path="/web/merchant/payouts" element={
                <PageTransition><WebMerchantPayouts /></PageTransition>
              } />
              <Route path="/web/merchant/settlements" element={
                <PageTransition><WebMerchantSettlements /></PageTransition>
              } />
              <Route path="/web/merchant/webhooks" element={
                <PageTransition><WebMerchantWebhooks /></PageTransition>
              } />
              <Route path="/web/merchant/guidelines" element={
                <PageTransition><WebMerchantGuidelines /></PageTransition>
              } />
              <Route path="/web/trade" element={
                <PageTransition><WebTrade /></PageTransition>
              } />
              <Route path="/web/wallet" element={
                <PageTransition><WebWallet /></PageTransition>
              } />
              <Route path="/web/account" element={
                <PageTransition><WebAccount /></PageTransition>
              } />
              <Route path="/web/convert" element={
                <PageTransition><WebConvert /></PageTransition>
              } />
              <Route path="/web/withdraw" element={
                <PageTransition><WebWithdraw /></PageTransition>
              } />
              <Route path="/web/deposit" element={
                <PageTransition><WebDeposit /></PageTransition>
              } />
              <Route path="/web/orders" element={
                <PageTransition><WebOrders /></PageTransition>
              } />

              {/* Admin Portal (Strict Auth) */}
              <Route element={<ProtectedAdminRoute />}>
                <Route path="/web/admin" element={<PageTransition><AdminDashboard /></PageTransition>} />
                <Route path="/web/admin/users" element={<PageTransition><AdminUsers /></PageTransition>} />
                <Route path="/web/admin/transactions" element={<PageTransition><AdminTransactions /></PageTransition>} />
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </AnimatePresence>
        <BottomNav />
        <AIChatWidget />
      </div>
    </>
  );
}

import StarBackground from "./components/ui/star-background";

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashComplete = useCallback(() => setShowSplash(false), []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <StarBackground />
            {showSplash ? (
              <SplashScreen onComplete={handleSplashComplete} />
            ) : (
              <BrowserRouter>
                <AnimatedRoutes />
              </BrowserRouter>
            )}
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default App;
