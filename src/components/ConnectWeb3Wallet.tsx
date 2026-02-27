import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function ConnectWeb3Wallet() {
    const { address, isConnected } = useAccount();
    const { connectors, connect, status, error } = useConnect();
    const { disconnect } = useDisconnect();
    const { toast } = useToast();
    const [isLinking, setIsLinking] = useState(false);

    // When a user successfully connects their external wallet, link it to the backend.
    useEffect(() => {
        if (isConnected && address && !isLinking) {
            linkWalletToBackend(address);
        }
    }, [isConnected, address]);

    const linkWalletToBackend = async (walletAddress: string) => {
        setIsLinking(true);
        try {
            const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
            if (!userInfo.token) return;

            const response = await fetch("/api/wallets/connect", {
                method: "POST",
                credentials: "include",
        headers: {
                    "Content-Type": "application/json",
                    
                },
                body: JSON.stringify({ address: walletAddress, network: "ETH" }), // Default to ETH/EVM
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Failed to link wallet");

            toast({
                title: "Wallet Connected!",
                description: "Your Web3 wallet has been linked to your account.",
            });
        } catch (err: any) {
            toast({
                title: "Connection Failed",
                description: err.message || "Could not link external wallet.",
                variant: "destructive",
            });
            disconnect(); // Disconnect if linking failed
        } finally {
            setIsLinking(false);
        }
    };

    if (isConnected) {
        return (
            <div className="flex flex-col gap-2">
                <Button variant="outline" className="w-full justify-between" onClick={() => disconnect()}>
                    <span className="truncate max-w-[200px]">{address}</span>
                    <span className="text-xs text-red-500 ml-2">Disconnect</span>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {connectors.map((connector) => (
                <Button
                    key={connector.uid}
                    variant="outline"
                    className="w-full"
                    disabled={status === "pending" || isLinking}
                    onClick={() => connect({ connector })}
                >
                    {status === "pending" || isLinking ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Connect {connector.name}
                </Button>
            ))}
            {error && <p className="text-xs text-red-500 text-center">{error.message}</p>}
        </div>
    );
}
