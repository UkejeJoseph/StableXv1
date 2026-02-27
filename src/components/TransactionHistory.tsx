import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface Transaction {
  _id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  reference: string;
  description?: string;
  createdAt: string;
}

const typeConfig: Record<string, { icon: typeof ArrowDownCircle; color: string; label: string }> = {
  deposit: { icon: ArrowDownCircle, color: 'text-green-500', label: 'Deposit' },
  withdrawal: { icon: ArrowUpCircle, color: 'text-red-400', label: 'Withdrawal' },
  swap: { icon: ArrowLeftRight, color: 'text-blue-400', label: 'Swap' },
  sweep: { icon: RefreshCw, color: 'text-purple-400', label: 'Sweep' },
};

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bgColor: string }> = {
  completed: { icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  failed: { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  pending: { icon: Clock, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
};

function TransactionRow({ tx }: { tx: Transaction }) {
  const type = typeConfig[tx.type] || typeConfig.deposit;
  const status = statusConfig[tx.status] || statusConfig.pending;
  const TypeIcon = type.icon;
  const StatusIcon = status.icon;

  const date = new Date(tx.createdAt);
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${status.bgColor}`}>
          <TypeIcon className={`w-4 h-4 ${type.color}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{type.label}</p>
          <p className="text-xs text-muted-foreground">{dateStr} · {timeStr}</p>
        </div>
      </div>
      <div className="text-right flex items-center gap-2">
        <div>
          <p className={`text-sm font-semibold ${tx.type === 'deposit' ? 'text-green-500' : 'text-foreground'}`}>
            {tx.type === 'deposit' ? '+' : '-'}{tx.amount} {tx.currency}
          </p>
          <div className="flex items-center justify-end gap-1">
            <StatusIcon className={`w-3 h-3 ${status.color}`} />
            <p className={`text-xs capitalize ${status.color}`}>{tx.status}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type TabType = 'all' | 'deposit' | 'swap' | 'withdrawal';

export function TransactionHistory() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Receipt State
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'deposit', label: 'Deposits' },
    { key: 'swap', label: 'Swaps' },
    { key: 'withdrawal', label: 'Withdrawals' },
  ];

  useEffect(() => {
    fetchTransactions();
  }, [activeTab]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const typeParam = activeTab !== 'all' ? `?type=${activeTab}` : '';
      const response = await fetch(`/api/transactions/history${typeParam}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch history");
      const data = await response.json();
      if (data.success) {
        setTransactions(data.transactions || []);
      }
    } catch (error: any) {
      console.warn('Transaction History error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="mx-4 mt-4 overflow-hidden card-elevated">
        <div className="p-4 pb-2">
          <h2 className="text-sm font-semibold text-foreground mb-3">Transaction History</h2>

          {/* Tabs */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-all ${activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transaction List */}
        <div className="px-2 pb-3 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {transactions.map((tx) => (
                  <div key={tx._id} onClick={() => setSelectedTx(tx)} className="cursor-pointer">
                    <TransactionRow tx={tx} />
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </Card>

      {/* Transaction Receipt Dialog */}
      <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border/50 text-foreground overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50"></div>

          <DialogHeader>
            <DialogTitle className="text-center font-bold text-lg">Transaction Receipt</DialogTitle>
          </DialogHeader>

          {selectedTx && (
            <div className="mt-4 space-y-6">
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 ${statusConfig[selectedTx.status]?.bgColor || 'bg-muted'}`}>
                  {selectedTx.status === 'completed' ? <CheckCircle2 className="w-8 h-8 text-green-500" /> :
                    selectedTx.status === 'failed' ? <XCircle className="w-8 h-8 text-red-500" /> :
                      <Clock className="w-8 h-8 text-yellow-500" />}
                </div>
                <h2 className="text-3xl font-bold">
                  {selectedTx.type === 'deposit' ? '+' : '-'}{selectedTx.amount} {selectedTx.currency}
                </h2>
                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${statusConfig[selectedTx.status]?.bgColor} ${statusConfig[selectedTx.status]?.color}`}>
                  {selectedTx.status}
                </span>
              </div>

              <div className="space-y-4 p-4 rounded-xl bg-secondary/30 border border-border/50">
                <div className="flex justify-between items-center pb-3 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Type</span>
                  <span className="text-sm font-medium capitalize">{selectedTx.type}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Date & Time</span>
                  <span className="text-sm font-medium">
                    {new Date(selectedTx.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Reference</span>
                  <span className="text-sm font-mono truncate max-w-[200px]">{selectedTx.reference}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-center">
                <p className="text-xs text-muted-foreground text-center">
                  This receipt is automatically generated by StableX.<br />
                  If you have issues, please contact support.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
