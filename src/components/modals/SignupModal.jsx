import React, { useState } from 'react';
import ModalWrapper from './ModalWrapper';
import { useAuth } from '../../context/AuthContext';
import { ethers } from 'ethers';
import { Loader2, Copy, Check } from 'lucide-react';
import { apiCall } from '../../utils/api';

async function encryptPrivateKey(privateKey, password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(privateKey));
  return { salt: Array.from(salt), iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext)) };
}

export default function SignupModal({ onClose, toast }) {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('form');
  const [mnemonic, setMnemonic] = useState('');
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) { toast('Fill all fields'); return; }
    if (password.length < 6) { toast('Password must be at least 6 characters'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email address'); return; }

    setLoading(true);
    try {
      // 1. Create user account
      await signup(email, password, name);

      // 2. Generate wallet locally
      let wallet;
      try {
        wallet = ethers.Wallet.createRandom();
      } catch (e) {
        toast('Failed to create wallet. Please try again.');
        return;
      }

      // 3. Encrypt and store private key
      let encrypted;
      try {
        encrypted = await encryptPrivateKey(wallet.privateKey, password);
        localStorage.setItem('capitan_encrypted_key', JSON.stringify(encrypted));
      } catch (e) {
        toast('Failed to encrypt wallet. Please try a different password.');
        return;
      }

      // 4. Activate wallet via backend – sends 2,000 CLOSE from the distribution wallet
      try {
        await apiCall('/api/wallet/activate', {
          method: 'POST',
          body: JSON.stringify({
            password,
            wallet_address: wallet.address,
            distribution_wallet: '0xae3e3f0c9243ba74b4fbeb38d120c773650aa003'
          }),
        });
      } catch {}

      setMnemonic(wallet.mnemonic.phrase);
      setStep('mnemonic');
      toast('Wallet created! Save your seed phrase securely.');
    } catch (e) {
      toast('Signup failed: ' + (e.message || 'Please try again'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinish = () => {
    if (!acknowledged) {
      toast('Please confirm you have saved your seed phrase.');
      return;
    }
    onClose();
  };

  const openLogin = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('open-login-modal'));
  };

  return (
    <ModalWrapper title="Create OS Wallet" onClose={onClose}>
      {step === 'form' ? (
        <div className="space-y-3">
          <div className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-3 text-xs text-amber-200/80 mb-3">
            🔐 Your password will also secure your non‑custodial wallet. After signing up, you'll receive a 12‑word seed phrase — <strong>save it safely</strong>.
          </div>
          <input
            id="signup-email" name="email" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="Email"
            autoComplete="email"
            className="w-full p-3 border border-[var(--glass-border)] rounded-2xl bg-[var(--input-bg)] text-[var(--text-primary)] outline-none"
          />
          <input
            id="signup-password" name="password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6)"
            autoComplete="new-password"
            className="w-full p-3 border border-[var(--glass-border)] rounded-2xl bg-[var(--input-bg)] text-[var(--text-primary)] outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <input
            id="signup-name" name="name" value={name}
            onChange={(e) => setName(e.target.value)} placeholder="Name (optional)"
            autoComplete="name"
            className="w-full p-3 border border-[var(--glass-border)] rounded-2xl bg-[var(--input-bg)] text-[var(--text-primary)] outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-[var(--accent)] text-white rounded-3xl font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Creating…' : 'Create Account'}
          </button>
          <p className="text-center mt-3 text-xs text-[var(--text-secondary)]">
            Already have an account?{' '}
            <button onClick={openLogin} className="text-[var(--accent)] underline cursor-pointer">Sign in</button>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-3 text-sm text-amber-200/80">
            <strong>⚠️ Your Secret Recovery Phrase</strong>
            <p className="text-xs mt-1">Write it down and store it safely.</p>
          </div>
          {mnemonic ? (
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 font-mono text-sm text-zinc-100 break-words relative">
              {mnemonic}
              <button onClick={handleCopy} className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300">
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>
          ) : (
            <p className="text-zinc-400 text-sm">Loading seed phrase…</p>
          )}
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={() => setAcknowledged(!acknowledged)}
              className="rounded accent-[var(--accent)]"
            />
            I have saved my seed phrase securely
          </label>
          <button
            onClick={handleFinish}
            disabled={!acknowledged}
            className="w-full py-3 bg-[var(--accent)] text-white rounded-3xl font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            Continue to Capitan AI
          </button>
        </div>
      )}
    </ModalWrapper>
  );
}