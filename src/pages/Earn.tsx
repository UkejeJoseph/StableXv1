import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Coins,
  TrendingUp,
  Clock,
  Lock,
  Unlock,
  CheckCircle2,
  Loader2,
  AlertCircle
} from "lucide-react";
import { SiTether } from "react-icons/si";

interface StakingPool {
  id: string;
  name: string;
  symbol: string;
  network: string;
  apy: number;
  minStake: number;
  lockPeriod: string;
  description: string;
  icon: JSX.Element;
  color: string;
}

const stakingPools: StakingPool[] = [
  {
    id: "usdt-trc20",
    name: "Tether USDT",
    symbol: "USDT",
    network: "TRC20",
    apy: 8,
    minStake: 10,
    lockPeriod: "Flexible",
    description: "Earn 8% APY on your USDT",
    icon: <SiTether className="w-6 h-6" />,
    color: "text-green-500",
  },
];

export default function Earn() {
  const { toast } = useToast();
  const [selectedPool, setSelectedPool] = useState<StakingPool | null>(null);
  const [stakeAmount, setStakeAmount] = useState("");

  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [showStakeDialog, setShowStakeDialog] = useState(false);
  const [showUnstakeDialog, setShowUnstakeDialog] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);

  useEffect(() => {
    fetchPositions();
  }, []);

  const fetchPositions = async () => {
    setPositionsLoading(true);
    try {
      const res = await fetch("/api/staking/positions", {
        credentials: "include"
      });
      const data = await res.json();
      if (data.success) {
        setPositions(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch positions", err);
    } finally {
      setPositionsLoading(false);
    }
  };

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) < 10) {
      toast({ title: "Minimum stake is 10 USDT", variant: "destructive" });
      return;
    }
    setIsStaking(true);
    try {
      const res = await fetch("/api/staking/stake", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency: "USDT_TRC20",
          amount: parseFloat(stakeAmount)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Staking failed");

      toast({
        title: "Staked successfully!",
        description: `${stakeAmount} USDT is now earning 8% APY`
      });
      setSelectedPool(null);
      setShowStakeDialog(false);
      setStakeAmount("");
      fetchPositions();
    } catch (err) {
      toast({
        title: "Staking failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsStaking(false);
    }
  };

  const handleUnstake = async () => {
    if (!selectedPosition) return;
    setIsUnstaking(true);
    try {
      const res = await fetch("/api/staking/unstake", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId: selectedPosition._id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unstake failed");

      toast({
        title: "Unstaked successfully!",
        description: `${selectedPosition.amount} USDT returned to your wallet`
      });
      setShowUnstakeDialog(false);
      setPositions(prev => prev.filter(p => p._id !== selectedPosition._id));
    } catch (err) {
      toast({
        title: "Unstake failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsUnstaking(false);
    }
  };

  const calculateEarnings = (amount: string, apy: number) => {
    const principal = parseFloat(amount) || 0;
    const yearlyEarnings = principal * (apy / 100);
    const monthlyEarnings = yearlyEarnings / 12;
    return { yearly: yearlyEarnings.toFixed(4), monthly: monthlyEarnings.toFixed(4) };
  };

  const totalPositionsBalance = positions.reduce((acc, pos) => acc + (pos.amount || 0), 0);
  const totalPositionsEarned = positions.reduce((acc, pos) => acc + (pos.totalEarned || 0), 0);

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-background">
      <Header />

      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Earn</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Stake your crypto and earn passive rewards
        </p>

        <Card className="p-4 bg-gradient-to-r from-primary/20 to-primary/10 border-primary/20 mb-6 card-elevated">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shadow-inner">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Staked Balance</p>
              <p className="text-2xl font-bold text-foreground">
                {totalPositionsBalance.toLocaleString()} <span className="text-sm font-medium">USDT</span>
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Total Earned</p>
              <p className="text-sm font-bold text-primary">+{totalPositionsEarned.toFixed(4)}</p>
            </div>
          </div>
        </Card>

        {/* ACTIVE POSITIONS */}
        <div className="mb-8">
          <h3 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-[0.2em]">Your Active Stakes</h3>

          {positionsLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          ) : positions.length === 0 ? (
            <Card className="bg-muted/30 border-dashed border-2">
              <CardContent className="py-10 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Coins className="h-6 w-6 text-muted-foreground/60" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  No active stakes yet. Start earning rewards below.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {positions.map(position => {
                const dailyYield = (position.amount * position.apy) / 365;
                const daysActive = Math.floor(
                  (Date.now() - new Date(position.startDate).getTime()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <Card key={position._id} className="card-elevated border-l-4 border-l-primary overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <SiTether className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">
                              {position.amount.toLocaleString()} USDT
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {daysActive} days active
                              </span>
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-primary/10 text-primary border-primary/20 font-bold">
                          {(position.apy * 100).toFixed(0)}% APY
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-muted/50 rounded-xl p-2.5 border border-border/50">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Total Earned</p>
                          <p className="text-sm font-bold text-primary">
                            +{position.totalEarned?.toFixed(4)} <span className="text-[10px]">USDT</span>
                          </p>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-2.5 border border-border/50">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Daily Yield</p>
                          <p className="text-sm font-bold text-foreground">
                            +{dailyYield.toFixed(4)} <span className="text-[10px]">USDT</span>
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 h-9 rounded-lg border border-destructive/20"
                        onClick={() => {
                          setSelectedPosition(position);
                          setShowUnstakeDialog(true);
                        }}
                      >
                        <Unlock className="h-3.5 w-3.5 mr-2" />
                        Unstake Funds
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-[0.2em]">Staking Pools</h2>

        <div className="space-y-4">
          {stakingPools.map((pool) => (
            <Card
              key={pool.id}
              className="p-4 hover:border-primary transition-all cursor-pointer card-elevated group"
              onClick={() => {
                setSelectedPool(pool);
                setShowStakeDialog(true);
              }}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors ${pool.color}`}>
                  {pool.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-foreground">{pool.name}</p>
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                      {pool.apy}% APY
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{pool.lockPeriod}</span>
                    </div>
                    <p className="text-xs font-medium text-foreground">
                      Min: {pool.minStake} {pool.symbol}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={showStakeDialog} onOpenChange={setShowStakeDialog}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              Stake {selectedPool?.name}
            </DialogTitle>
            <DialogDescription>
              Your funds will be locked to earn rewards at {selectedPool?.apy}% APY
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-2xl border border-border">
              <div className={`w-12 h-12 rounded-xl bg-background flex items-center justify-center shadow-sm ${selectedPool?.color}`}>
                {selectedPool?.icon}
              </div>
              <div>
                <p className="font-bold text-foreground">{selectedPool?.name}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary border-primary/30 h-5 px-1.5 text-[10px]">
                    {selectedPool?.network}
                  </Badge>
                  <span className="text-xs text-green-500 font-bold">{selectedPool?.apy}% APY</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="stakeAmount" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Amount to Stake
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  Min: {selectedPool?.minStake} {selectedPool?.symbol}
                </span>
              </div>
              <div className="relative">
                <Input
                  id="stakeAmount"
                  type="number"
                  placeholder="0.00"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  className="text-lg h-12 bg-muted/50 font-bold"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="text-sm font-bold text-muted-foreground">{selectedPool?.symbol}</span>
                </div>
              </div>
            </div>

            {stakeAmount && parseFloat(stakeAmount) > 0 && selectedPool && (
              <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 space-y-3">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                  Estimated Earnings
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monthly rewards</span>
                  <span className="font-bold text-foreground">
                    +{calculateEarnings(stakeAmount, selectedPool.apy).monthly} {selectedPool.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t border-primary/10">
                  <span className="font-semibold text-muted-foreground">Yearly rewards</span>
                  <span className="font-bold text-primary">
                    +{calculateEarnings(stakeAmount, selectedPool.apy).yearly} {selectedPool.symbol}
                  </span>
                </div>
              </div>
            )}

            <div className="bg-muted p-3 rounded-xl flex items-start gap-3">
              <Lock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Staked funds are held securely. The lock period is <span className="font-bold text-foreground">{selectedPool?.lockPeriod}</span>.
                You can unstake manually at any time to return funds to your main wallet.
              </p>
            </div>

            <DialogFooter>
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-xl font-bold"
                onClick={handleStake}
                disabled={!stakeAmount || parseFloat(stakeAmount) < (selectedPool?.minStake || 10) || isStaking}
              >
                {isStaking ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" />Staking...</>
                ) : `Stake ${stakeAmount || "0"} USDT`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUnstakeDialog} onOpenChange={setShowUnstakeDialog}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Unlock className="w-5 h-5" />
              Unstake USDT
            </DialogTitle>
            <DialogDescription>
              Your staked funds and earned rewards will be returned to your main wallet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            <div className="bg-muted/50 rounded-2xl p-5 border border-border space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Initial Stake</span>
                <span className="font-bold text-lg">
                  {selectedPosition?.amount.toLocaleString()} <span className="text-xs font-medium">USDT</span>
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">Rewards Earned</span>
                <span className="font-bold text-lg text-primary">
                  +{selectedPosition?.totalEarned?.toFixed(4)} <span className="text-xs font-medium text-primary">USDT</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-destructive/5 rounded-xl border border-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-[11px] text-destructive leading-tight font-medium">
                Unstaking will stop future reward generation for this position. This action cannot be reversed.
              </p>
            </div>

            <DialogFooter className="gap-3 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowUnstakeDialog(false)}
                className="flex-1 h-12 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={isUnstaking}
                onClick={handleUnstake}
                className="flex-1 h-12 rounded-xl font-bold"
              >
                {isUnstaking ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" />Unstaking...</>
                ) : "Confirm Unstake"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
