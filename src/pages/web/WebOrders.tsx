import { useState } from "react";
import { WebLayout } from "@/components/WebSidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { FileText, Search, Settings2, Download } from "lucide-react";

export default function WebOrders() {
    const [activeTab, setActiveTab] = useState("open");

    return (
        <WebLayout>
            <div className="flex flex-col h-full bg-[#0b0e11] text-foreground -mt-4">

                {/* Page Header */}
                <div className="flex items-center justify-between py-6 border-b border-border/20">
                    <h1 className="text-2xl font-bold tracking-tight">Spot Orders</h1>
                    <Button variant="outline" className="border-border/30 h-8 text-xs font-semibold">
                        Trading Performance
                    </Button>
                </div>

                {/* Top Level Tabs (Bybit style: subtle underline tabs) */}
                <div className="pt-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="flex items-center justify-between border-b border-border/20">
                            <TabsList className="bg-transparent h-12 p-0 space-x-8">
                                <TabsTrigger
                                    value="open"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#F0B90B] data-[state=active]:bg-transparent data-[state=active]:text-[#F0B90B] data-[state=active]:shadow-none px-0 py-3 text-sm font-medium text-muted-foreground hover:text-white"
                                >
                                    Open Orders
                                </TabsTrigger>
                                <TabsTrigger
                                    value="history"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#F0B90B] data-[state=active]:bg-transparent data-[state=active]:text-[#F0B90B] data-[state=active]:shadow-none px-0 py-3 text-sm font-medium text-muted-foreground hover:text-white"
                                >
                                    Order History
                                </TabsTrigger>
                                <TabsTrigger
                                    value="trades"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#F0B90B] data-[state=active]:bg-transparent data-[state=active]:text-[#F0B90B] data-[state=active]:shadow-none px-0 py-3 text-sm font-medium text-muted-foreground hover:text-white"
                                >
                                    Trade History
                                </TabsTrigger>
                                <TabsTrigger
                                    value="subs"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#F0B90B] data-[state=active]:bg-transparent data-[state=active]:text-[#F0B90B] data-[state=active]:shadow-none px-0 py-3 text-sm font-medium text-muted-foreground hover:text-white hidden sm:flex"
                                >
                                    Subscription & Redemption
                                </TabsTrigger>
                                <TabsTrigger
                                    value="tools"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#F0B90B] data-[state=active]:bg-transparent data-[state=active]:text-[#F0B90B] data-[state=active]:shadow-none px-0 py-3 text-sm font-medium text-muted-foreground hover:text-white hidden sm:flex"
                                >
                                    Tools
                                </TabsTrigger>
                            </TabsList>

                            <div className="hidden lg:flex">
                                <Button variant="link" className="text-muted-foreground hover:text-[#F0B90B] text-sm">
                                    Launchpool <span className="ml-1">›</span>
                                </Button>
                            </div>
                        </div>

                        {/* Filter Bar */}
                        <div className="flex flex-wrap items-center gap-3 py-4">
                            <div className="flex items-center bg-[#1e2329] border border-border/20 rounded-md p-1">
                                <Select defaultValue="all">
                                    <SelectTrigger className="w-[120px] h-8 border-0 bg-transparent focus:ring-0 text-xs font-semibold shadow-none">
                                        <SelectValue placeholder="Market" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1e2329] border-border/20 text-foreground">
                                        <SelectItem value="all">All Assets</SelectItem>
                                        <SelectItem value="btc">BTC</SelectItem>
                                        <SelectItem value="eth">ETH</SelectItem>
                                    </SelectContent>
                                </Select>
                                <span className="text-muted-foreground/50 mx-1">/</span>
                                <Select defaultValue="quote">
                                    <SelectTrigger className="w-[120px] h-8 border-0 bg-transparent focus:ring-0 text-xs font-semibold shadow-none">
                                        <SelectValue placeholder="Quote" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1e2329] border-border/20 text-foreground">
                                        <SelectItem value="quote">Quote Assets</SelectItem>
                                        <SelectItem value="usdt">USDT</SelectItem>
                                        <SelectItem value="usdc">USDC</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Select defaultValue="limit">
                                <SelectTrigger className="w-[140px] h-10 border-border/20 bg-[#1e2329] focus:ring-0 text-xs font-semibold">
                                    <SelectValue placeholder="Order Type" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1e2329] border-border/20 text-foreground">
                                    <SelectItem value="limit">Limit</SelectItem>
                                    <SelectItem value="market">Market</SelectItem>
                                    <SelectItem value="tp_sl">TP/SL</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select defaultValue="all">
                                <SelectTrigger className="w-[120px] h-10 border-border/20 bg-[#1e2329] focus:ring-0 text-xs font-semibold">
                                    <SelectValue placeholder="Direction" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1e2329] border-border/20 text-foreground">
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="buy">Buy</SelectItem>
                                    <SelectItem value="sell">Sell</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button variant="outline" className="h-10 px-6 border-border/20 font-semibold text-xs ml-auto">
                                Reset
                            </Button>
                        </div>

                        {/* Data Table */}
                        <TabsContent value="open" className="mt-2 outline-none">
                            <div className="w-full overflow-x-auto rounded-lg border border-border/10 bg-[#12161a]">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-[#1a1e24] text-muted-foreground font-medium border-b border-border/10">
                                        <tr>
                                            <th className="px-4 py-3 whitespace-nowrap">Market</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Trade Type</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Order Type</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Direction</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Order Value</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Order Price</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Filled/Order Quantity</th>
                                            <th className="px-4 py-3 whitespace-nowrap">TP/SL</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Date</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Order ID</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Empty State matching the screenshot exactly */}
                                        <tr>
                                            <td colSpan={11} className="py-24 text-center">
                                                <div className="flex flex-col items-center justify-center space-y-4">
                                                    <div className="w-20 h-20 bg-muted/5 rounded-full flex items-center justify-center mb-2">
                                                        <FileText className="w-8 h-8 text-[#F0B90B]/40 stroke-[1.5]" />
                                                    </div>
                                                    <p className="text-muted-foreground font-medium">No Records Found</p>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>

                        {/* Other tabs just reuse the empty state for now */}
                        <TabsContent value="history" className="mt-2 outline-none">
                            <div className="w-full p-24 text-center border border-border/10 bg-[#12161a] rounded-lg">
                                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground font-medium">No Order History Found</p>
                            </div>
                        </TabsContent>

                    </Tabs>
                </div>
            </div>
        </WebLayout>
    );
}
