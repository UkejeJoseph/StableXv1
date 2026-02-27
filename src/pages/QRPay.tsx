import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/contexts/WalletContext";
import { USDT_CONTRACT } from "@/config/blockchain";

const QRPay = () => {
  const { account } = useWallet();
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const paymentData = {
    address: account || "",
    amount: amount,
    token: USDT_CONTRACT.address,
    memo: memo,
  };

  const paymentUrl = `ethereum:${USDT_CONTRACT.address}/transfer?address=${account}&uint256=${amount}`;

  const downloadQR = () => {
    const canvas = document.getElementById("payment-qr") as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = "payment-qr.png";
      link.href = url;
      link.click();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">QR Payment</h1>
        <p className="text-muted-foreground">Generate payment QR code for customers</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Payment Details</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USDT)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="memo">Memo (Optional)</Label>
              <Input
                id="memo"
                placeholder="Payment reference"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Merchant Address</Label>
              <div className="p-3 bg-secondary rounded-lg text-sm font-mono break-all">
                {account || "Not connected"}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 flex flex-col items-center justify-center">
          {amount && account ? (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-lg">
                <QRCodeSVG
                  id="payment-qr"
                  value={paymentUrl}
                  size={256}
                  level="H"
                  includeMargin
                />
              </div>
              <Button onClick={downloadQR} variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download QR
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <QrCode className="h-16 w-16 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                Enter payment details to generate QR code
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6 bg-accent/10 border-accent">
        <h3 className="font-semibold mb-2">How it works</h3>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Enter the payment amount and optional memo</li>
          <li>Show the QR code to your customer</li>
          <li>Customer scans with their wallet app</li>
          <li>Payment is pre-filled and ready to confirm</li>
          <li>Track payment in your merchant dashboard</li>
        </ol>
      </Card>
    </div>
  );
};

export default QRPay;
