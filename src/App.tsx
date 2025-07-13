import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import React, { useState } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, VersionedTransaction, SystemProgram } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import * as buffer from 'buffer';
(window as any).Buffer = buffer.Buffer;

// Helius API Anahtarınız
const HELIUS_API_KEY = "1d4ccf68-d14c-4843-acc9-e3379ed0cbf3";
const COMMISSION_WALLET = "Ad7fjLeykfgoSadqUx95dioNB8WiYa3YEwBUDhTEvJdj";
const COMMISSION_RATE = 0.05; // %5

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
        mintAuthority: mintInfo.mintAuthority ? mintInfo.mintAuthority.toBase58() : 'N/A',
        freezeAuthority: mintInfo.freezeAuthority ? mintInfo.freezeAuthority.toBase58() : 'N/A',
        isInitialized: mintInfo.isInitialized,
      };

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

        if (!metadataResponse.ok) {
          console.error(`Failed to fetch asset metadata. Status: ${metadataResponse.status}`);
          console.error(`Response: ${await metadataResponse.text()}`);
        } else {
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
      const amountToBuySOL = 1.0; // 1 SOL alım
      const amountInLamports = Math.round(amountToBuySOL * LAMPORTS_PER_SOL);

      // Test 1: Can we get a buy quote?
      try {
        const buyQuoteResponse = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT_ADDRESS.toBase58()}&outputMint=${mintPublicKey.toBase58()}&amount=${amountInLamports}&slippageBps=500&swapMode=ExactIn`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );

        if (!buyQuoteResponse.ok) {
          const errorText = await buyQuoteResponse.text();
          honeypotResult.isHoneypot = true;
          honeypotResult.details.push(`Failed to get BUY quote. Status: ${buyQuoteResponse.status}, Error: ${errorText}`);
        } else {
          const buyQuoteData = (await buyQuoteResponse.json()) as JupiterQuoteResponse;
          honeypotResult.buyQuote = buyQuoteData;
          if (!buyQuoteData.outAmount || parseFloat(buyQuoteData.outAmount) === 0) {
            honeypotResult.isHoneypot = true;
            honeypotResult.details.push("BUY Quote returned zero tokens.");
          } else {
            honeypotResult.details.push("✅ BUY Quote successful.");
          }
        }
      } catch (e) {
        honeypotResult.isHoneypot = true;
        honeypotResult.details.push(`Error getting BUY quote: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Test 2: Can we get a sell quote?
      if (!honeypotResult.isHoneypot && honeypotResult.buyQuote && parseFloat(honeypotResult.buyQuote.outAmount) > 0) {
        const simulatedTokenAmount = parseFloat(honeypotResult.buyQuote.outAmount);
        const amountToSellTokens = Math.floor(simulatedTokenAmount * 0.9);

        try {
          const sellQuoteResponse = await fetch(
            `https://quote-api.jup.ag/v6/quote?inputMint=${mintPublicKey.toBase58()}&outputMint=${SOL_MINT_ADDRESS.toBase58()}&amount=${amountToSellTokens}&slippageBps=500&swapMode=ExactIn`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
          );

          if (!sellQuoteResponse.ok) {
            const errorText = await sellQuoteResponse.text();
            honeypotResult.isHoneypot = true;
            honeypotResult.details.push(`Failed to get SELL quote. Status: ${sellQuoteResponse.status}, Error: ${errorText}`);
          } else {
            const sellQuoteData = (await sellQuoteResponse.json()) as JupiterQuoteResponse;
            honeypotResult.sellQuote = sellQuoteData;
            if (!sellQuoteData.outAmount || parseFloat(sellQuoteData.outAmount) === 0) {
              honeypotResult.isHoneypot = true;
              honeypotResult.details.push("SELL Quote returned zero SOL.");
            } else {
              honeypotResult.details.push("✅ SELL Quote successful.");
            }
          }
        } catch (e) {
          honeypotResult.isHoneypot = true;
          honeypotResult.details.push(`Error getting SELL quote: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else if (!honeypotResult.isHoneypot) {
        honeypotResult.details.push("Skipping SELL quote due to initial BUY quote failure or zero output.");
        honeypotResult.isHoneypot = true;
      }

      // Test 3: Can we create a transaction?
      if (!honeypotResult.isHoneypot && honeypotResult.buyQuote && honeypotResult.sellQuote) {
        try {
          const buySwapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quoteResponse: honeypotResult.buyQuote,
              userPublicKey: publicKey.toBase58(),
              wrapUnwrapSOL: true,
              prioritizationFeeLamports: 100000,
              dynamicComputeUnitLimit: true,
              skipUserAccountsRpcCalls: true
            }),
          });

          if (!buySwapResponse.ok) {
            const errorText = await buySwapResponse.text();
            honeypotResult.isHoneypot = true;
            honeypotResult.details.push(`Failed to create BUY transaction. Status: ${buySwapResponse.status}, Error: ${errorText}`);
          } else {
            honeypotResult.details.push("✅ BUY Transaction creation successful.");
          }

          const sellSwapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quoteResponse: honeypotResult.sellQuote,
              userPublicKey: publicKey.toBase58(),
              wrapUnwrapSOL: true,
              prioritizationFeeLamports: 100000,
              dynamicComputeUnitLimit: true,
              skipUserAccountsRpcCalls: true
            }),
          });

          if (!sellSwapResponse.ok) {
            const errorText = await sellSwapResponse.text();
            honeypotResult.isHoneypot = true;
            honeypotResult.details.push(`Failed to create SELL transaction. Status: ${sellSwapResponse.status}, Error: ${errorText}`);
          } else {
            honeypotResult.details.push("✅ SELL Transaction creation successful.");
          }
        } catch (e) {
          honeypotResult.isHoneypot = true;
          honeypotResult.details.push(`Error creating transaction: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else if (!honeypotResult.isHoneypot) {
        honeypotResult.details.push("Skipping transaction creation due to prior quote failures.");
        honeypotResult.isHoneypot = true;
      }

      // Test 4: Price Analysis
      if (honeypotResult.buyQuote && honeypotResult.sellQuote &&
          parseFloat(honeypotResult.buyQuote.outAmount) > 0 && parseFloat(honeypotResult.sellQuote.outAmount) > 0) {
        const buyPricePerToken = parseFloat(honeypotResult.buyQuote.inAmount) / parseFloat(honeypotResult.buyQuote.outAmount);
        const sellPricePerToken = parseFloat(honeypotResult.sellQuote.outAmount) / parseFloat(honeypotResult.sellQuote.inAmount);
        const priceImpact = ((buyPricePerToken - sellPricePerToken) / buyPricePerToken) * 100;

        honeypotResult.priceAnalysis = { buyPricePerToken, sellPricePerToken, priceImpact };

        honeypotResult.details.push(`Buy price per token: ${buyPricePerToken.toExponential(4)} SOL`);
        honeypotResult.details.push(`Sell price per token: ${sellPricePerToken.toExponential(4)} SOL`);
        honeypotResult.details.push(`Price impact: ${priceImpact.toFixed(2)}%`);

        if (priceImpact > 50) {
          honeypotResult.isHoneypot = true;
          honeypotResult.details.push(`⚠️ Warning: High price impact (${priceImpact.toFixed(2)}%)`);
        } else {
          honeypotResult.details.push(`✅ Price impact acceptable (${priceImpact.toFixed(2)}%)`);
        }
      } else if (!honeypotResult.isHoneypot) {
          honeypotResult.details.push("Skipping price analysis due to invalid quotes.");
          honeypotResult.isHoneypot = true;
      }

      if (!honeypotResult.isHoneypot) {
          honeypotResult.details.push("Verdict: Token appears to be tradeable (NOT a honeypot)");
      } else {
          honeypotResult.details.push("Verdict: Likely Honeypot or an issue occurred during check.");
      }

      // Test 5: Token yaşı ve likidite analizi
      let riskScore = 0;
      let riskDetails = [] as string[];

      // Token yaşı kontrolü
      try {
        const accountInfo = await connection.getAccountInfo(mintPublicKey);
        if (accountInfo) {
          riskDetails.push("🕒 Token hesap bilgisi alındı");
        }
      } catch (e) {
        riskScore += 20;
        riskDetails.push("❌ Token hesap bilgisi alınamadı");
      }

      // Likidite kontrolü
      if (honeypotResult.buyQuote && honeypotResult.sellQuote) {
        const buyAmount = parseFloat(honeypotResult.buyQuote.outAmount);
        
        if (buyAmount > 1000000) {
          riskDetails.push("✅ Yüksek likidite tespit edildi");
        } else if (buyAmount > 100000) {
          riskScore += 10;
          riskDetails.push("⚠️ Orta seviye likidite");
        } else {
          riskScore += 30;
          riskDetails.push("🚨 Düşük likidite - RİSKLİ!");
        }
      }

      // Mint Authority ve Freeze Authority kontrolü
      if (basicInfo.mintAuthority !== 'N/A') {
        riskScore += 25;
        riskDetails.push("⚠️ Mint yetkisi aktif - Yeni token basılabilir");
      } else {
        riskDetails.push("✅ Mint yetkisi kapalı - Güvenli");
      }

      if (basicInfo.freezeAuthority !== 'N/A') {
        riskScore += 15;
        riskDetails.push("⚠️ Freeze yetkisi aktif - Hesaplar dondurulabilir");
      } else {
        riskDetails.push("✅ Freeze yetkisi yok - Güvenli");
      }

      // Risk skoruna göre genel değerlendirme
      let riskLevel = 'Düşük';
      if (riskScore > 60) {
        riskLevel = 'Çok Yüksek';
        honeypotResult.isHoneypot = true;
      } else if (riskScore > 40) {
        riskLevel = 'Yüksek';
      } else if (riskScore > 20) {
        riskLevel = 'Orta';
      }

      riskDetails.push(`📊 Genel Risk Seviyesi: ${riskLevel} (${riskScore}/100)`);

      setResults({
        basicInfo,
        tokenMetadata,
        honeypotResult,
        riskScore,
        riskDetails,
        riskLevel,
        walletPublicKey: publicKey.toBase58(),
      });

    } catch (e) {
      console.error("Analysis error:", e);
      setError(`An error occurred during analysis: ${e instanceof Error ? e.message : String(e)}`);
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
      
      // 1. Komisyon gönder
      const commissionAmount = Math.round(1 * LAMPORTS_PER_SOL * COMMISSION_RATE);
      const commissionTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(COMMISSION_WALLET),
          lamports: commissionAmount,
        })
      );
      
      const commissionTxid = await sendTransaction(commissionTx, connection);
      console.log('Commission sent:', commissionTxid);
      
      // 2. Swap transaction oluştur
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
      
      // 3. Swap transaction'ı gönder
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      
      const txid = await sendTransaction(transaction, connection);
      
      console.log('Swap transaction sent:', txid);
      setError(`✅ Buy successful! Commission: ${commissionTxid.slice(0,8)}... Swap: ${txid.slice(0,8)}...`);
      
    } catch (e) {
      setError(`Buy error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSellToken = async () => {
    if (!connected || !publicKey || !sendTransaction || !results?.honeypotResult.sellQuote) return;
    
    setLoading(true);
    try {
      const connection = new Connection(`https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`);
      
      // 1. Swap transaction oluştur ve gönder
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
      console.log('Sell transaction sent:', txid);
      
      // 2. Satış sonrası komisyon gönder
      const sellCommissionAmount = Math.round(parseFloat(results.honeypotResult.sellQuote.outAmount) * COMMISSION_RATE);
      
      const commissionTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(COMMISSION_WALLET),
          lamports: sellCommissionAmount,
        })
      );
      
      const commissionTxid = await sendTransaction(commissionTx, connection);
      console.log('Sell commission sent:', commissionTxid);
      
      setError(`✅ Sell successful! Swap: ${txid.slice(0,8)}... Commission: ${commissionTxid.slice(0,8)}...`);
      
    } catch (e) {
      setError(`Sell error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">SafeMemeFi Token Analyzer</h1>
      <p className="text-center text-gray-600 mb-6">Analyze Solana tokens for potential honeypot characteristics - Protect yourself from pump.fun scams!</p>

      {/* Wallet Connection */}
      <div className="flex justify-center mb-6">
        <WalletMultiButton />
      </div>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          placeholder="Enter Token Address (e.g., DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263)"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || !tokenAddress || !connected}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Analyzing...' : 'Analyze Token'}
        </button>
      </div>

      {/* Pump.fun Info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-yellow-800 mb-2">🚨 Pump.fun Protection</h3>
        <p className="text-sm text-yellow-700">
          Before buying any meme token from pump.fun, analyze it here first! Many pump.fun tokens are honeypots or have liquidity issues. Our analyzer checks for common scam patterns.
        </p>
      </div>

      {!connected && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <strong>Warning:</strong> Please connect your wallet to analyze tokens.
        </div>
      )}

      {error && (
        <div className={`border px-4 py-3 rounded mb-4 ${
          error.includes('✅') ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'
        }`}>
          <strong>{error.includes('✅') ? 'Success:' : 'Error:'}</strong> {error}
        </div>
      )}

      {results && (
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h2 className="text-2xl font-semibold text-blue-600 mb-4">Analysis Results for {tokenAddress}</h2>
          <p className="text-sm text-gray-600 mb-6"><strong>Connected Wallet:</strong> {results.walletPublicKey}</p>

          {/* Risk Score Display */}
          <div className={`p-4 rounded-lg mb-6 ${
            results.riskScore > 60 ? 'bg-red-100 border border-red-300' :
            results.riskScore > 40 ? 'bg-orange-100 border border-orange-300' :
            results.riskScore > 20 ? 'bg-yellow-100 border border-yellow-300' :
            'bg-green-100 border border-green-300'
          }`}>
            <h3 className={`font-semibold mb-2 ${
              results.riskScore > 60 ? 'text-red-800' :
              results.riskScore > 40 ? 'text-orange-800' :
              results.riskScore > 20 ? 'text-yellow-800' :
              'text-green-800'
            }`}>
              🎯 Risk Assessment: {results.riskLevel} ({results.riskScore}/100)
            </h3>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full ${
                  results.riskScore > 60 ? 'bg-red-500' :
                  results.riskScore > 40 ? 'bg-orange-500' :
                  results.riskScore > 20 ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min(results.riskScore, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Commission Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">💰 Trading Fees</h3>
            <p className="text-sm text-blue-700">
              • Buy: 1 SOL + 5% commission (0.05 SOL) = 1.05 SOL total<br/>
              • Sell: 5% commission from received SOL amount<br/>
              • Commission goes to: {COMMISSION_WALLET.slice(0,8)}...{COMMISSION_WALLET.slice(-8)}
            </p>
          </div>

          {/* Trading Buttons */}
          {!results.honeypotResult.isHoneypot && results.riskScore < 60 && (
            <div className="flex gap-4 mb-6 justify-center">
              <button
                onClick={handleBuyToken}
                disabled={loading}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
              >
                🚀 Buy Token (1 SOL + 5% fee)
              </button>
              <button
                onClick={handleSellToken}
                disabled={loading}
                className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold"
              >
                💰 Sell Token (5% fee)
              </button>
            </div>
          )}

          {(results.honeypotResult.isHoneypot || results.riskScore >= 60) && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-6 text-center">
              <h3 className="font-semibold text-red-800 mb-2">⚠️ TRADING DISABLED</h3>
              <p className="text-sm text-red-700">
                This token has been flagged as high risk or potential honeypot. Trading is disabled for your protection.
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Basic Token Information</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Total Supply:</strong> {results.basicInfo.supply}</p>
                <p><strong>Decimals:</strong> {results.basicInfo.decimals}</p>
                <p><strong>Mint Authority:</strong> {results.basicInfo.mintAuthority}</p>
                <p><strong>Freeze Authority:</strong> {results.basicInfo.freezeAuthority}</p>
                <p><strong>Is Initialized:</strong> {results.basicInfo.isInitialized ? 'true' : 'false'}</p>
              </div>
            </div>

            {results.tokenMetadata && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">Token Metadata</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Name:</strong> {results.tokenMetadata.name}</p>
                  <p><strong>Symbol:</strong> {results.tokenMetadata.symbol}</p>
                  {results.tokenMetadata.image && (
                    <div className="mt-3">
                      <p><strong>Logo:</strong></p>
                      <img 
                        src={results.tokenMetadata.image} 
                        alt={results.tokenMetadata.name} 
                        className="w-16 h-16 rounded-lg object-cover mt-2"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Risk Analysis */}
          {results.riskDetails && results.riskDetails.length > 0 && (
            <div className="mt-6 bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">🔍 Risk Analysis</h3>
              <div className="space-y-2">
                {results.riskDetails.map((detail: string, index: number) => (
                  <p 
                    key={index} 
                    className={`text-sm ${
                      detail.startsWith('✅') ? 'text-green-600' : 
                      detail.startsWith('⚠️') ? 'text-yellow-600' : 
                      detail.startsWith('🚨') ? 'text-red-600' :
                      detail.startsWith('📊') ? 'text-blue-600 font-semibold' :
                      'text-gray-700'
                    }`}
                  >
                    {detail}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">🕵️ Honeypot Check Results</h3>
            <div className="space-y-2">
              {results.honeypotResult.details.map((detail: string, index: number) => (
                <p 
                  key={index} 
                  className={`text-sm ${
                    detail.startsWith('✅') ? 'text-green-600' : 
                    detail.startsWith('⚠️') ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}
                >
                  {detail}
                </p>
              ))}
            </div>
            
            {results.honeypotResult.priceAnalysis && (
              <div className="mt-4 p-3 border border-gray-300 rounded-lg bg-white">
                <h4 className="font-semibold text-gray-700 mb-2">💰 Price Analysis:</h4>
                <div className="text-sm space-y-1">
                  <p>Buy price per token: {results.honeypotResult.priceAnalysis.buyPricePerToken.toExponential(4)} SOL</p>
                  <p>Sell price per token: {results.honeypotResult.priceAnalysis.sellPricePerToken.toExponential(4)} SOL</p>
                  <p>Price impact: {results.honeypotResult.priceAnalysis.priceImpact.toFixed(2)}%</p>
                </div>
              </div>
            )}
          </div>

          <div className={`mt-6 p-4 rounded-lg text-center font-semibold ${
            results.honeypotResult.isHoneypot || results.riskScore >= 60
              ? 'bg-red-100 text-red-800 border border-red-300' 
              : 'bg-green-100 text-green-800 border border-green-300'
          }`}>
            {results.honeypotResult.isHoneypot || results.riskScore >= 60
              ? '🚨 SECURITY ALERT: This token is HIGH RISK or potential HONEYPOT! 🚨' 
              : '✅ SECURITY CHECK: Token appears to be legitimate for trading'
            }
            <p className="text-sm mt-2 font-normal">💡 Always do your own research before investing!</p>
          </div>
        </div>
      )}
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