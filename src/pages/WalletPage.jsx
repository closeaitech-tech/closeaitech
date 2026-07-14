import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { apiCall } from '../utils/api';
import {
  Send, ArrowDownLeft, Repeat, Clock, Settings, Copy, ChevronRight,
  Flame, ArrowLeft, Check, QrCode, ChevronDown, Wallet, ShieldAlert,
  ExternalLink, TrendingUp, TrendingDown, Loader2, Eye, EyeOff, Lock, Newspaper
} from 'lucide-react';
import { ethers } from 'ethers';
import QRCode from 'qrcode';

// ---------- Chain configuration ----------
const CHAINS = {
  polygon: {
    name: 'Polygon',
    symbol: 'POL',
    rpc: import.meta.env.VITE_ALCHEMY_POLYGON || 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    chainId: 137,
    tokens: {
      POL: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
      USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
      USDC: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
      WETH: { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
      CLOSE: { address: '0x3c6833cFDdED80fE76474a3Cb2Cc050Daec91fe8', decimals: 18 }
    }
  },
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    rpc: import.meta.env.VITE_ALCHEMY_ETHEREUM || 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    chainId: 1,
    tokens: {
      ETH: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
      USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
      USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
      WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
      CLOSE: { address: '0x3c6833cFDdED80fE76474a3Cb2Cc050Daec91fe8', decimals: 18 }
    }
  },
  bsc: {
    name: 'BSC',
    symbol: 'BNB',
    rpc: import.meta.env.VITE_ALCHEMY_BSC || 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com',
    chainId: 56,
    tokens: {
      BNB: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
      USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
      CLOSE: { address: '0x3c6833cFDdED80fE76474a3Cb2Cc050Daec91fe8', decimals: 18 }
    }
  },
  arbitrum: {
    name: 'Arbitrum',
    symbol: 'ETH',
    rpc: import.meta.env.VITE_ALCHEMY_ARBITRUM || 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    chainId: 42161,
    tokens: {
      ETH: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
      USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
      CLOSE: { address: '0x3c6833cFDdED80fE76474a3Cb2Cc050Daec91fe8', decimals: 18 }
    }
  },
  base: {
    name: 'Base',
    symbol: 'ETH',
    rpc: import.meta.env.VITE_ALCHEMY_BASE || 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    chainId: 8453,
    tokens: {
      ETH: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
      USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      CLOSE: { address: '0x3c6833cFDdED80fE76474a3Cb2Cc050Daec91fe8', decimals: 18 }
    }
  }
};

// ---------- Helper Components ----------
function TabButton({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 px-2">
      <Icon size={20} strokeWidth={2} style={{ color: active ? 'var(--accent)' : '#52525b' }} />
      <span className="text-[10px] font-medium" style={{ color: active ? 'var(--accent)' : '#52525b' }}>{label}</span>
    </button>
  );
}

function ScreenHeader({ title, onBack, right }) {
  return (
    <div className="flex items-center justify-between px-5 pt-2 pb-4">
      {onBack ? (
        <button onClick={onBack} className="text-zinc-400 hover:text-zinc-200"><ArrowLeft size={20} /></button>
      ) : <div className="w-5" />}
      <span className="text-zinc-200 text-sm font-semibold tracking-wide">{title}</span>
      {right || <div className="w-5" />}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group">
      <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center group-hover:border-[var(--accent)] group-active:scale-95 transition">
        <Icon size={18} className="text-zinc-300" />
      </div>
      <span className="text-zinc-400 text-[11px] font-medium">{label}</span>
    </button>
  );
}

// ---------- Unlock Screen ----------
function UnlockScreen({ encryptedKey, onCreate, onImport, onUnlock, mnemonic, onClearMnemonic, toast, unlockError, clearUnlockError }) {
  const [mode, setMode] = useState(encryptedKey ? 'unlock' : 'create');
  const [pwd, setPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const switchMode = (newMode) => {
    clearUnlockError?.();
    setMode(newMode);
  };

  const handleSubmit = async () => {
    if (!pwd || pwd.length < 5) { toast('Password must be at least 5 characters'); return; }
    if (mode === 'create') {
      if (pwd !== confirmPwd) { toast('Passwords do not match'); return; }
      setLoading(true);
      try { await onCreate(pwd); } catch (e) { toast('Failed to create wallet'); }
      setLoading(false);
    } else if (mode === 'import') {
      if (!keyInput.trim()) { toast('Enter a private key or mnemonic'); return; }
      setLoading(true);
      try { await onImport(pwd, keyInput); } catch (e) { toast('Import failed'); }
      setLoading(false);
    } else {
      setLoading(true);
      try {
        await onUnlock(pwd);
      } catch (e) {
        // Error already displayed via unlockError
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <Wallet size={40} className="text-zinc-500 mb-4" />
      <h2 className="text-zinc-200 text-lg font-semibold mb-2">
        {mode === 'create' ? 'Create Wallet' : mode === 'import' ? 'Import Wallet' : 'Unlock Wallet'}
      </h2>

      {mnemonic && (
        <div className="bg-zinc-800 p-3 rounded-xl text-xs text-zinc-300 mb-4 w-full break-words">
          <p className="text-amber-400 font-semibold mb-1">Your Seed Phrase (write it down!)</p>
          {mnemonic}
          <button onClick={onClearMnemonic} className="mt-2 text-orange-400 underline text-xs">I've saved it</button>
        </div>
      )}

      {unlockError && (
        <p className="text-red-400 text-sm mb-3 bg-red-950/30 px-3 py-2 rounded-lg w-full">{unlockError}</p>
      )}

      <div className="w-full space-y-3">
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Wallet password"
            className="w-full p-3 pr-10 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 outline-none"
          />
          <button onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-3 text-zinc-500">
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {mode === 'create' && (
          <input
            type="password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            placeholder="Confirm password"
            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 outline-none"
          />
        )}
        {mode === 'import' && (
          <textarea
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Private key or 12-word mnemonic"
            rows={3}
            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 outline-none resize-none"
          />
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : (mode === 'unlock' ? 'Unlock' : 'Continue')}
        </button>

        {!encryptedKey && (
          <div className="flex justify-between text-xs text-zinc-400 mt-2">
            {mode !== 'create' && <button onClick={() => switchMode('create')}>Create new</button>}
            {mode !== 'import' && <button onClick={() => switchMode('import')}>Import</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Home Screen ----------
function HomeScreen({ setTab, openModal, toast }) {
  const { wallet, balances, loadingBal, chain, selectedChain, setSelectedChain, stakedBalance, burnedAmount, totalUsd } = useWallet();
  const [stakeExpanded, setStakeExpanded] = useState(false);

  const tokens = Object.entries(balances || {}).map(([sym, info]) => ({
    symbol: sym,
    balance: ethers.utils.formatUnits(info.balance, info.decimals || 18),
    usdValue: info.usdValue || 0,
    change: 0,
  }));

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(wallet.address)
      .then(() => toast('Address copied'))
      .catch(() => toast('Could not copy address'));
  };

  return (
    <div>
      <div className="flex items-center justify-between px-5 pt-2 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center">
            <Wallet size={14} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div className="text-zinc-100 text-xs font-semibold leading-none">OS Wallet</div>
            <div className="text-zinc-500 text-[10px] leading-none mt-1 flex items-center gap-1">
              {chain?.name} · {wallet?.address?.slice(0,6)}…{wallet?.address?.slice(-4)}
              <button onClick={handleCopyAddress} className="text-zinc-500 hover:text-[var(--accent)]"><Copy size={10} /></button>
            </div>
          </div>
        </div>
        <select value={selectedChain} onChange={e => setSelectedChain(e.target.value)} className="bg-zinc-800 text-zinc-300 text-xs rounded-lg px-2 py-1 border border-zinc-700 outline-none">
          {Object.keys(CHAINS).map(c => <option key={c} value={c}>{CHAINS[c].name}</option>)}
        </select>
      </div>

      <div className="px-5 pt-6 pb-2">
        <div className="font-mono text-4xl text-zinc-50 font-medium tracking-tight">
          ${totalUsd.toFixed(2)}
        </div>
        <div className="flex items-center gap-1 mt-2 text-zinc-500 text-xs">
          <TrendingUp size={12} /> <span>--% today</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 px-5 py-6">
        <ActionButton icon={Send} label="Send" onClick={() => setTab("send")} />
        <ActionButton icon={ArrowDownLeft} label="Receive" onClick={() => setTab("receive")} />
        <ActionButton icon={Repeat} label="Swap" onClick={() => openModal('swap')} />
        <ActionButton icon={Wallet} label="Buy" onClick={() => openModal('buy')} />
      </div>

      <div onClick={() => setStakeExpanded(!stakeExpanded)} className="mx-5 mb-5 rounded-xl border border-[var(--glass-border)] bg-gradient-to-r from-zinc-800/50 to-zinc-900 px-4 py-3 flex items-center gap-3 cursor-pointer">
        <Flame size={18} style={{ color: 'var(--accent)' }} />
        <div className="flex-1">
          <div className="text-zinc-300 text-xs">Staked CLOSE</div>
          <div className="text-zinc-200 font-mono text-sm">{stakedBalance} CLOSE</div>
        </div>
        <ChevronDown size={14} className={`transition-transform ${stakeExpanded ? 'rotate-180' : ''}`} />
      </div>
      {stakeExpanded && (
        <div className="mx-5 mb-5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl px-4 py-3 space-y-2">
          <div className="flex justify-between text-xs"><span className="text-zinc-400">Staked</span><span className="text-zinc-200 font-mono">{stakedBalance} CLOSE</span></div>
          <div className="flex justify-between text-xs"><span className="text-zinc-400">Burned</span><span className="text-zinc-200 font-mono">{burnedAmount} CLOSE</span></div>
          <button onClick={(e) => { e.stopPropagation(); openModal('buy'); }} className="w-full py-2 bg-[var(--accent)] text-white rounded-xl text-xs font-semibold">Buy CLOSE</button>
        </div>
      )}

      <div className="px-5">
        <div className="text-zinc-500 text-xs font-medium mb-3">Assets</div>
        {loadingBal ? (
          <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-zinc-500" /></div>
        ) : tokens.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-4">No tokens found</p>
        ) : (
          <div className="space-y-1">
            {tokens.map((t) => (
              <div key={t.symbol} className="flex items-center justify-between py-2.5 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-300">
                    {t.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-zinc-100 text-sm font-medium">{t.symbol}</div>
                    <div className="text-zinc-500 text-xs">{t.balance} {t.symbol}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-zinc-100 text-sm font-mono">${t.usdValue.toFixed(2)}</div>
                  <div className="text-xs text-zinc-600">--%</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Send Screen ----------
function SendScreen({ setTab }) {
  const { handleSend, chain } = useWallet();
  const [step, setStep] = useState('form');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [selectedToken, setSelectedToken] = useState(chain?.symbol || 'POL');
  const [sending, setSending] = useState(false);

  const proceed = async () => {
    if (step === 'form') {
      if (!recipient || !amount) return;
      if (!ethers.utils.isAddress(recipient)) { alert('Invalid address'); return; }
      setStep('review');
    } else {
      setSending(true);
      try {
        await handleSend(recipient, amount, selectedToken);
        setStep('success');
      } catch (e) {
        // error handled in context
      } finally {
        setSending(false);
      }
    }
  };

  if (step === 'success') {
    return (
      <div className="px-5 pt-10 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center mb-5">
          <Check size={28} className="text-emerald-400" />
        </div>
        <div className="text-zinc-100 text-lg font-semibold mb-1">Transaction sent</div>
        <button onClick={() => { setStep('form'); setTab('home'); }} className="w-full bg-zinc-100 text-zinc-950 font-semibold text-sm py-3 rounded-xl">
          Done
        </button>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title={step === 'form' ? 'Send' : 'Review'} onBack={() => step === 'form' ? setTab('home') : setStep('form')} />
      <div className="px-5 pt-2">
        {step === 'form' ? (
          <>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Recipient address"
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 outline-none text-sm mb-3"
            />
            <select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)} className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 outline-none text-sm mb-3">
              {Object.keys(chain?.tokens || {}).map(tok => <option key={tok} value={tok}>{tok}</option>)}
            </select>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 outline-none text-sm"
            />
          </>
        ) : (
          <div className="text-center mb-4">
            <div className="text-2xl font-mono text-zinc-50">{amount} {selectedToken}</div>
            <div className="text-zinc-500 text-sm">to {recipient.slice(0, 8)}…</div>
          </div>
        )}
        <button
          onClick={proceed}
          disabled={!recipient || !amount || sending}
          className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-semibold mt-4 disabled:opacity-40"
        >
          {sending ? <Loader2 size={18} className="animate-spin mx-auto" /> : (step === 'form' ? 'Review' : 'Confirm & Send')}
        </button>
      </div>
    </div>
  );
}

// ---------- Receive Screen ----------
function ReceiveScreen({ setTab }) {
  const { wallet, chain } = useWallet();
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);

  useEffect(() => {
    if (wallet && qrRef.current) {
      QRCode.toCanvas(qrRef.current, wallet.address, { width: 140 });
    }
  }, [wallet]);

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.address)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => alert('Could not copy address'));
  };

  return (
    <div>
      <ScreenHeader title="Receive" onBack={() => setTab("home")} />
      <div className="px-5 pt-4 flex flex-col items-center">
        <canvas ref={qrRef} className="mb-4" />
        <div className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 flex items-center justify-between mb-3">
          <span className="text-zinc-200 font-mono text-xs truncate mr-2">{wallet?.address}</span>
          <button onClick={handleCopy} className="text-zinc-400 shrink-0">
            {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
          </button>
        </div>
        <p className="text-amber-200/80 text-xs bg-amber-950/20 border border-amber-900/40 rounded-lg p-3">
          Only send {chain?.name || 'Polygon'} assets to this address.
        </p>
      </div>
    </div>
  );
}

// ---------- Activity Screen ----------
function ActivityScreen() {
  const { txs, loadingTxs, chain, wallet } = useWallet();
  return (
    <div>
      <ScreenHeader title="Activity" />
      <div className="px-5 pt-2">
        {loadingTxs ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-zinc-500" /></div>
        ) : !txs || txs.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-8">No transactions found</p>
        ) : (
          <div className="space-y-1">
            {txs.map((tx, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    (tx.from || '').toLowerCase() === (wallet?.address || '').toLowerCase()
                      ? 'bg-orange-950/60' : 'bg-emerald-950/60'
                  }`}>
                    {(tx.from || '').toLowerCase() === (wallet?.address || '').toLowerCase() ? (
                      <Send size={14} className="text-orange-400" />
                    ) : (
                      <ArrowDownLeft size={14} className="text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-zinc-100 text-sm font-medium capitalize">
                      {(tx.from || '').toLowerCase() === (wallet?.address || '').toLowerCase() ? 'Sent' : 'Received'}
                    </div>
                    <div className="text-zinc-500 text-xs">{tx.time}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-mono ${
                    (tx.from || '').toLowerCase() === (wallet?.address || '').toLowerCase()
                      ? 'text-zinc-200' : 'text-emerald-400'
                  }`}>
                    {(tx.from || '').toLowerCase() === (wallet?.address || '').toLowerCase() ? '-' : '+'}
                    {parseFloat(tx.value).toFixed(4)} {tx.token}
                  </div>
                  <a href={`${chain?.explorer || '#'}/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="text-zinc-600 text-xs flex items-center justify-end gap-1">
                    <ExternalLink size={10} /> Details
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- News Screen (NEW) ----------
function NewsScreen() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall('/api/market/news')
      .then(res => setNews(Array.isArray(res) ? res : (res.news || [])))
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <ScreenHeader title="News" />
      <div className="px-5 pt-2">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-zinc-500" /></div>
        ) : news.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-8">No news available</p>
        ) : (
          <div className="space-y-3">
            {news.slice(0, 20).map((item, i) => (
              <a
                key={i}
                href={item.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="block bg-zinc-800 border border-zinc-700 rounded-xl p-3 hover:border-[var(--accent)] transition"
              >
                <h3 className="text-sm font-medium text-zinc-100 mb-1">{item.headline || item.title}</h3>
                {item.summary && <p className="text-xs text-zinc-400 line-clamp-2">{item.summary}</p>}
                <span className="text-[10px] text-zinc-500 mt-1">{item.source}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Main WalletPage ----------
export default function WalletPage({ openModal, toast }) {
  const {
    wallet, encryptedKey, createWallet, importWallet, unlockWallet,
    mnemonic, clearMnemonic, unlockError, clearUnlockError
  } = useWallet();
  const [tab, setTab] = useState('home');
  const navigate = useNavigate();
  const [globalSending, setGlobalSending] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-zinc-900/70 backdrop-blur-xl border border-zinc-700/30 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
        {/* Close button */}
        <button
          onClick={() => navigate('/')}
          disabled={globalSending}
          className="absolute top-4 right-4 z-20 p-1 rounded-full bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          title={globalSending ? 'Transaction in progress' : 'Back to Chat'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="h-8 bg-transparent" />
        <div className="h-[680px] overflow-y-auto pb-24 relative">
          {!wallet ? (
            <UnlockScreen
              encryptedKey={encryptedKey}
              onCreate={createWallet}
              onImport={importWallet}
              onUnlock={unlockWallet}
              mnemonic={mnemonic}
              onClearMnemonic={clearMnemonic}
              toast={toast}
              unlockError={unlockError}
              clearUnlockError={clearUnlockError}
            />
          ) : (
            <>
              {tab === 'home' && <HomeScreen setTab={setTab} openModal={openModal} toast={toast} />}
              {tab === 'send' && <SendScreen setTab={setTab} />}
              {tab === 'receive' && <ReceiveScreen setTab={setTab} />}
              {tab === 'activity' && <ActivityScreen />}
              {tab === 'news' && <NewsScreen />}
            </>
          )}
        </div>

        {wallet && (
          <div className="absolute bottom-0 left-0 right-0 max-w-sm mx-auto bg-zinc-900/80 backdrop-blur-lg border-t border-zinc-700/30 px-6 py-3 flex justify-between">
            <TabButton icon={Wallet} label="Home" active={tab === 'home'} onClick={() => setTab('home')} />
            <TabButton icon={Send} label="Send" active={tab === 'send'} onClick={() => setTab('send')} />
            <TabButton icon={ArrowDownLeft} label="Receive" active={tab === 'receive'} onClick={() => setTab('receive')} />
            <TabButton icon={Clock} label="Activity" active={tab === 'activity'} onClick={() => setTab('activity')} />
            <TabButton icon={Newspaper} label="News" active={tab === 'news'} onClick={() => setTab('news')} />
          </div>
        )}
      </div>
    </div>
  );
}