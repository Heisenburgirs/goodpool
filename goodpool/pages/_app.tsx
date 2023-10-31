import '../styles/globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import type { AppProps } from 'next/app';
import { configureChains, createConfig, WagmiConfig } from 'wagmi';
import {
  goerli,
  polygonMumbai,
} from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { createPublicClient, http } from 'viem'
import { GlobalwProviderComponent } from '../globalContext/GlobalContext';
import client from '../apollo/apollo.js';
import { ApolloProvider } from '@apollo/client';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [
    polygonMumbai,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [goerli] : []),
  ],
  [publicProvider()]
);

const { connectors } = getDefaultWallets({
  appName: 'GoodPool',
  projectId: '', // walletconnect project-id goes here
  chains,
});

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient: createPublicClient({
    chain: polygonMumbai,
    transport: http()
  }),
  webSocketPublicClient,
});

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ApolloProvider client={client}>
      <WagmiConfig config={wagmiConfig}>
        <RainbowKitProvider chains={chains}>
         <GlobalwProviderComponent>
            <ToastContainer />
              <Component {...pageProps} />
          </GlobalwProviderComponent>
        </RainbowKitProvider>
      </WagmiConfig>
    </ApolloProvider>
  );
}

export default MyApp;
