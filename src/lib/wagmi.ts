import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, bsc, polygon } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

export const wagmiConfig = createConfig({
    chains: [mainnet, sepolia, bsc, polygon],
    connectors: [
        injected(),
        // Normally you would supply a WalletConnect projectId here
        // walletConnect({ projectId: 'YOUR_PROJECT_ID' }),
    ],
    transports: {
        [mainnet.id]: http(),
        [sepolia.id]: http(),
        [bsc.id]: http(),
        [polygon.id]: http(),
    },
})
