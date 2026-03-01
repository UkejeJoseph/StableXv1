export function PriceSourceIndicator({
    source,
    stale,
    timestamp
}: {
    source: string;
    stale: boolean;
    timestamp: string;
}) {
    if (stale) {
        return (
            <span className="text-yellow-500 text-xs flex items-center gap-1">
                ⚠️ Prices may be delayed
            </span>
        );
    }

    return (
        <span className="text-green-500 text-xs flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live prices ({source})
        </span>
    );
}

export function PriceLoadingIndicator() {
    return (
        <div className="flex items-center gap-2 animate-pulse text-muted-foreground text-xs font-medium">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
            Updating prices...
        </div>
    );
}
