import { postTweet, TweetResponse } from './services/tweetService.ts';
import React, { useState, useEffect } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, VersionedTransaction, SystemProgram } from '@solana/web3.js';
import { getMint, getAccount } from '@solana/spl-token';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

// Environment variables
const HELIUS_API_KEY = process.env.REACT_APP_HELIUS_API_KEY || '786494a0-4d95-474f-a824-3ccddeb78fec';
const COMMISSION_WALLET = process.env.REACT_APP_COMMISSION_WALLET || 'Ad7fjLeykfgoSadqUx95dioNB8WiYa3YEwBUDhTEvJdj';
const COMMISSION_RATE = parseFloat(process.env.REACT_APP_COMMISSION_RATE || '0.05');

// Type definitions
interface TokenHolder {
  address: string;
  amount: number;
  percentage: number;
}

interface SecurityDetail {
  name: string;
  score: number;
  status: 'safe' | 'warning' | 'danger';
  description: string;
  category: string;
}

interface HoneypotResult {
  isHoneypot: boolean;
  details: string[];
  buyQuote: any;
  sellQuote: any;
  priceAnalysis: {
    buyPrice: number;
    sellPrice: number;
    priceImpact: number;
  } | null;
}

interface MarketData {
  price: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  source: string;
}

interface TokenMetadata {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: any[];
}

interface BasicInfo {
  supply: string;
  decimals: number;
  mintAuthority: string;
  freezeAuthority: string;
  isInitialized: boolean;
}

interface SocialLinks {
  twitter: string;
  telegram: string;
  website: string;
}

interface PricePrediction {
  timeframe: string;
  period: string;
  prediction: number;
  confidence: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  factors: string[];
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string;
  targetPrice: number;
  probabilityRange: {
    min: number;
    max: number;
  };
}

interface TechnicalAnalysis {
  momentum: number;
  volatility: number;
  liquidity: number;
  marketSentiment: number;
  technicalScore: number;
  signals: string[];
}

interface AnalysisResults {
  basicInfo: BasicInfo;
  tokenMetadata: TokenMetadata | null;
  honeypotResult: HoneypotResult;
  holders: TokenHolder[];
  riskFactors: SecurityDetail[];
  riskScore: number;
  riskLevel: string;
  marketData: MarketData | null;
  currentPrice: number;
  marketCap: number;
  socialLinks: SocialLinks;
  userBalance: number;
  technicalAnalysis: TechnicalAnalysis;
  predictions: PricePrediction[];
}

// Wallet Context Provider
function WalletContextProvider({ children }: { children: any }) {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`;
  
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ];

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

// Main SafeMemeFi Component
function SafeMemeFiApp() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [tokenAddress, setTokenAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<AnalysisResults | undefined>(undefined);
  const [userTokenBalance, setUserTokenBalance] = useState(0);

  // Helius RPC Connection
  const connection = new Connection(`https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`, 'confirmed');

  // Advanced Technical Analysis
  const performTechnicalAnalysis = async (
    basicInfo: BasicInfo,
    holders: TokenHolder[],
    marketData: MarketData | null,
    honeypotResult: HoneypotResult
  ): Promise<TechnicalAnalysis> => {
    const analysis: TechnicalAnalysis = {
      momentum: 0,
      volatility: 0,
      liquidity: 0,
      marketSentiment: 0,
      technicalScore: 0,
      signals: []
    };

    // Momentum Analysis (0-100)
    if (marketData?.priceChange24h) {
      if (marketData.priceChange24h > 20) {
        analysis.momentum = 85;
        analysis.signals.push('🚀 Strong bullish momentum (+' + marketData.priceChange24h.toFixed(1) + '%)');
      } else if (marketData.priceChange24h > 5) {
        analysis.momentum = 70;
        analysis.signals.push('📈 Positive momentum (+' + marketData.priceChange24h.toFixed(1) + '%)');
      } else if (marketData.priceChange24h > -5) {
        analysis.momentum = 50;
        analysis.signals.push('➡️ Sideways momentum (' + marketData.priceChange24h.toFixed(1) + '%)');
      } else if (marketData.priceChange24h > -20) {
        analysis.momentum = 30;
        analysis.signals.push('📉 Negative momentum (' + marketData.priceChange24h.toFixed(1) + '%)');
      } else {
        analysis.momentum = 15;
        analysis.signals.push('🔻 Strong bearish momentum (' + marketData.priceChange24h.toFixed(1) + '%)');
      }
    } else {
      analysis.momentum = 40;
      analysis.signals.push('📊 No clear momentum data');
    }

    // Volatility Analysis (0-100, higher = more volatile)
    const priceImpact = honeypotResult.priceAnalysis?.priceImpact || 0;
    if (Math.abs(priceImpact) > 30) {
      analysis.volatility = 95;
      analysis.signals.push('⚡ Extreme volatility detected');
    } else if (Math.abs(priceImpact) > 15) {
      analysis.volatility = 75;
      analysis.signals.push('🌊 High volatility');
    } else if (Math.abs(priceImpact) > 5) {
      analysis.volatility = 50;
      analysis.signals.push('📊 Moderate volatility');
    } else {
      analysis.volatility = 25;
      analysis.signals.push('🔒 Low volatility');
    }

    // Liquidity Analysis (0-100)
    const volume24h = marketData?.volume24h || 0;
    const marketCap = marketData?.marketCap || 0;
    const volumeToMcapRatio = marketCap > 0 ? (volume24h / marketCap) * 100 : 0;
    
    if (volumeToMcapRatio > 50) {
      analysis.liquidity = 90;
      analysis.signals.push('💧 Excellent liquidity');
    } else if (volumeToMcapRatio > 20) {
      analysis.liquidity = 75;
      analysis.signals.push('💦 Good liquidity');
    } else if (volumeToMcapRatio > 5) {
      analysis.liquidity = 50;
      analysis.signals.push('🌊 Average liquidity');
    } else if (volumeToMcapRatio > 1) {
      analysis.liquidity = 25;
      analysis.signals.push('🏜️ Low liquidity');
    } else {
      analysis.liquidity = 10;
      analysis.signals.push('🚫 Very low liquidity - HIGH RISK');
    }

    // Market Sentiment Analysis (0-100)
    const topHolderPercent = holders.length > 0 ? holders[0].percentage : 0;
    const isHoneypot = honeypotResult.isHoneypot;
    const hasMintAuthority = basicInfo.mintAuthority !== 'Revoked';
    
    let sentimentScore = 70; // Base score
    
    if (isHoneypot) {
      sentimentScore -= 40;
      analysis.signals.push('🚨 Honeypot detected - AVOID');
    }
    
    if (hasMintAuthority) {
      sentimentScore -= 20;
      analysis.signals.push('⚠️ Mint authority active - inflation risk');
    }
    
    if (topHolderPercent > 50) {
      sentimentScore -= 25;
      analysis.signals.push('🐋 Whale concentration risk');
    } else if (topHolderPercent > 30) {
      sentimentScore -= 15;
      analysis.signals.push('🐟 High holder concentration');
    }
    
    if (marketCap > 0 && marketCap < 100000) {
      sentimentScore -= 15;
      analysis.signals.push('💰 Very low market cap - high risk');
    }
    
    analysis.marketSentiment = Math.max(0, Math.min(100, sentimentScore));

    // Technical Score (0-100)
    analysis.technicalScore = Math.round(
      (analysis.momentum * 0.3) + 
      ((100 - analysis.volatility) * 0.2) + 
      (analysis.liquidity * 0.3) + 
      (analysis.marketSentiment * 0.2)
    );

    return analysis;
  };

  // Advanced Price Prediction Algorithm
  const generateAdvancedPredictions = (
    tokenData: AnalysisResults,
    technicalAnalysis: TechnicalAnalysis
  ): PricePrediction[] => {
    const { riskScore, marketData, basicInfo, holders, honeypotResult } = tokenData;
    const currentPrice = marketData?.price || tokenData.currentPrice;
    
    const predictions: PricePrediction[] = [];
    
    // Base factors for prediction
    const baseFactors = {
      security: riskScore > 70 ? -0.4 : riskScore > 50 ? -0.2 : riskScore > 30 ? -0.1 : 0.1,
      liquidity: technicalAnalysis.liquidity > 75 ? 0.2 : technicalAnalysis.liquidity > 50 ? 0.1 : technicalAnalysis.liquidity > 25 ? 0 : -0.3,
      momentum: technicalAnalysis.momentum > 75 ? 0.3 : technicalAnalysis.momentum > 50 ? 0.1 : technicalAnalysis.momentum > 25 ? 0 : -0.2,
      volatility: technicalAnalysis.volatility > 80 ? -0.2 : technicalAnalysis.volatility > 60 ? -0.1 : 0,
      marketSentiment: technicalAnalysis.marketSentiment > 75 ? 0.2 : technicalAnalysis.marketSentiment > 50 ? 0.1 : technicalAnalysis.marketSentiment > 25 ? 0 : -0.3
    };
    
    // 1 Week Prediction
    const weeklyFactors = [
      'Technical momentum analysis',
      'Liquidity assessment',
      'Whale activity monitoring',
      'Market sentiment evaluation'
    ];
    
    const weeklyPrediction = (baseFactors.security + baseFactors.liquidity + baseFactors.momentum + baseFactors.volatility + baseFactors.marketSentiment) * 15;
    const weeklyConfidence = Math.max(20, Math.min(85, 60 - (riskScore * 0.5) + (technicalAnalysis.technicalScore * 0.3)));
    
    predictions.push({
      timeframe: '1 Week',
      period: '7D',
      prediction: weeklyPrediction,
      confidence: weeklyConfidence,
      trend: weeklyPrediction > 5 ? 'bullish' : weeklyPrediction < -5 ? 'bearish' : 'neutral',
      factors: weeklyFactors,
      riskLevel: riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low',
      reasoning: riskScore > 70 ? 
        'High risk score indicates potential security issues. Strong sell recommendation.' :
        technicalAnalysis.technicalScore > 70 ?
        'Strong technical indicators suggest positive short-term outlook.' :
        'Mixed technical signals suggest cautious approach.',
      targetPrice: currentPrice * (1 + weeklyPrediction / 100),
      probabilityRange: {
        min: weeklyPrediction - 10,
        max: weeklyPrediction + 10
      }
    });
    
    // 1 Month Prediction
    const monthlyFactors = [
      'Long-term trend analysis',
      'Market cycle positioning',
      'Fundamental token metrics',
      'Ecosystem development potential'
    ];
    
    const monthlyPrediction = weeklyPrediction * 2.5 + (technicalAnalysis.marketSentiment - 50) * 0.8;
    const monthlyConfidence = Math.max(15, weeklyConfidence - 15);
    
    predictions.push({
      timeframe: '1 Month',
      period: '30D',
      prediction: monthlyPrediction,
      confidence: monthlyConfidence,
      trend: monthlyPrediction > 10 ? 'bullish' : monthlyPrediction < -10 ? 'bearish' : 'neutral',
      factors: monthlyFactors,
      riskLevel: riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low',
      reasoning: riskScore > 70 ?
        'Security concerns make long-term holding extremely risky.' :
        technicalAnalysis.liquidity < 25 ?
        'Low liquidity presents significant risks for longer holding periods.' :
        'Market conditions and token fundamentals suggest moderate outlook.',
      targetPrice: currentPrice * (1 + monthlyPrediction / 100),
      probabilityRange: {
        min: monthlyPrediction - 20,
        max: monthlyPrediction + 20
      }
    });
    
    // 3 Month Prediction
    const quarterlyFactors = [
      'Market cycle analysis',
      'Competitive positioning',
      'Regulatory environment',
      'Community growth potential'
    ];
    
    const quarterlyPrediction = monthlyPrediction * 1.8 + (technicalAnalysis.technicalScore - 50) * 0.6;
    const quarterlyConfidence = Math.max(10, monthlyConfidence - 10);
    
    predictions.push({
      timeframe: '3 Months',
      period: '90D',
      prediction: quarterlyPrediction,
      confidence: quarterlyConfidence,
      trend: quarterlyPrediction > 15 ? 'bullish' : quarterlyPrediction < -15 ? 'bearish' : 'neutral',
      factors: quarterlyFactors,
      riskLevel: riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low',
      reasoning: riskScore > 70 ?
        'High-risk tokens rarely survive 3-month periods without significant losses.' :
        technicalAnalysis.technicalScore > 60 ?
        'Strong technical foundation provides optimistic long-term outlook.' :
        'Long-term outlook depends heavily on market conditions and project development.',
      targetPrice: currentPrice * (1 + quarterlyPrediction / 100),
      probabilityRange: {
        min: quarterlyPrediction - 30,
        max: quarterlyPrediction + 30
      }
    });
    
    return predictions;
  };

  // DexScreener Market Data
  const fetchMarketData = async (mintAddress: string): Promise<MarketData | null> => {
    try {
      const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
      if (!dexResponse.ok) {
        throw new Error('Failed to fetch market data from DexScreener');
      }

      const dexData = await dexResponse.json();
      if (!dexData.pairs || dexData.pairs.length === 0) {
        return null;
      }

      const pair = dexData.pairs.sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))[0];

      return {
        price: parseFloat(pair.priceUsd) || parseFloat(pair.priceNative) || 0,
        marketCap: parseFloat(pair.marketCap) || parseFloat(pair.fdv) || 0,
        volume24h: parseFloat(pair.volume?.h24) || 0,
        priceChange24h: parseFloat(pair.priceChange?.h24) || 0,
        source: 'DexScreener'
      };
    } catch (e) {
      console.error('Error fetching market data:', e);
      return null;
    }
  };

  // Token Holders from Helius RPC
  const getRealTokenHolders = async (mintPublicKey: PublicKey): Promise<TokenHolder[]> => {
    try {
      const largestAccounts = await connection.getTokenLargestAccounts(mintPublicKey);
      const holders: TokenHolder[] = [];
      const mintInfo = await getMint(connection, mintPublicKey);
      const totalSupply = Number(mintInfo.supply);

      for (let i = 0; i < Math.min(15, largestAccounts.value.length); i++) {
        const account = largestAccounts.value[i];
        const amount = Number(account.amount);
        const percentage = (amount / totalSupply) * 100;
        
        if (percentage >= 0.01) {
          holders.push({
            address: account.address.toBase58(),
            amount: amount / Math.pow(10, mintInfo.decimals),
            percentage: percentage
          });
        }
      }

      return holders.sort((a, b) => b.percentage - a.percentage);
    } catch (e) {
      console.error('Error getting token holders:', e);
      return [];
    }
  };

  // Token Metadata from Helius
  const getRealTokenMetadata = async (tokenAddress: string): Promise<{ metadata: TokenMetadata | null, realSocialLinks: SocialLinks }> => {
    try {
      const response = await fetch(`https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'get-asset',
          method: 'getAsset',
          params: { id: tokenAddress },
        }),
      });

      const assetData = await response.json();
      const metadata = assetData.result?.content?.metadata || null;
      const imageUrl = assetData.result?.content?.links?.image;
      
      if (metadata && imageUrl) {
        metadata.image = imageUrl;
      }

      const realSocialLinks: SocialLinks = {
        twitter: '',
        telegram: '',
        website: ''
      };

      if (metadata?.external_url) {
        realSocialLinks.website = metadata.external_url;
      }

      const attributes = assetData.result?.content?.metadata?.attributes || [];
      attributes.forEach((attr: any) => {
        if (attr.trait_type?.toLowerCase().includes('twitter') || attr.trait_type?.toLowerCase().includes('x')) {
          realSocialLinks.twitter = attr.value;
        }
        if (attr.trait_type?.toLowerCase().includes('telegram')) {
          realSocialLinks.telegram = attr.value;
        }
      });

      return { metadata, realSocialLinks };
    } catch (e) {
      console.error('Error fetching metadata:', e);
      return { metadata: null, realSocialLinks: { twitter: '', telegram: '', website: '' } };
    }
  };

  // Jupiter Honeypot Check
  const performRealHoneypotCheck = async (mintPublicKey: PublicKey): Promise<HoneypotResult> => {
    const honeypotResult: HoneypotResult = {
      isHoneypot: false,
      details: [],
      buyQuote: null,
      sellQuote: null,
      priceAnalysis: null,
    };

    const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
    const amountInLamports = Math.round(1.0 * LAMPORTS_PER_SOL);

    try {
      // Test Buy Quote
      const buyResponse = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT.toBase58()}&outputMint=${mintPublicKey.toBase58()}&amount=${amountInLamports}&slippageBps=500&swapMode=ExactIn`
      );

      if (!buyResponse.ok) {
        honeypotResult.isHoneypot = true;
        honeypotResult.details.push('❌ Failed to get BUY quote - Token may not be tradeable');
      } else {
        const buyData = await buyResponse.json();
        honeypotResult.buyQuote = buyData;
        
        if (!buyData.outAmount || parseFloat(buyData.outAmount) === 0) {
          honeypotResult.isHoneypot = true;
          honeypotResult.details.push('❌ BUY Quote returned zero tokens - Potential honeypot');
        } else {
          honeypotResult.details.push('✅ BUY Quote successful - Token can be purchased');
        }
      }

      // Test Sell Quote
      if (!honeypotResult.isHoneypot && honeypotResult.buyQuote) {
        const simulatedTokenAmount = parseFloat(honeypotResult.buyQuote.outAmount);
        const amountToSell = Math.floor(simulatedTokenAmount * 0.9);

        const sellResponse = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=${mintPublicKey.toBase58()}&outputMint=${SOL_MINT.toBase58()}&amount=${amountToSell}&slippageBps=500&swapMode=ExactIn`
        );

        if (!sellResponse.ok) {
          honeypotResult.isHoneypot = true;
          honeypotResult.details.push('❌ Failed to get SELL quote - Cannot sell token');
        } else {
          const sellData = await sellResponse.json();
          honeypotResult.sellQuote = sellData;
          
          if (!sellData.outAmount || parseFloat(sellData.outAmount) === 0) {
            honeypotResult.isHoneypot = true;
            honeypotResult.details.push('❌ SELL Quote returned zero SOL - Honeypot detected');
          } else {
            honeypotResult.details.push('✅ SELL Quote successful - Token can be sold');
          }
        }
      }

      // Price Impact Analysis
      if (honeypotResult.buyQuote && honeypotResult.sellQuote) {
        const buyPrice = parseFloat(honeypotResult.buyQuote.inAmount) / parseFloat(honeypotResult.buyQuote.outAmount);
        const sellPrice = parseFloat(honeypotResult.sellQuote.outAmount) / parseFloat(honeypotResult.sellQuote.inAmount);
        const priceImpact = ((buyPrice - sellPrice) / buyPrice) * 100;

        honeypotResult.priceAnalysis = { buyPrice, sellPrice, priceImpact };

        if (Math.abs(priceImpact) > 50) {
          honeypotResult.isHoneypot = true;
          honeypotResult.details.push(`🚨 Extreme price impact: ${priceImpact.toFixed(2)}% - Very dangerous`);
        } else if (Math.abs(priceImpact) > 10) {
          honeypotResult.details.push(`⚠️ High price impact: ${priceImpact.toFixed(2)}% - Risky`);
        } else {
          honeypotResult.details.push(`✅ Acceptable price impact: ${priceImpact.toFixed(2)}%`);
        }
      }

    } catch (e) {
      console.error('Honeypot check error:', e);
      honeypotResult.isHoneypot = true;
      honeypotResult.details.push('❌ Error during security check');
    }

    if (!honeypotResult.isHoneypot) {
      honeypotResult.details.push('🎉 Token passed all security tests - Safe to trade');
    }

    return honeypotResult;
  };

const calculateRiskScore = (riskFactors, marketData) => {
  let riskScore = 30; // Base risk (daha yüksek başlangıç)
  
  // *** YENİ: Price change riski (EN ÖNEMLİ) ***
  const priceChange24h = marketData?.priceChange24h || 0;
  if (priceChange24h < -30) riskScore += 40; // %30'dan fazla düşüş = +40 risk
  else if (priceChange24h < -20) riskScore += 30; // %20-30 düşüş = +30 risk
  else if (priceChange24h < -10) riskScore += 20; // %10-20 düşüş = +20 risk
  else if (priceChange24h < -5) riskScore += 10; // %5-10 düşüş = +10 risk
  else if (priceChange24h > 100) riskScore += 25; // %100'den fazla artış = pump risk
  
  // Holder count riski
  if (riskFactors?.holderCount < 100) riskScore += 20;
  else if (riskFactors?.holderCount < 500) riskScore += 10;
  else if (riskFactors?.holderCount > 1000) riskScore -= 5;
  
  // Market cap riski
  if (marketData?.marketCap < 50000) riskScore += 25; // Çok küçük market cap
  else if (marketData?.marketCap < 100000) riskScore += 15;
  else if (marketData?.marketCap > 10000000) riskScore -= 10; // Büyük market cap güvenli
  
  // Volume riski
  if (marketData?.volume24h < 1000) riskScore += 20; // Çok düşük volume
  else if (marketData?.volume24h < 10000) riskScore += 10;
  
  // Top holder riski
  if (riskFactors?.topHolderPercentage > 50) riskScore += 20;
  else if (riskFactors?.topHolderPercentage > 30) riskScore += 10;
  
  return Math.max(0, Math.min(100, riskScore));
};

  // Get User Token Balance
  const getUserBalance = async (mintPublicKey: PublicKey): Promise<number> => {
    if (!publicKey) return 0;
    
    try {
      const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
        mint: mintPublicKey
      });

      if (tokenAccounts.value.length === 0) return 0;

      const tokenAccount = await getAccount(connection, tokenAccounts.value[0].pubkey);
      const mintInfo = await getMint(connection, mintPublicKey);
      
      return Number(tokenAccount.amount) / Math.pow(10, mintInfo.decimals);
    } catch (e) {
      return 0;
    }
  };

  // MAIN ANALYZE FUNCTION
  const handleAnalyze = async () => {
    if (!tokenAddress || tokenAddress.length < 32) {
      setError('Invalid token address');
      return;
    }

    try {
      new PublicKey(tokenAddress);
    } catch (e) {
      setError('Invalid Solana address');
      return;
    }

    setLoading(true);
    setError('')
    setResults(undefined)

    try {
      const mintPublicKey = new PublicKey(tokenAddress);

      // 1. Get Basic Token Info
      const mintInfo = await getMint(connection, mintPublicKey);
      const basicInfo: BasicInfo = {
        supply: mintInfo.supply.toString(),
        decimals: mintInfo.decimals,
        mintAuthority: mintInfo.mintAuthority ? mintInfo.mintAuthority.toBase58() : 'Revoked',
        freezeAuthority: mintInfo.freezeAuthority ? mintInfo.freezeAuthority.toBase58() : 'Revoked',
        isInitialized: mintInfo.isInitialized,
      };

      // 2. Get Token Holders
      const holders = await getRealTokenHolders(mintPublicKey);

      // 3. Get Metadata
      const { metadata, realSocialLinks } = await getRealTokenMetadata(tokenAddress);

      // 4. Get Market Data
      const marketData = await fetchMarketData(tokenAddress);

      // 5. Honeypot Check
      const honeypotResult = await performRealHoneypotCheck(mintPublicKey);

      // 6. User Balance
      const balance = await getUserBalance(mintPublicKey);
      setUserTokenBalance(balance);

      // 7. Risk Assessment - Backend'den al
let riskScore = 50;
let riskFactors = [];

try {
  const backendResponse = await fetch('http://localhost:3001/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenAddress })
  });
  
  if (backendResponse.ok) {
    const backendAnalysis = await backendResponse.json();
    riskScore = backendAnalysis.riskScore || 50;
    riskFactors = backendAnalysis.riskFactors || [];
    console.log('✅ Backend risk analysis received:', riskScore);
  } else {
    console.log('❌ Backend analysis failed, using local calculation');
  }
} catch (e) {
  console.log('❌ Backend connection failed, using local calculation');
}

      let riskLevel = 'Low';
      if (riskScore > 70) riskLevel = 'Critical';
      else if (riskScore > 50) riskLevel = 'High';
      else if (riskScore > 30) riskLevel = 'Medium';

      // 8. Calculate current price
      let currentPrice = 0;
      if (honeypotResult.buyQuote && honeypotResult.sellQuote) {
        const buyPrice = parseFloat(honeypotResult.buyQuote.inAmount) / parseFloat(honeypotResult.buyQuote.outAmount);
        const sellPrice = parseFloat(honeypotResult.sellQuote.outAmount) / parseFloat(honeypotResult.sellQuote.inAmount);
        currentPrice = (buyPrice + sellPrice) / 2;
      }

      // 9. Calculate market cap
      let calculatedMarketCap = 0;
      if (marketData && marketData.marketCap > 0) {
        calculatedMarketCap = marketData.marketCap;
      } else if (currentPrice > 0) {
        const totalSupply = parseFloat(basicInfo.supply) / Math.pow(10, basicInfo.decimals);
        calculatedMarketCap = totalSupply * currentPrice * 200;
      }

      // 10. Technical Analysis
      const technicalAnalysis = await performTechnicalAnalysis(basicInfo, holders, marketData, honeypotResult);

      const analysisResults: AnalysisResults = {
        basicInfo,
        tokenMetadata: metadata,
        honeypotResult,
        holders,
        riskFactors,
        riskScore,
        riskLevel,
        marketData,
        currentPrice,
        marketCap: calculatedMarketCap,
        socialLinks: realSocialLinks,
        userBalance: balance,
        technicalAnalysis,
        predictions: []
      };

      // 11. Generate Advanced Predictions
      const predictions = generateAdvancedPredictions(analysisResults, technicalAnalysis);
      analysisResults.predictions = predictions;

// 12. Tweet sonuçları
const formatVolume = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toString() || 'N/A';
};

const formatMarketCap = (num: number): string => {
  return num?.toLocaleString() || 'N/A';
};

const tweetText = `${analysisResults.tokenMetadata?.symbol || 'TOKEN'}
24h Change: ${analysisResults.marketData?.priceChange24h?.toFixed(2) || 'N/A'}%
**Technical Score: ${analysisResults.technicalAnalysis.technicalScore || 'N/A'}/100**
Market Cap: $${formatMarketCap(analysisResults.marketCap)}
**Token Distribution: ${analysisResults.holders.length || 'N/A'} holders**
24H Volume: $${formatVolume(analysisResults.marketData?.volume24h || 0)}
**Risk Score: ${analysisResults.riskScore || 'N/A'}/100**

AI-powered token risk scanner 
Detect rugs, honeypots & pump scams
https://safememefi-analyzer.vercel.app/`;

console.log('Tweet length:', tweetText.length);

const tweetResult = await postTweet(tweetText);
if (tweetResult.success) {
  console.log('✅ Tweet posted successfully:', tweetResult.tweetUrl);
} else {
  console.error('❌ Tweet failed:', tweetResult.error);
}

setResults(analysisResults);

    } catch (e) {
      console.error('Analysis error:', e);
      setError(`Analysis failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // BUY FUNCTION
  const handleBuyToken = async () => {
    if (!connected || !publicKey || !results?.honeypotResult.buyQuote) {
      setError('Connect wallet and analyze token first');
      return;
    }
    
    setLoading(true);
    try {
      // Commission Transaction
      const commissionAmount = Math.round(1 * LAMPORTS_PER_SOL * COMMISSION_RATE);
      const commissionTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(COMMISSION_WALLET),
          lamports: commissionAmount,
        })
      );
      
      await sendTransaction(commissionTx, connection);
      
      // Jupiter Swap
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

      const { swapTransaction } = await swapResponse.json();
      const swapTxBuf = Uint8Array.from(atob(swapTransaction), c => c.charCodeAt(0));
      const transaction = VersionedTransaction.deserialize(swapTxBuf);
      
      const signature = await sendTransaction(transaction, connection);
      setError(`✅ Purchase successful! TX: ${signature.slice(0,8)}...`);
      
      // Update balance
      const newBalance = await getUserBalance(new PublicKey(tokenAddress));
      setUserTokenBalance(newBalance);
      
    } catch (e) {
      setError(`Purchase failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // SELL FUNCTION
  const handleSellToken = async () => {
    if (!connected || !publicKey || !results?.honeypotResult.sellQuote) {
      setError('Connect wallet and analyze token first');
      return;
    }
    
    if (userTokenBalance <= 0) {
      setError('You do not own any of this token');
      return;
    }
    
    setLoading(true);
    try {
      // Jupiter Swap
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

      const { swapTransaction } = await swapResponse.json();
      const swapTxBuf = Uint8Array.from(atob(swapTransaction), c => c.charCodeAt(0));
      const transaction = VersionedTransaction.deserialize(swapTxBuf);
      
      const signature = await sendTransaction(transaction, connection);
      
      // Commission
      const sellCommissionAmount = Math.round(parseFloat(results.honeypotResult.sellQuote.outAmount) * COMMISSION_RATE);
      const sellCommissionTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(COMMISSION_WALLET),
          lamports: sellCommissionAmount,
        })
      );
      
      await sendTransaction(sellCommissionTx, connection);
      setError(`✅ Sale successful! TX: ${signature.slice(0,8)}...`);
      
      // Update balance
      const newBalance = await getUserBalance(new PublicKey(tokenAddress));
      setUserTokenBalance(newBalance);
      
    } catch (e) {
      setError(`Sale failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
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
                <h1 className="text-2xl font-bold text-white">SafeMemeFi Pro</h1>
                <p className="text-purple-300 text-sm">Advanced Token Analysis • AI Predictions • Live Trading</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <a 
                href="https://x.com/PumpfunRisk" 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white font-medium transition-colors flex items-center space-x-2"
              >
                <span>🐦</span>
                <span>Follow X</span>
              </a>
              
              <a 
                href="https://t.me/PumpfunRisk_bot" 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-white font-medium transition-colors flex items-center space-x-2"
              >
                <span>🤖</span>
                <span>Telegram Bot</span>
              </a>
              
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Advanced Token Analysis
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            AI-powered predictions • Deep technical analysis • Real-time market intelligence
          </p>
          
          <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-500/30 rounded-xl p-6 mb-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <span className="text-green-400 font-bold">🤖 AI Predictions</span>
                <p className="text-gray-300 text-sm">1W-1M-3M forecasts</p>
              </div>
              <div>
                <span className="text-green-400 font-bold">📊 Technical Analysis</span>
                <p className="text-gray-300 text-sm">Advanced metrics</p>
              </div>
              <div>
                <span className="text-green-400 font-bold">🔒 Security Analysis</span>
                <p className="text-gray-300 text-sm">Honeypot detection</p>
              </div>
              <div>
                <span className="text-green-400 font-bold">⚡ Live Trading</span>
                <p className="text-gray-300 text-sm">Jupiter integration</p>
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
                placeholder="Enter Solana token address for advanced analysis..."
                className="w-full px-6 py-4 bg-gray-900 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || !tokenAddress}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-xl transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Analyzing...</span>
                </div>
              ) : (
                '🚀 Analyze Token'
              )}
            </button>
          </div>
        </div>

        {/* Error/Success Message */}
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
            {/* Token Overview */}
            <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <div className="flex items-center space-x-4 mb-6">
                    {results.tokenMetadata?.image && (
                      <img 
                        src={results.tokenMetadata.image} 
                        alt={results.tokenMetadata.name || 'Token'} 
                        className="w-16 h-16 rounded-xl object-cover border border-purple-500/30"
                      />
                    )}
                    <div>
                      <h2 className="text-3xl font-bold text-white">
                        {results.tokenMetadata?.name || 'Unknown Token'}
                      </h2>
                      <p className="text-xl text-purple-300 font-mono">
                        ${results.tokenMetadata?.symbol || 'TOKEN'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <p className="text-gray-400 text-sm">Market Cap</p>
                      <p className="text-white text-xl font-bold">
                        {results.marketData?.marketCap ? 
                          `${(results.marketData.marketCap / 1000000).toFixed(2)}M` : 
                          results.marketCap > 0 ? 
                            `${(results.marketCap / 1000000).toFixed(2)}M` : 'N/A'
                        }
                      </p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <p className="text-gray-400 text-sm">24h Change</p>
                      <p className={`text-xl font-bold ${
                        (results.marketData?.priceChange24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {results.marketData?.priceChange24h !== undefined ? 
                          `${results.marketData.priceChange24h >= 0 ? '+' : ''}${results.marketData.priceChange24h.toFixed(2)}%` : 
                          'N/A'
                        }
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Technical Score</h3>
                  <div className="text-center">
                    <div className={`text-5xl font-bold mb-2 ${
                      results.technicalAnalysis.technicalScore > 75 ? 'text-green-400' :
                      results.technicalAnalysis.technicalScore > 50 ? 'text-yellow-400' :
                      results.technicalAnalysis.technicalScore > 25 ? 'text-orange-400' :
                      'text-red-400'
                    }`}>
                      {results.technicalAnalysis.technicalScore}
                    </div>
                    <p className="text-gray-300 text-sm">Technical Rating</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Analysis Dashboard */}
            <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8">
              <h3 className="text-2xl font-bold text-white mb-6">
                📊 Technical Analysis Dashboard
              </h3>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Momentum</h4>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            results.technicalAnalysis.momentum > 75 ? 'bg-green-500' :
                            results.technicalAnalysis.momentum > 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${results.technicalAnalysis.momentum}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-white font-bold text-sm">
                      {results.technicalAnalysis.momentum}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Liquidity</h4>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            results.technicalAnalysis.liquidity > 75 ? 'bg-green-500' :
                            results.technicalAnalysis.liquidity > 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${results.technicalAnalysis.liquidity}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-white font-bold text-sm">
                      {results.technicalAnalysis.liquidity}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Volatility</h4>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            results.technicalAnalysis.volatility > 75 ? 'bg-red-500' :
                            results.technicalAnalysis.volatility > 50 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${results.technicalAnalysis.volatility}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-white font-bold text-sm">
                      {results.technicalAnalysis.volatility}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Market Sentiment</h4>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            results.technicalAnalysis.marketSentiment > 75 ? 'bg-green-500' :
                            results.technicalAnalysis.marketSentiment > 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${results.technicalAnalysis.marketSentiment}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-white font-bold text-sm">
                      {results.technicalAnalysis.marketSentiment}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800/30 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-white mb-3">Technical Signals</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {results.technicalAnalysis.signals.map((signal, index) => (
                    <div key={index} className="flex items-center space-x-2 text-sm">
                      <span className="text-gray-300">{signal}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Advanced Price Predictions */}
            <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8">
              <h3 className="text-2xl font-bold text-white mb-6">
                🤖 AI Price Predictions
              </h3>
              
              <div className="grid lg:grid-cols-3 gap-6">
                {results.predictions.map((prediction, index) => (
                  <div key={index} className={`rounded-xl p-6 border ${
                    prediction.trend === 'bullish' ? 'bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/30' :
                    prediction.trend === 'bearish' ? 'bg-gradient-to-br from-red-900/30 to-pink-900/30 border-red-500/30' :
                    'bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border-yellow-500/30'
                  }`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-2xl font-bold text-white">{prediction.timeframe}</h4>
                        <p className="text-gray-300 text-sm">{prediction.period}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                        prediction.riskLevel === 'low' ? 'bg-green-500 text-white' :
                        prediction.riskLevel === 'medium' ? 'bg-yellow-500 text-black' :
                        'bg-red-500 text-white'
                      }`}>
                        {prediction.riskLevel.toUpperCase()}
                      </div>
                    </div>
                    
                    <div className="text-center mb-4">
                      <div className={`text-4xl font-bold mb-2 ${
                        prediction.prediction >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {prediction.prediction >= 0 ? '+' : ''}{prediction.prediction.toFixed(1)}%
                      </div>
                      <p className="text-gray-400 text-sm">
                        {prediction.confidence}% confidence
                      </p>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Target: ${prediction.targetPrice.toFixed(8)}</span>
                        <span>Range: {prediction.probabilityRange.min.toFixed(1)}% - {prediction.probabilityRange.max.toFixed(1)}%</span>
                      </div>
                      <div className={`w-full rounded-full h-2 ${
                        prediction.trend === 'bullish' ? 'bg-green-900' :
                        prediction.trend === 'bearish' ? 'bg-red-900' :
                        'bg-yellow-900'
                      }`}>
                        <div 
                          className={`h-2 rounded-full ${
                            prediction.trend === 'bullish' ? 'bg-green-500' :
                            prediction.trend === 'bearish' ? 'bg-red-500' :
                            'bg-yellow-500'
                          }`}
                          style={{ width: `${prediction.confidence}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-gray-300 text-sm mb-2">{prediction.reasoning}</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-xs mb-2">Key Factors:</p>
                      <div className="space-y-1">
                        {prediction.factors.map((factor, idx) => (
                          <p key={idx} className="text-xs text-gray-300">
                            • {factor}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trading Section */}
            <div className={`rounded-2xl p-6 ${
              results.honeypotResult.isHoneypot || results.riskScore > 70 
                ? 'bg-gradient-to-r from-red-900/30 to-orange-900/30 border border-red-500/30'
                : 'bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30'
            }`}>
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-white mb-2">
                  {results.honeypotResult.isHoneypot || results.riskScore > 70 
                    ? '🚨 High Risk - Trading Disabled' 
                    : '✅ Security Approved - Trading Ready'
                  }
                </h3>
                <p className={results.honeypotResult.isHoneypot || results.riskScore > 70 ? 'text-red-200' : 'text-green-200'}>
                  {connected 
                    ? `Balance: ${userTokenBalance.toFixed(6)} tokens`
                    : 'Connect wallet to trade'
                  }
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleBuyToken}
                  disabled={loading || !connected || results.honeypotResult.isHoneypot || results.riskScore > 70}
                  className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-xl transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg"
                >
                  {!connected ? '🔒 Connect Wallet' : 
                   results.honeypotResult.isHoneypot || results.riskScore > 70 ? '🚫 High Risk' :
                   '🚀 Buy Token'}
                </button>
                <button
                  onClick={handleSellToken}
                  disabled={loading || !connected || userTokenBalance <= 0 || results.honeypotResult.isHoneypot || results.riskScore > 70}
                  className="px-8 py-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-xl transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg"
                >
                  {!connected ? '🔒 Connect Wallet' :
                   userTokenBalance <= 0 ? '💰 No Tokens' :
                   results.honeypotResult.isHoneypot || results.riskScore > 70 ? '🚫 High Risk' :
                   '💰 Sell Token'}
                </button>
              </div>
            </div>

                        {/* Risk Assessment */}
            <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8">
              <h3 className="text-2xl font-bold text-white mb-6">
                🔒 Risk Assessment
              </h3>
              <div
                className={`p-6 rounded-xl border-2 ${
                  results.riskScore > 70
                    ? 'bg-red-900/30 border-red-500'
                    : results.riskScore > 50
                    ? 'bg-orange-900/30 border-orange-500'
                    : results.riskScore > 30
                    ? 'bg-yellow-900/30 border-yellow-500'
                    : 'bg-green-900/30 border-green-500'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`text-3xl font-bold ${
                      results.riskScore > 70
                        ? 'text-red-300'
                        : results.riskScore > 50
                        ? 'text-orange-300'
                        : results.riskScore > 30
                        ? 'text-yellow-300'
                        : 'text-green-300'
                    }`}
                  >
                    {results.riskLevel} Risk
                  </span>
                  <span
                    className={`text-2xl font-bold ${
                      results.riskScore > 70
                        ? 'text-red-300'
                        : results.riskScore > 50
                        ? 'text-orange-300'
                        : results.riskScore > 30
                        ? 'text-yellow-300'
                        : 'text-green-300'
                    }`}
                  >
                    {results.riskScore}/100
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-6 mb-4">
                  <div
                    className={`h-6 rounded-full transition-all duration-2000 ${
                      results.riskScore > 70
                        ? 'bg-red-500'
                        : results.riskScore > 50
                        ? 'bg-orange-500'
                        : results.riskScore > 30
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(results.riskScore, 100)}%` }}
                  ></div>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.riskFactors.map((factor, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg ${
                        factor.status === 'safe'
                          ? 'bg-green-900/20'
                          : factor.status === 'warning'
                          ? 'bg-yellow-900/20'
                          : 'bg-red-900/20'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-semibold text-white">{factor.name}</h4>
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            factor.status === 'safe'
                              ? 'bg-green-500 text-white'
                              : factor.status === 'warning'
                              ? 'bg-yellow-500 text-black'
                              : 'bg-red-500 text-white'
                          }`}
                        >
                          {factor.score}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300">{factor.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Token Holders */}
            {results.holders.length > 0 && (
              <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8">
                <h3 className="text-2xl font-bold text-white mb-6">🐋 Token Holders</h3>
                <div className="grid lg:grid-cols-2 gap-8">
                  <div>
                    <div className="space-y-3">
                      {results.holders.slice(0, 10).map((holder, index) => (
                        <div key={index} className="bg-gray-800/50 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-gray-300 text-sm">#{index + 1}</p>
                              <p className="text-white font-mono text-sm">
                                {holder.address.slice(0, 8)}...{holder.address.slice(-8)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-blue-400">{holder.percentage.toFixed(2)}%</p>
                              <p className="text-gray-400 text-sm">{holder.amount.toLocaleString()} tokens</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">Distribution</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={results.holders.slice(0, 5).map((holder, index) => ({
                              name: `Holder ${index + 1}`,
                              value: holder.percentage,
                            }))}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            label={({ value }) => `${value?.toFixed(1)}%`}
                          >
                            {results.holders.slice(0, 5).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tests */}
            <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-purple-500/20 p-8">
              <h3 className="text-2xl font-bold text-white mb-6">🕵️ Security Tests</h3>
              <div className="grid gap-3">
                {results.honeypotResult.details.map((detail, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      detail.startsWith('✅') || detail.startsWith('🎉')
                        ? 'bg-green-900/20 border-green-500/30 text-green-200'
                        : detail.startsWith('⚠️')
                        ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-200'
                        : 'bg-red-900/20 border-red-500/30 text-red-200'
                    }`}
                  >
                    {detail}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const App = () => (
  <WalletContextProvider>
    <SafeMemeFiApp />
  </WalletContextProvider>
);

export default App;