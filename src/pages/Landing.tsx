import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ArrowRight, ShieldCheck, Zap, RefreshCw,
    WalletCards, Globe, Lock, ArrowUpRight,
    Award, ChevronDown, Apple
} from "lucide-react";

import { LandingHeader } from "@/components/LandingHeader";

export default function Landing() {
    const [email, setEmail] = useState("");
    const navigate = useNavigate();

    const handleSignUp = (e: React.FormEvent) => {
        e.preventDefault();
        if (email) {
            navigate('/web/signup', { state: { email } });
        } else {
            navigate('/web/signup');
        }
    };

    const marketData = [
        { coin: "BTC", name: "Bitcoin", price: "$63,198.60", change: "-4.12%", isNegative: true },
        { coin: "ETH", name: "Ethereum", price: "$3,424.16", change: "+1.69%", isNegative: false },
        { coin: "SOL", name: "Solana", price: "$146.80", change: "-3.21%", isNegative: true },
        { coin: "TRX", name: "Tron", price: "$0.13", change: "+0.51%", isNegative: false },
        { coin: "USDT", name: "Tether", price: "$1.00", change: "0.00%", isNegative: false },
    ];

    const newsItems = [
        "StableX Integrates TRC20 Auto-Sweep for Enterprise",
        "Global Crypto Adoption Reaches New All-Time Highs",
        "Understanding the recent Bitcoin Halving Impact",
        "How MPC Wallets are changing crypto security",
    ];

    return (
        <div className="min-h-screen bg-background text-foreground overflow-x-hidden pt-20">
            <LandingHeader />

            {/* 1. Binance-Style Hero Split Layout */}
            <section className="max-w-[1400px] mx-auto px-6 pt-8 lg:pt-16 pb-20 relative z-10 flex flex-col lg:flex-row gap-12 lg:gap-8 items-start justify-between">

                {/* Left Column: Hero Text & Signup */}
                <div className="flex-1 max-w-2xl mt-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 className="text-4xl lg:text-6xl font-bold leading-[1.1] mb-6 text-foreground">
                            Sign up today and claim your <span className="text-primary text-shadow-glow">Welcome Bonus</span>
                        </h1>
                        <p className="text-lg text-muted-foreground mb-8">
                            Instant Crypto Deposits & Lightning Fast Swaps in 2 steps
                        </p>

                        {/* Awards / Trust Badges */}
                        <div className="flex gap-8 mb-12">
                            <div className="flex items-center gap-3">
                                <Award className="w-10 h-10 text-primary" />
                                <div>
                                    <div className="font-bold text-xl text-primary">No.1</div>
                                    <div className="text-sm text-muted-foreground">Customer Assets</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Award className="w-10 h-10 text-primary" />
                                <div>
                                    <div className="font-bold text-xl text-primary">No.1</div>
                                    <div className="text-sm text-muted-foreground">Trading Volume</div>
                                </div>
                            </div>
                        </div>

                        {/* Inline Signup Form */}
                        <form onSubmit={handleSignUp} className="flex flex-col sm:flex-row gap-4 mb-6 max-w-lg">
                            <Input
                                type="email"
                                placeholder="Email/Phone number"
                                className="h-14 bg-card border-border hover:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary text-base rounded-md"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <Button type="submit" className="h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-bold rounded-md whitespace-nowrap shadow-lg shadow-primary/25">
                                Sign Up
                            </Button>
                        </form>

                        <div className="flex items-center gap-4 max-w-lg mb-6">
                            <div className="h-px flex-1 bg-border/50"></div>
                            <span className="text-sm text-muted-foreground font-medium">Or sign up with</span>
                            <div className="h-px flex-1 bg-border/50"></div>
                        </div>

                        <div className="max-w-lg">
                            <Button
                                variant="outline"
                                className="w-full h-14 bg-card border-border hover:bg-muted rounded-md text-foreground font-medium flex items-center justify-center gap-3 transition-colors"
                                onClick={() => window.location.href = '/api/auth/google'}
                            >
                                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"></path><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"></path></svg>
                                Sign up with Google
                            </Button>
                        </div>
                    </motion.div>
                </div>

                {/* Right Column: Market Data & News */}
                <div className="w-full lg:w-[480px] flex flex-col gap-4">
                    {/* Market Crypto Card */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="bg-card rounded-xl p-5 border border-border shadow-2xl glass"
                    >
                        <div className="flex items-center gap-6 mb-4">
                            <span className="text-foreground font-medium text-base border-b-2 border-primary pb-1">Popular</span>
                            <span className="text-muted-foreground text-base hover:text-foreground cursor-pointer transition-colors pb-1">New Listing</span>
                        </div>

                        <div className="space-y-1">
                            {marketData.map((coin, i) => (
                                <Link to="/login" key={i} className="flex items-center justify-between py-3 px-2 hover:bg-muted rounded-lg transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                            {coin.coin[0]}
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-bold text-foreground text-base">{coin.coin}</span>
                                            <span className="text-xs text-muted-foreground">{coin.name}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 text-right">
                                        <span className="font-medium text-foreground">{coin.price}</span>
                                        <span className={`w-16 text-sm font-medium ${coin.isNegative ? 'text-red-500' : 'text-green-500'}`}>
                                            {coin.change}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-border text-center">
                            <Link to="/login" className="text-muted-foreground hover:text-primary text-sm font-medium transition-colors flex items-center justify-center gap-1">
                                View All Markets <ChevronDown className="w-4 h-4 -rotate-90" />
                            </Link>
                        </div>
                    </motion.div>

                    {/* News Card */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="bg-card rounded-xl p-5 border border-border shadow-2xl glass"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-foreground font-bold text-base">News</h3>
                            <Link to="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors flex items-center gap-1">
                                View All News <ChevronDown className="w-4 h-4 -rotate-90" />
                            </Link>
                        </div>
                        <div className="space-y-4">
                            {newsItems.map((news, i) => (
                                <div key={i} className="text-sm text-foreground/80 hover:text-primary cursor-pointer transition-colors leading-snug">
                                    {news}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* 2. Original Features Grid */}
            <section className="py-24 px-6 relative z-10 max-w-6xl mx-auto border-t border-border/50 mt-12 pl-6 pr-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold mb-4">Everything you need to scale globally</h2>
                    <p className="text-lg text-muted-foreground">Built for power users, designed for everyone.</p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Feature 1 */}
                    <motion.div whileHover={{ y: -5 }} className="p-6 rounded-2xl glass border border-border bg-card/40 backdrop-blur-md">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-6 text-primary">
                            <RefreshCw className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold mb-2">Auto-Sweep TRC20</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Never worry about gas limits again. Incoming USDT is automatically swept into secure cold storage using dynamic TRX estimation.
                        </p>
                    </motion.div>

                    {/* Feature 2 */}
                    <motion.div whileHover={{ y: -5 }} className="p-6 rounded-2xl glass border border-border bg-card/40 backdrop-blur-md">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6 text-blue-400">
                            <Zap className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold mb-2">Lightning Swaps</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Convert between BTC, ETH, SOL, and USDT instantly without dealing with order books or liquidity pools.
                        </p>
                    </motion.div>

                    {/* Feature 3 */}
                    <motion.div whileHover={{ y: -5 }} className="p-6 rounded-2xl glass border border-border bg-card/40 backdrop-blur-md">
                        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-6 text-green-500">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold mb-2">Enterprise Security</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Your assets are protected by battle-tested MPC architecture, AES-256 encryption, and mandatory OTP verification.
                        </p>
                    </motion.div>

                    {/* Feature 4 */}
                    <motion.div whileHover={{ y: -5 }} className="p-6 rounded-2xl glass border border-border bg-card/40 backdrop-blur-md">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6 text-purple-400">
                            <WalletCards className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold mb-2">Virtual Cards (Soon)</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Spend your crypto balance instantly anywhere Visa or Mastercard is accepted globally.
                        </p>
                    </motion.div>

                    {/* Feature 5 */}
                    <motion.div whileHover={{ y: -5 }} className="p-6 rounded-2xl glass border border-border bg-card/40 backdrop-blur-md">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-6 text-orange-400">
                            <Globe className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold mb-2">Cross-Border Rails</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Cash out to local currencies or transfer funds globally in minutes with our native Interswitch integration.
                        </p>
                    </motion.div>

                    {/* Feature 6 */}
                    <motion.div whileHover={{ y: -5 }} className="p-6 rounded-2xl glass border border-border bg-card/40 backdrop-blur-md">
                        <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center mb-6 text-pink-400">
                            <Lock className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold mb-2">Full Custody HD Wallets</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Every user receives a dedicated set of cryptographic sub-wallets securely derived from a unified BIP44 master seed.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* 3. Original Bottom CTA */}
            <section className="py-24 px-6 relative z-10 max-w-4xl mx-auto text-center">
                <div className="p-12 md:p-16 rounded-3xl bg-gradient-to-b from-primary/10 to-transparent border border-primary/20 backdrop-blur-lg shadow-2xl">
                    <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to take control?</h2>
                    <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
                        Join thousands of users who have upgraded to StableX. Create your free account in under 60 seconds.
                    </p>
                    <Button asChild size="lg" className="h-14 px-10 text-base shadow-lg shadow-primary/25 rounded-full hover:shadow-primary/40 transition-shadow">
                        <Link to="/signup">
                            Create Free Account <ArrowUpRight className="ml-2 w-5 h-5" />
                        </Link>
                    </Button>
                </div>
            </section>

            {/* 4. Original Footer */}
            <footer className="mt-10 py-8 border-t border-border/50 text-center text-sm text-muted-foreground z-10 relative">
                <p>&copy; {new Date().getFullYear()} StableX. All rights reserved.</p>
                <div className="flex justify-center gap-6 mt-4">
                    <Link to="/app/login" className="hover:text-primary transition-colors">Try App Mode</Link>
                    <Link to="/web/login" className="hover:text-primary transition-colors">Login</Link>
                    <Link to="/web/signup" className="hover:text-primary transition-colors">Sign Up</Link>
                    <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                    <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                </div>
            </footer>
        </div>
    );
}
