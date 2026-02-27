import { useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Coins,
  TrendingUp,
  Clock,
  Lock,
  Check,
  AlertCircle,
  Loader2
} from "lucide-react";
import { SiBitcoin, SiEthereum, SiSolana, SiTether } from "react-icons/si";

interface StakingPool {
  id: string;
  name: string;
  symbol: string;
  apy: number;
  minStake: number;
  lockPeriod: string;
  totalStaked: string;
  icon: JSX.Element;
  color: string;
}

const stakingPools: StakingPool[] = [
  {
    id: "eth",
    name: "Ethereum",
    symbol: "ETH",
    apy: 4.5,
    minStake: 0.01,
    lockPeriod: "Flexible",
    totalStaked: "$2.4B",
    icon: <SiEthereum className="w-6 h-6" />,
    color: "text-blue-500",
  },
  {
    id: "sol",
    name: "Solana",
    symbol: "SOL",
    apy: 7.2,
    minStake: 0.1,
    lockPeriod: "Flexible",
    totalStaked: "$890M",
    icon: <SiSolana className="w-6 h-6" />,
    color: "text-purple-500",
  },
  {
    id: "usdt",
    name: "Tether",
    symbol: "USDT",
    apy: 12.5,
    minStake: 10,
    lockPeriod: "30 Days",
    totalStaked: "$1.2B",
    icon: <SiTether className="w-6 h-6" />,
    color: "text-green-500",
  },
  {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    apy: 3.8,
    minStake: 0.001,
    lockPeriod: "Flexible",
    totalStaked: "$5.6B",
    icon: <SiBitcoin className="w-6 h-6" />,
    color: "text-orange-500",
  },
];

export default function Earn() {
  const [selectedPool, setSelectedPool] = useState<StakingPool | null>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [isStaking, setIsStaking] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [myStakes, setMyStakes] = useState<Array<{ pool: StakingPool; amount: string; startDate: string }>>([]);

  const handleStake = async () => {
    // Staking is disabled for now.
    return;
  };

  const calculateEarnings = (amount: string, apy: number) => {
    const principal = parseFloat(amount) || 0;
    const yearlyEarnings = principal * (apy / 100);
    const monthlyEarnings = yearlyEarnings / 12;
    return { yearly: yearlyEarnings.toFixed(4), monthly: monthlyEarnings.toFixed(4) };
  };

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-background">
      <Header />

      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Earn</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Stake your crypto and earn passive rewards
        </p>

        <Card className="p-4 bg-amber-500/10 border-amber-500/30 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-600 dark:text-amber-400 text-sm">Coming Soon</p>
              <p className="text-xs text-muted-foreground">Staking is not yet available. Pools shown are for preview only.</p>
            </div>
          </div>
        </Card>        <Card className="p-4 bg-gradient-to-r from-primary/20 to-primary/10 border-primary/20 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Earnings</p>
              <p className="text-2xl font-bold text-foreground">$0.00</p>
            </div>
          </div>
        </Card>

        <h2 className="text-lg font-semibold text-foreground mb-4">Staking Pools</h2>

        <div className="space-y-3">
          {stakingPools.map((pool) => (
            <Card
              key={pool.id}
              className="p-4 hover-elevate cursor-pointer"
              onClick={() => setSelectedPool(pool)}
              data-testid={`pool-${pool.id}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center ${pool.color}`}>
                  {pool.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{pool.name}</p>
                    <div className="text-right">
                      <p className="font-bold text-green-500">{pool.apy}% APY</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{pool.lockPeriod}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      TVL: {pool.totalStaked}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {myStakes.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-4">My Stakes</h2>
            <div className="space-y-3">
              {myStakes.map((stake, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center ${stake.pool.color}`}>
                      {stake.pool.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {stake.amount} {stake.pool.symbol}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Earning {stake.pool.apy}% APY
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-500">Active</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={!!selectedPool && !showSuccess} onOpenChange={(open) => !open && setSelectedPool(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5" />
              Stake {selectedPool?.name}
            </DialogTitle>
            <DialogDescription>
              Earn {selectedPool?.apy}% APY on your {selectedPool?.symbol}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className={`w-10 h-10 rounded-full bg-background flex items-center justify-center ${selectedPool?.color}`}>
                {selectedPool?.icon}
              </div>
              <div>
                <p className="font-medium">{selectedPool?.name}</p>
                <p className="text-sm text-green-500 font-bold">{selectedPool?.apy}% APY</p>
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Amount to Stake</Label>
              <Input
                type="number"
                placeholder={`Min: ${selectedPool?.minStake} ${selectedPool?.symbol}`}
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="text-lg"
                data-testid="input-stake-amount"
              />
            </div>

            {stakeAmount && parseFloat(stakeAmount) > 0 && selectedPool && (
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium mb-2">
                  Estimated Earnings
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monthly:</span>
                  <span className="font-medium">
                    {calculateEarnings(stakeAmount, selectedPool.apy).monthly} {selectedPool.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Yearly:</span>
                  <span className="font-medium">
                    {calculateEarnings(stakeAmount, selectedPool.apy).yearly} {selectedPool.symbol}
                  </span>
                </div>
              </div>
            )}

            <div className="bg-muted p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Lock Period: <span className="font-medium text-foreground">{selectedPool?.lockPeriod}</span>
                  </p>
                </div>
              </div>
            </div>

            <Button
              className="w-full bg-navy"
              onClick={handleStake}
              disabled={true}
              data-testid="button-confirm-stake"
            >
              <>
                <Lock className="w-4 h-4 mr-2" />
                Coming Soon
              </>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              Staked Successfully
            </DialogTitle>
            <DialogDescription>
              Your tokens are now earning rewards
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 text-center">
            <p className="text-3xl font-bold text-foreground">
              {stakeAmount || "0"} {selectedPool?.symbol}
            </p>
            <p className="text-sm text-green-500 mt-1">
              Earning {selectedPool?.apy}% APY
            </p>
          </div>

          <Button
            className="w-full bg-navy"
            onClick={() => {
              setShowSuccess(false);
              setSelectedPool(null);
            }}
            data-testid="button-done-stake"
          >
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
