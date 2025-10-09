import { PrivyClientConfig } from '@privy-io/react-auth';

export const privyConfig: PrivyClientConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  config: {
    // Appearance
    appearance: {
      theme: 'light',
      accentColor: '#2563eb',
      logo: '/logo.png',
    },
    
    // Login methods
    loginMethods: ['email', 'wallet', 'google'],
    
    // Wallet configuration
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
      requireUserPasswordOnCreate: false,
    },
    
    // External wallets
    externalWallets: {
      solana: {
        connectors: ['phantom', 'solflare', 'backpack'],
      },
    },
    
    // Default chain (not used for Solana but required by Privy)
    defaultChain: {
      id: 1,
      name: 'Ethereum Mainnet',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: ['https://eth-mainnet.alchemyapi.io/v2/demo'] },
        public: { http: ['https://eth-mainnet.alchemyapi.io/v2/demo'] },
      },
    },
    
    // Legal configuration
    legal: {
      termsAndConditionsUrl: '/terms',
      privacyPolicyUrl: '/privacy',
    },
    
    // Customize UI
    ui: {
      title: 'Academic Credential Verification',
      description: 'Secure blockchain-based credential verification',
      privacyPolicyUrl: '/privacy',
      termsAndConditionsUrl: '/terms',
    },
  },
};

// Server-side configuration
export const privyServerConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
};