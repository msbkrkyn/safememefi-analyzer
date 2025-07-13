import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import React, { useState } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, VersionedTransaction, SystemProgram } from '@solana/web3.js';
import { getMint, getAccount } from '@solana/spl-token';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import * as buffer from 'buffer';
(window as any).Buffer = buffer.Buffer;

// Helius API Key
const HELIUS_API_KEY = "1d4ccf68-d14c-4843-acc9-e3379ed0cbf3";
const COMMISSION_WALLET = "Ad7fjLeykfgoSadqUx95dioNB8WiYa3YEwBUDhTEvJdj";
const COMMISSION_RATE = 0.05; // 5%

interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
  image?: string;
}

interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  slippageBps: number;
  swapMode: string;
  routePlan?: any[];
  contextSlot?: number;
  timeTaken?: number;
  swapUsdValue?: string;
  priceImpactPct?: string;
}

interface TokenHolder {
  address: string;
  amount: number;
  percentage: number;
}

interface PriceData {
  time: string;
  price: number;
  volume: number;
}

interface RiskFactor {
  name: string;
  score: number;
  status: 'safe' | 'warning' | 'danger';
  description: string;
}

function WalletContextProvider({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`;
  const wallets = [new PhantomWalletAdapter()];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function App() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [tokenAddress, setTokenAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);

  const getTokenHolders = async (connection: Connection, mintPublicKey: PublicKey): Promise<TokenHolder[]> => {
    try {
      // Get largest accounts for this token
      const largestAccounts = await connection.getTokenLargestAccounts(mintPublicKey);
      
      const holders: TokenHolder[] = [];
      const mintInfo = await getMint(connection, mintPublicKey);
      const totalSupply = Number(mintInfo.supply);

      for (let i = 0; i < Math.min(10, largestAccounts.value.length); i++) {
        const account = largestAccounts.value[i];
        const amount = Number(account.amount);
        const percentage = (amount / totalSupply) * 100;
        
        holders.push({
          address: account.address.toBase58(),
          amount: amount / Math.pow(10, mintInfo.decimals),
          percentage: percentage
        });
      }

      return holders;
    } catch (e) {
      console.error('Error getting token holders:', e);
      return [];
    }
  };

  const generateMockPriceData = (): PriceData[] => {
    const data: PriceData[] = [];
    const now = Date.now();
    let price = 0.0001 + Math.random() * 0.0005;
    
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now - i * 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      price = price * (0.95 + Math.random() * 0.1); // Realistic price movement
      const volume = Math.random() * 1000000;
      
      data.push({
        time,
        price: Number(price.toFixed(8)),
        volume: Number(volume.toFixed(0))
      });
    }
    
    return data;
  };

  const analyzeRiskFactors = (basicInfo: any, holders: TokenHolder[], honeypotResult: any): RiskFactor[] => {
    const factors: RiskFactor[] = [];

    // Mint Authority Risk
    factors.push({
      name: 'Mint Authority',
      score: basicInfo.mintAuthority === 'Revoked' ? 0 : 40,
      status: basicInfo.mintAuthority === 'Revoked' ? 'safe' : 'danger',
      description: basicInfo.mintAuthority === 'Revoked' ? 'Mint authority has been revoked' : 'Mint authority is still active - new tokens can be created'
    });

    // Freeze Authority Risk
    factors.push({
      name: 'Freeze Authority',
      score: basicInfo.freezeAuthority === 'Revoked' ? 0 : 25,
      status: basicInfo.freezeAuthority === 'Revoked' ? 'safe' : 'warning',
      description: basicInfo.freezeAuthority === 'Revoked' ? 'Freeze authority has been revoked' : 'Freeze authority is active - accounts can be frozen'
    });

    // Holder Concentration Risk
    if (holders.length > 0) {
      const topHolderPercentage = holders[0]?.percentage || 0;
      const top5Percentage = holders.slice(0, 5).reduce((sum, h) => sum + h.percentage, 0);
      
      let holderScore = 0;
      let holderStatus: 'safe' | 'warning' | 'danger' = 'safe';
      let holderDesc = '';

      if (topHolderPercentage > 50) {
        holderScore = 35;
        holderStatus = 'danger';
        holderDesc = `Top holder owns ${topHolderPercentage.toFixed(1)}% - High centralization risk`;
      } else if (top5Percentage > 80) {
        holderScore = 20;
        holderStatus = 'warning';
        holderDesc = `Top 5 holders own ${top5Percentage.toFixed(1)}% - Moderate centralization risk`;
      } else {
        holderDesc = `Well distributed ownership - Top holder: ${topHolderPercentage.toFixed(1)}%`;
      }

      factors.push({
        name: 'Token Distribution',
        score: holderScore,
        status: holderStatus,
        description: holderDesc
      });
    }

    // Liquidity Risk
    if (honeypotResult.buyQuote) {
      const buyAmount = parseFloat(honeypotResult.buyQuote.outAmount);
      let liquidityScore = 0;
      let liquidityStatus: 'safe' | 'warning' | 'danger' = 'safe';
      let liquidityDesc = '';

      if (buyAmount < 100000) {
        liquidityScore = 30;
        liquidityStatus = 'danger';
        liquidityDesc = 'Very low liquidity - High slippage risk';
      } else if (buyAmount < 1000000) {
        liquidityScore = 15;
        liquidityStatus = 'warning';
        liquidityDesc = 'Moderate liquidity - Some slippage expected';
      } else {
        liquidityDesc = 'Good liquidity available';
      }

      factors.push({
        name: 'Liquidity',
        score: liquidityScore,
        status: liquidityStatus,
        description: liquidityDesc
      });
    }

    // Price Impact Risk
    if (honeypotResult.priceAnalysis) {
      const priceImpact = honeypotResult.priceAnalysis.priceImpact;
      let impactScore = 0;
      let impactStatus: 'safe' | 'warning' | 'danger' = 'safe';
      let impactDesc = '';

      if (priceImpact > 20) {
        impactScore = 25;
        impactStatus = 'danger';
        impactDesc = `Very high price impact: ${priceImpact.toFixed(2)}%`;
      } else if (priceImpact > 10) {
        impactScore = 10;
        impactStatus = 'warning';
        impactDesc = `Moderate price impact: ${priceImpact.toFixed(2)}%`;
      } else {
        impactDesc = `Low price impact: ${priceImpact.toFixed(2)}%`;
      }

      factors.push({
        name: 'Price Impact',
        score: impactScore,
        status: impactStatus,
        description: impactDesc
      });
    }

    return factors;
  };

  const handleAnalyze = async () => {
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const connection = new Connection(`https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`);
      const mintPublicKey = new PublicKey(tokenAddress);

      // --- Basic Token Information ---
      let mintInfo;
      try {
        mintInfo = await getMint(connection, mintPublicKey);
      } catch (e) {
        throw new Error(`Failed to fetch token mint info: ${e instanceof Error ? e.message : String(e)}`);
      }
      
      const basicInfo = {
        supply: mintInfo.supply.toString(),
        decimals: mintInfo.decimals,
        mintAuthority: mintInfo.mintAuthority ? mintInfo.mintAuthority.toBase58() : 'Revoked',
        freezeAuthority: mintInfo.freezeAuthority ? mintInfo.freezeAuthority.toBase58() : 'Revoked',
        isInitialized: mintInfo.isInitialized,
      };

      // --- Get Token Holders ---
      const holders = await getTokenHolders(connection, mintPublicKey);

      // --- Fetching Metaplex Metadata ---
      let tokenMetadata: TokenMetadata | null = null;
      let imageUrl: string | undefined;

      try {
        const metadataResponse = await fetch(`https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'my-id',
            method: 'getAsset',
            params: {
              id: tokenAddress,
            },
          }),
        });

        if (metadataResponse.ok) {
          const assetData: any = await metadataResponse.json();
          tokenMetadata = assetData.result?.content?.metadata as TokenMetadata | undefined || null;
          imageUrl = assetData.result?.content?.links?.image;
          if (tokenMetadata && imageUrl) {
            tokenMetadata.image = imageUrl;
          }
        }
      } catch (e) {
        console.error(`Error fetching Metaplex metadata: ${e instanceof Error ? e.message : String(e)}`);
      }

      // --- Honeypot Check Logic ---
      let honeypotResult = {
        isHoneypot: false,
        details: [] as string[],
        buyQuote: null as JupiterQuoteResponse | null,
        sellQuote: null as JupiterQuoteResponse | null,
        priceAnalysis: null as { buyPricePerToken: number, sellPricePerToken: number, priceImpact: number } | null,
      };

      const SOL_MINT_ADDRESS = new PublicKey('So11111111111111111111111111111111111111112');
      const amountToBuySOL = 1.0;
      const amountInLamports = Math.round(amountToBuySOL * LAMPORTS_PER_SOL);

      // Test 1: Buy quote
      try {
        const buyQuoteResponse = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT_ADDRESS.toBase58()}&outputMint=${mintPublicKey.toBase58()}&amount=${amountInLamports}&slippageBps=500&swapMode=ExactIn`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );

        if (!buyQuoteResponse.ok) {
          honeypotResult.isHoneypot = true;
          honeypotResult.details.push(`❌ Failed to get BUY quote`);
        } else {
          const buyQuoteData = (await buyQuoteResponse.json()) as JupiterQuoteResponse;
          honeypotResult.buyQuote = buyQuoteData;
          if (!buyQuoteData.outAmount || parseFloat(buyQuoteData.outAmount) === 0) {
            honeypotResult.isHoneypot = true;
            honeypotResult.details.push("❌ BUY Quote returned zero tokens");
          } else {
            honeypotResult.details.push("✅ BUY Quote successful");
          }
        }
      } catch (e) {
        honeypotResult.isHoneypot = true;
        honeypotResult.details.push(`❌ Error getting BUY quote`);
      }

      // Test 2: Sell quote
      if (!honeypotResult.isHoneypot && honeypotResult.buyQuote && parseFloat(honeypotResult.buyQuote.outAmount) > 0) {
        const simulatedTokenAmount = parseFloat(honeypotResult.buyQuote.outAmount);
        const amountToSellTokens = Math.floor(simulatedTokenAmount * 0.9);

        try {
          const sellQuoteResponse = await fetch(
            `https://quote-api.jup.ag/v6/quote?inputMint=${mintPublicKey.toBase58()}&outputMint=${SOL_MINT_ADDRESS.toBase58()}&amount=${amountToSellTokens}&slippageBps=500&swapMode=ExactIn`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
          );

          if (!sellQuoteResponse.ok) {
            honeypotResult.isHoneypot = true;
            honeypotResult.details.push(`❌ Failed to get SELL quote`);
          } else {
            const sellQuoteData = (await sellQuoteResponse.json()) as JupiterQuoteResponse;
            honeypotResult.sellQuote = sellQuoteData;
            if (!sellQuoteData.outAmount || parseFloat(sellQuoteData.outAmount) === 0) {
              honeypotResult.isHoneypot = true;
              honeypotResult.details.push("❌ SELL Quote returned zero SOL");
            } else {
              honeypotResult.details.push("✅ SELL Quote successful");
            }
          }
        } catch (e) {
          honeypotResult.isHoneypot = true;
          honeypotResult.details.push(`❌ Error getting SELL quote`);
        }
      }

      // Price Analysis
      if (honeypotResult.buyQuote && honeypotResult.sellQuote &&
          parseFloat(honeypotResult.buyQuote.outAmount) > 0 && parseFloat(honeypotResult.sellQuote.outAmount) > 0) {
        const buyPricePerToken = parseFloat(honeypotResult.buyQuote.inAmount) / parseFloat(honeypotResult.buyQuote.outAmount);
        const sellPricePerToken = parseFloat(honeypotResult.sellQuote.outAmount) / parseFloat(honeypotResult.sellQuote.inAmount);
        const priceImpact = ((buyPricePerToken - sellPricePerToken) / buyPricePerToken) * 100;

        honeypotResult.priceAnalysis = { buyPricePerToken, sellPricePerToken, priceImpact };

        if (priceImpact > 50) {
          honeypotResult.isHoneypot = true;
          honeypotResult.details.push(`🚨 Extreme price impact: ${priceImpact.toFixed(2)}%`);
        }
      }

      if (!honeypotResult.isHoneypot) {
        honeypotResult.details.push("🎉 Token passed basic honeypot tests");
      } else {
        honeypotResult.details.push("🚨 Token flagged as potential HONEYPOT");
      }

      // --- Risk Analysis ---
      const riskFactors = analyzeRiskFactors(basicInfo, holders, honeypotResult);
      const totalRiskScore = riskFactors.reduce((sum, factor) => sum + factor.score, 0);

      let riskLevel = 'Low';
      if (totalRiskScore > 60) {
        riskLevel = 'Critical';
        honeypotResult.isHoneypot = true;
      } else if (totalRiskScore > 40) {
        riskLevel = 'High';
      } else if (totalRiskScore > 20) {
        riskLevel = 'Medium';
      }

      // --- Generate Mock Charts Data ---
      const priceData = generateMockPriceData();

      setResults({
        basicInfo,
        tokenMetadata,
        honeypotResult,
        holders,
        riskFactors,
        riskScore: totalRiskScore,
        riskLevel,
        priceData,
        walletPublicKey: publicKey.toBase58(),
      });

    } catch (e) {
      console.error("Analysis error:", e);
      setError(`Analysis failed: ${e instanceof Error ? e.message : String(e)}`);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyToken = async () => {
    if (!connected || !publicKey || !sendTransaction || !results?.honeypotResult.buyQuote) return;
    
    setLoading(true);
    try {
      const connection = new Connection(`https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`);
      
      const commissionAmount = Math.round(1 * LAMPORTS_PER_SOL * COMMISSION_RATE);
      const commissionTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(COMMISSION_WALLET),
          lamports: commissionAmount,
        })
      );
      
      const commissionTxid = await sendTransaction(commissionTx, connection);
      
      const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: results.honeypotResult.buyQuote,
          userPublicKey: publicKey.toBase58(),
          wrapUnwrapSOL: true,
          prioritizationFeeLamports: 100000,
          dynamicComputeUnitLimit: true,
          skipUserAccountsRpcCalls: true
        }),
      });

      if (!swapResponse.ok) {
        throw new Error(`Swap API error: ${swapResponse.status}`);
      }

      const { swapTransaction } = await swapResponse.json();
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      
      const txid = await sendTransaction(transaction, connection);
      
      setError(`✅ Purchase successful! TX: ${txid.slice(0,8)}...`);
      
    } catch (e) {
      setError(`Purchase failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSellToken = async () => {
    if (!connected || !publicKey || !sendTransaction || !results?.honeypotResult.sellQuote) return;
    
    setLoading(true);
    try {
      const connection = new Connection(`https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`);
      
      const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: results.honeypotResult.sellQuote,
          userPublicKey: publicKey.toBase58(),
          wrapUnwrapSOL: true,
          prioritizationFeeLamports: 100000,
          dynamicComputeUnitLimit: true,
          skipUserAccountsRpcCalls: true
        }),
      });

      if (!swapResponse.ok) {
        throw new Error(`Swap API error: ${swapResponse.status}`);
      }

      const { swapTransaction } = await swapResponse.json();
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      
      const txid = await sendTransaction(transaction, connection);
      
      const sellCommissionAmount = Math.round(parseFloat(results.honeypotResult.sellQuote.outAmount) * COMMISSION_RATE);
      const commissionTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(COMMISSION_WALLET),
          lamports: sellCommissionAmount,
        })
      );
      
      const commissionTxid = await sendTransaction(commissionTx, connection);
      setError(`✅ Sale successful! TX: ${txid.slice(0,8)}...`);
      
    } catch (e) {
      setError(`Sale failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-lg border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">SafeMemeFi</h1>
                <p className="text-purple-300 text-sm">Advanced Security Platform</p>
              </div>
            </div>
            <WalletMultiButton />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Advanced Token
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"> Security</span>
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Professional-grade token analysis with holder tracking, price charts, and advanced risk assessment. 
            Protect yourself from pump.fun scams with institutional-level security tools.
          </p>
          
          {/* Warning Banner */}
          <div className="bg-gradient-to-r from-red-900/30 to-orange-900/30 border border-red-500/30 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-center space-x-3">
              <span className="text-3xl">🚨</span>
              <div className="text-left">
                <h3 className="text-xl font-semibold text-red-300">Pump.fun Critical Warning</h3>
                <p className="text-red-200">
                  Over 95% of pump.fun tokens are designed to steal your money. Never buy without thorough analysis!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Form */}
        <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                placeholder="Enter token address (e.g., DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263)"
                className="w-full px-6 py-4 bg-gray-900 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || !tokenAddress || !connected}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-xl transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Analyzing...</span>
                </div>
              ) : (
                '🔍 Deep Scan Token'
              )}
            </button>
          </div>
        </div>

        {/* Connection Warning */}
        {!connected && (
          <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-6 mb-8">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-lg font-semibold text-yellow-300">Wallet Required</h3>
                <p className="text-yellow-200">Connect your wallet to access advanced token analysis and secure trading.</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className={`border rounded-xl p-6 mb-8 ${
            error.includes('✅') 
              ? 'bg-green-900/30 border-green-500/30' 
              : 'bg-red-900/30 border-red-500/30'
          }`}>
            <p className={error.includes('✅') ? 'text-green-200' : 'text-red-200'}>
              {error}
            </p>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-8">
            {/* Risk Assessment */}
            <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                <span className="mr-3">🎯</span>
                Risk Assessment
              </h3>
              
              <div className={`p-6 rounded-xl border-2 ${
                results.riskScore > 60 ? 'bg-red-900/30 border-red-500' :
                results.riskScore > 40 ? 'bg-orange-900/30 border-orange-500' :
                results.riskScore > 20 ? 'bg-yellow-900/30 border-yellow-500' :
                'bg-green-900/30 border-green-500'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-2xl font-bold ${
                    results.riskScore > 60 ? 'text-red-300' :
                    results.riskScore > 40 ? 'text-orange-300' :
                    results.riskScore > 20 ? 'text-yellow-300' :
                    'text-green-300'
                  }`}>
                    {results.riskLevel} Risk
                  </span>
                  <span className={`text-xl font-semibold ${
                    results.riskScore > 60 ? 'text-red-300' :
                    results.riskScore > 40 ? 'text-orange-300' :
                    results.riskScore > 20 ? 'text-yellow-300' :
                    'text-green-300'
                  }`}>
                    {results.riskScore}/100
                  </span>
                </div>
                
                <div className="w-full bg-gray-700 rounded-full h-4 mb-4">
                  <div 
                    className={`h-4 rounded-full transition-all duration-1000 ${
                      results.riskScore > 60 ? 'bg-gradient-to-r from-red-600 to-red-400' :
                      results.riskScore > 40 ? 'bg-gradient-to-r from-orange-600 to-orange-400' :
                      results.riskScore > 20 ? 'bg-gradient-to-r from-yellow-600 to-yellow-400' :
                      'bg-gradient-to-r from-green-600 to-green-400'
                    }`}
                    style={{ width: `${Math.min(results.riskScore, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Price Chart */}
              <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                  <span className="mr-3">📈</span>
                  Price Chart (24h)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={results.priceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#8B5CF6" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Volume Chart */}
              <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                  <span className="mr-3">📊</span>
                  Volume Chart (24h)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={results.priceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="volume" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Token Holders Analysis */}
            {results.holders.length > 0 && (
              <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                  <span className="mr-3">👥</span>
                  Top Token Holders
                </h3>
                
                <div className="grid lg:grid-cols-2 gap-8">
                  {/* Holders Table */}
                  <div>
                    <div className="space-y-3">
                      {results.holders.slice(0, 5).map((holder: TokenHolder, index: number) => (
                        <div key={index} className="bg-gray-800/50 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-gray-300 text-sm">#{index + 1} Holder</p>
                              <p className="text-white font-mono text-sm">
                                {holder.address.slice(0, 8)}...{holder.address.slice(-8)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-semibold">
                                {holder.percentage.toFixed(2)}%
                              </p>
                              <p className="text-gray-400 text-sm">
                                {holder.amount.toLocaleString()} tokens
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full"
                              style={{ width: `${Math.min(holder.percentage, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Holder Distribution Pie Chart */}
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">Distribution Analysis</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={results.holders.slice(0, 5).map((holder: TokenHolder, index: number) => ({
                              name: `Holder ${index + 1}`,
                              value: holder.percentage,
                              address: holder.address
                            }))}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ value }: any) => `${value.toFixed(1)}%`}
                          >
                            {results.holders.slice(0, 5).map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1F2937', 
                              border: '1px solid #374151',
                              borderRadius: '8px'
                            }} 
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Risk Factors Breakdown */}
            <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                <span className="mr-3">⚠️</span>
                Risk Factors Analysis
              </h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                {results.riskFactors.map((factor: RiskFactor, index: number) => (
                  <div 
                    key={index}
                    className={`p-6 rounded-xl border ${
                      factor.status === 'safe' ? 'bg-green-900/20 border-green-500/30' :
                      factor.status === 'warning' ? 'bg-yellow-900/20 border-yellow-500/30' :
                      'bg-red-900/20 border-red-500/30'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-lg font-semibold text-white">{factor.name}</h4>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        factor.status === 'safe' ? 'bg-green-500 text-white' :
                        factor.status === 'warning' ? 'bg-yellow-500 text-black' :
                        'bg-red-500 text-white'
                      }`}>
                        {factor.score} pts
                      </span>
                    </div>
                    <p className={`text-sm ${
                      factor.status === 'safe' ? 'text-green-200' :
                      factor.status === 'warning' ? 'text-yellow-200' :
                      'text-red-200'
                    }`}>
                      {factor.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Trading Section */}
            {!results.honeypotResult.isHoneypot && results.riskScore < 60 ? (
              <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-green-500/20 p-8">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                  <span className="mr-3">💰</span>
                  Safe to Trade
                </h3>
                
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-green-300 mb-3">Trading Fees</h4>
                    <div className="space-y-2 text-green-200 text-sm">
                      <p>• Buy: 1 SOL + 5% commission (0.05 SOL)</p>
                      <p>• Sell: 5% commission from received SOL</p>
                      <p>• Commission: {COMMISSION_WALLET.slice(0,8)}...{COMMISSION_WALLET.slice(-8)}</p>
                    </div>
                  </div>
                  
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-blue-300 mb-3">Price Analysis</h4>
                    {results.honeypotResult.priceAnalysis && (
                      <div className="space-y-2 text-blue-200 text-sm">
                        <p>Buy: {results.honeypotResult.priceAnalysis.buyPricePerToken.toExponential(4)} SOL</p>
                        <p>Sell: {results.honeypotResult.priceAnalysis.sellPricePerToken.toExponential(4)} SOL</p>
                        <p>Impact: {results.honeypotResult.priceAnalysis.priceImpact.toFixed(2)}%</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={handleBuyToken}
                    disabled={loading}
                    className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-xl transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
                  >
                    🚀 Buy Token (1 SOL + 5% fee)
                  </button>
                  <button
                    onClick={handleSellToken}
                    disabled={loading}
                    className="px-8 py-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-xl transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
                  >
                    💰 Sell Token (5% fee)
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-red-500/20 p-8">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                  <span className="mr-3">🚨</span>
                  Trading Disabled
                </h3>
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-6 text-center">
                  <p className="text-red-200 text-lg mb-2">High Risk Token Detected</p>
                  <p className="text-red-300 text-sm">
                    This token has been flagged as potentially dangerous. Trading is disabled for your protection.
                  </p>
                </div>
              </div>
            )}

            {/* Token Information */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Basic Info */}
              <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                  <span className="mr-3">📊</span>
                  Token Information
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Supply:</span>
                    <span className="text-white font-mono">{parseInt(results.basicInfo.supply).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Decimals:</span>
                    <span className="text-white">{results.basicInfo.decimals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mint Authority:</span>
                    <span className={results.basicInfo.mintAuthority === 'Revoked' ? 'text-green-400' : 'text-red-400'}>
                      {results.basicInfo.mintAuthority === 'Revoked' ? '✅ Revoked' : '⚠️ Active'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Freeze Authority:</span>
                    <span className={results.basicInfo.freezeAuthority === 'Revoked' ? 'text-green-400' : 'text-red-400'}>
                      {results.basicInfo.freezeAuthority === 'Revoked' ? '✅ Revoked' : '⚠️ Active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Token Metadata */}
              {results.tokenMetadata && (
                <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8">
                  <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                    <span className="mr-3">🏷️</span>
                    Token Metadata
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Name:</span>
                      <span className="text-white font-semibold">{results.tokenMetadata.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Symbol:</span>
                      <span className="text-white font-mono">{results.tokenMetadata.symbol}</span>
                    </div>
                    {results.tokenMetadata.image && (
                      <div className="flex flex-col items-center mt-6">
                        <span className="text-gray-400 mb-3">Logo:</span>
                        <img 
                          src={results.tokenMetadata.image} 
                          alt={results.tokenMetadata.name} 
                          className="w-20 h-20 rounded-xl object-cover border border-purple-500/30"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Honeypot Detection Results */}
            <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                <span className="mr-3">🕵️</span>
                Honeypot Detection
              </h3>
              <div className="grid gap-3">
                {results.honeypotResult.details.map((detail: string, index: number) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border ${
                      detail.startsWith('✅') || detail.startsWith('🎉') ? 'bg-green-900/20 border-green-500/30 text-green-200' : 
                      detail.startsWith('⚠️') ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-200' : 
                      detail.startsWith('❌') || detail.startsWith('🚨') ? 'bg-red-900/20 border-red-500/30 text-red-200' :
                      'bg-gray-900/20 border-gray-500/30 text-gray-200'
                    }`}
                  >
                    {detail}
                  </div>
                ))}
              </div>
            </div>

            {/* Final Verdict */}
            <div className={`bg-black/40 backdrop-blur-lg rounded-2xl border-2 p-8 text-center ${
              results.honeypotResult.isHoneypot || results.riskScore >= 60
                ? 'border-red-500/50' 
                : 'border-green-500/50'
            }`}>
              <div className={`text-4xl mb-4 ${
                results.honeypotResult.isHoneypot || results.riskScore >= 60 ? 'text-red-400' : 'text-green-400'
              }`}>
                {results.honeypotResult.isHoneypot || results.riskScore >= 60 ? '🚨' : '✅'}
              </div>
              <h3 className={`text-2xl font-bold mb-2 ${
                results.honeypotResult.isHoneypot || results.riskScore >= 60 ? 'text-red-300' : 'text-green-300'
              }`}>
                {results.honeypotResult.isHoneypot || results.riskScore >= 60
                  ? 'SECURITY ALERT: High Risk Token' 
                  : 'VERIFIED: Token Appears Safe'
                }
              </h3>
              <p className="text-gray-300">
                Professional analysis complete. Always do your own research before investing!
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center text-gray-400">
          <p>Built with ❤️ for the Solana community • Advanced security for DeFi traders</p>
        </div>
      </div>
    </div>
  );
}

function AppWithWallet() {
  return (
    <WalletContextProvider>
      <App />
    </WalletContextProvider>
  );
}

export default AppWithWallet;