'use client';

import { useState } from 'react';

export default function Header() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress] = useState('0x1a2B...9f4E');

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo and branding */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div className="relative w-9 h-9 flex items-center justify-center">
              <div className="absolute inset-0 bg-accent-green/20 rounded-lg rotate-12"></div>
              <div className="absolute inset-0.5 bg-card rounded-lg rotate-12"></div>
              <svg
                className="relative z-10 w-5 h-5 text-accent-green"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>

            {/* App name */}
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-text-primary tracking-tight leading-none">
                Yield<span className="text-accent-green">Pilot</span>
              </h1>
              <p className="text-[11px] text-text-tertiary leading-none mt-0.5 hidden sm:block">
                AI copilot for cross-chain yield optimization
              </p>
            </div>
          </div>

          {/* Status indicator */}
          <div className="hidden md:flex items-center gap-2 ml-6 px-3 py-1.5 rounded-full bg-accent-green/10 border border-accent-green/20">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"></div>
            <span className="text-xs text-accent-green font-medium">Live</span>
          </div>
        </div>

        {/* Right side - nav and wallet */}
        <div className="flex items-center gap-4">
          {/* Network indicator */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-input border border-border text-text-secondary text-xs">
            <div className="w-2 h-2 rounded-full bg-accent-blue"></div>
            Multi-chain
          </div>

          {/* Wallet connect button */}
          <button
            onClick={() => setWalletConnected(!walletConnected)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              transition-all duration-200 cursor-pointer
              ${walletConnected
                ? 'bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green/20'
                : 'bg-accent-green text-white hover:bg-accent-green/90 shadow-lg shadow-accent-green/20'
              }
            `}
          >
            {walletConnected ? (
              <>
                <div className="w-2 h-2 rounded-full bg-accent-green"></div>
                <span className="font-mono text-xs">{walletAddress}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="6" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                  <circle cx="16" cy="14" r="1.5" fill="currentColor" />
                </svg>
                Connect Wallet
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
