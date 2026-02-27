import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface Message {
    role: "user" | "model";
    content: string;
}

export function AIChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initialize chat
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const userInfoStr = localStorage.getItem("userInfo");
            let name = "StableX User";
            if (userInfoStr) {
                try {
                    const u = JSON.parse(userInfoStr);
                    // Fallback to name if it exists, otherwise email prefix
                    name = u.name || (u.email ? u.email.split("@")[0] : name);
                } catch (e) { }
            }
            setMessages([
                { role: "model", content: `Hey ${name}, I am your StableX AI assistant! Ask me anything.` }
            ]);
        }
    }, [isOpen, messages.length]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
        setMessages(newMessages);
        setIsLoading(true);

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey || apiKey === "your_gemini_api_key_here") {
            setMessages((prev) => [
                ...prev,
                { role: "model", content: "Error: VITE_GEMINI_API_KEY is not configured in the .env file. Please paste a free API key from Google AI Studio into your .env to enable the chat widget." }
            ]);
            setIsLoading(false);
            return;
        }

        try {
            // Build history for Gemini
            const history = newMessages.map(msg => ({
                role: msg.role === "model" ? "model" : "user",
                parts: [{ text: msg.content }]
            }));

            const systemInstruction = "You are a helpful AI support assistant for StableX, a modern fintech app that allows users to deposit NGN (fiat) via Interswitch, swap with crypto (USDT, BTC, ETH), use virtual accounts, and withdraw via direct bank transfer. Be highly concise, friendly, and helpful. Format responses in plain text.";

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    contents: history,
                })
            });

            const data = await response.json();

            if (response.ok && data.candidates && data.candidates.length > 0) {
                const aiText = data.candidates[0].content.parts[0].text;
                setMessages((prev) => [...prev, { role: "model", content: aiText }]);
            } else {
                const errorMsg = data?.error?.message || "Unknown error";
                console.error("Gemini API Error:", data);
                setMessages((prev) => [...prev, { role: "model", content: `Sorry, AI is temporarily unavailable. (${response.status}: ${errorMsg})` }]);
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [...prev, { role: "model", content: "Network error. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end">
            {isOpen && (
                <Card className="w-[320px] sm:w-[350px] h-[450px] flex flex-col mb-4 shadow-2xl overflow-hidden border-primary/20 animate-in slide-in-from-bottom-5">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Bot className="w-5 h-5" />
                            <h3 className="font-semibold">StableX Support</h3>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => setIsOpen(false)}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === "user"
                                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                                    : "bg-card border border-border rounded-tl-sm text-foreground"
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-card border border-border p-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Thinking...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-card border-t flex items-center gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask a question..."
                            className="flex-1 text-sm border-muted-foreground/30 focus-visible:ring-primary/50"
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            disabled={isLoading}
                        />
                        <Button size="icon" onClick={handleSend} disabled={!input.trim() || isLoading} className="h-9 w-9 shrink-0">
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </Card>
            )}

            {/* Toggle Button */}
            <Button
                onClick={() => setIsOpen(!isOpen)}
                size="icon"
                className="w-14 h-14 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-transform hover:scale-105 active:scale-95"
            >
                {isOpen ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
            </Button>
        </div>
    );
}
