import { useState, useEffect } from "react";
import { LayoutDashboard, TrendingUp, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useBalances } from "@/hooks/useBalances";

interface TransactionRecord {
  _id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  reference: string;
  description?: string;
  createdAt: string;
}

const Merchant = () => {
  const { data: balancesData } = useBalances();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [rate, setRate] = useState<number>(1600);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
      const token = userInfo.token;

      if (!token) {
        setIsLoading(false);
        return;
      }

      // Fetch transactions and rates in parallel
      const [txRes, rateRes] = await Promise.all([
        fetch("/api/transactions/history", {
          credentials: "include",
        
        }),
        fetch("/api/transactions/rates"),
      ]);

      const txData = await txRes.json();
      const rateData = await rateRes.json();

      if (txData.success && txData.transactions) {
        setTransactions(txData.transactions);
      }
      if (rateData.success && rateData.rates?.USDT_NGN) {
        setRate(rateData.rates.USDT_NGN);
      }
    } catch (error) {
      console.error("Failed to fetch merchant data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate totals from real data
  const totalDeposits = transactions
    .filter(tx => tx.type === "deposit" && tx.status === "completed")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalWithdrawals = transactions
    .filter(tx => tx.type === "withdrawal" && tx.status === "completed")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalSwaps = transactions
    .filter(tx => tx.type === "swap" && tx.status === "completed")
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Get user's NGN balance from useBalances hook
  const ngnBalance = balancesData?.NGN || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Merchant Dashboard</h1>
        <p className="text-muted-foreground">Track your transactions and balance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-gradient-to-br from-primary to-primary-glow text-white">
          <div className="flex items-center gap-2 mb-2">
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-sm opacity-90">NGN Balance</span>
          </div>
          <div className="text-3xl font-bold">₦{ngnBalance.toLocaleString()}</div>
          <div className="text-sm opacity-90 mt-1">
            ≈ {(ngnBalance / rate).toFixed(2)} USDT
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownRight className="h-5 w-5 text-success" />
            <span className="text-sm text-muted-foreground">Total Deposits</span>
          </div>
          <div className="text-3xl font-bold text-success">₦{totalDeposits.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {transactions.filter(tx => tx.type === "deposit").length} transactions
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight className="h-5 w-5 text-destructive" />
            <span className="text-sm text-muted-foreground">Total Withdrawals</span>
          </div>
          <div className="text-3xl font-bold text-destructive">₦{totalWithdrawals.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {transactions.filter(tx => tx.type === "withdrawal").length} transactions
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No transactions yet.</p>
            <p className="text-sm mt-1">Your deposits, withdrawals, and swaps will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.slice(0, 10).map((tx) => (
              <div key={tx._id} className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${tx.type === "deposit" ? "bg-success/20" :
                    tx.type === "withdrawal" ? "bg-destructive/20" :
                      "bg-blue-500/20"
                    }`}>
                    {tx.type === "deposit" ? (
                      <ArrowDownRight className="h-4 w-4 text-success" />
                    ) : tx.type === "withdrawal" ? (
                      <ArrowUpRight className="h-4 w-4 text-destructive" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium capitalize">{tx.type}</div>
                    <div className="text-sm text-muted-foreground">
                      {tx.description || tx.reference}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${tx.type === "deposit" ? "text-success" :
                    tx.type === "withdrawal" ? "text-destructive" :
                      "text-blue-500"
                    }`}>
                    {tx.type === "deposit" ? "+" : "-"}{tx.amount.toLocaleString()} {tx.currency}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}
                  </div>
                  <div className={`text-xs ${tx.status === "completed" ? "text-success" : "text-amber-500"}`}>
                    {tx.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Merchant;
