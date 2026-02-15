'use client';

import { useState, useEffect } from 'react';
import { MOCK_PORTFOLIO } from '@/lib/constants';
import type { PortfolioState } from '@/lib/constants';
import YieldCard from './YieldCard';

function StatCard({
  label,
  value,
  subValue,
  trend,
  icon,
}: {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-border-hover transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
          {label}
        </span>
        <div className="w-8 h-8 rounded-lg bg-input flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold font-mono text-text-primary tracking-tight">
        {value}
      </p>
      {subValue && (
        <p className={`text-xs font-mono mt-1 ${
          trend === 'up' ? 'text-emerald-400' :
          trend === 'down' ? 'text-accent-red' :
          'text-text-tertiary'
        }`}>
          {trend === 'up' && '+'}
          {subValue}
        </p>
      )}
    </div>
  );
}

function AllocationBar({ allocations }: { allocations: PortfolioState['allocations'] }) {
  const protocolColors: Record<string, string> = {
    Aave: '#B6509E',
    Compound: '#00D395',
    Morpho: '#5B72E4',
    Stargate: '#9CA3AF',
    Lido: '#00A3FF',
    Pendle: '#1FC7D4',
    Yearn: '#006AE3',
    Convex: '#3A82F7',
  };

  return (
    <div className="space-y-3">
      {/* Visual bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {allocations.map((alloc, i) => (
          <div
            key={i}
            className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${alloc.percentage}%`,
              backgroundColor: protocolColors[alloc.protocol] || '#64748b',
            }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {allocations.map((alloc, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: protocolColors[alloc.protocol] || '#64748b' }}
            ></div>
            <span className="text-xs text-text-secondary">
              {alloc.protocol} <span className="text-text-tertiary font-mono">{alloc.percentage}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PortfolioDashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioState>(MOCK_PORTFOLIO);
  const [isExecuting, setIsExecuting] = useState(false);
  const [topYields, setTopYields] = useState<Array<{
    protocol: string;
    chain: string;
    symbol: string;
    apy: number;
    tvl: number;
  }>>([]);
  const [yieldsLoading, setYieldsLoading] = useState(true);

  useEffect(() => {
    async function fetchYields() {
      try {
        const res = await fetch('/api/yields');
        if (res.ok) {
          const data = await res.json();
          setTopYields(data.pools?.slice(0, 5) || []);
        }
      } catch {
        // Use fallback data
        setTopYields([
          { protocol: 'Morpho', chain: 'Ethereum', symbol: 'USDC', apy: 7.2, tvl: 890_000_000 },
          { protocol: 'Aave', chain: 'Base', symbol: 'USDC', apy: 5.8, tvl: 1_200_000_000 },
          { protocol: 'Compound', chain: 'Arbitrum', symbol: 'USDC', apy: 5.1, tvl: 650_000_000 },
          { protocol: 'Pendle', chain: 'Ethereum', symbol: 'USDC', apy: 8.4, tvl: 320_000_000 },
          { protocol: 'Aave', chain: 'Optimism', symbol: 'USDC', apy: 4.5, tvl: 440_000_000 },
        ]);
      } finally {
        setYieldsLoading(false);
      }
    }
    fetchYields();
  }, []);

  const handleExecuteStrategy = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setPortfolio(prev => ({
        ...prev,
        lastRebalance: new Date(),
      }));
      setIsExecuting(false);
    }, 3000);
  };

  const weightedApy = portfolio.allocations.reduce(
    (acc, alloc) => acc + (alloc.apy * alloc.percentage / 100), 0
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto relative pb-24">
      <div className="p-5 space-y-5">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Portfolio Value"
            value={`$${portfolio.totalValue.toLocaleString()}`}
            subValue="$1,240 (24h)"
            trend="up"
            icon={
              <svg className="w-4 h-4 text-accent-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v12M8 10l4-4 4 4" />
              </svg>
            }
          />
          <StatCard
            label="Avg APY"
            value={`${weightedApy.toFixed(2)}%`}
            subValue="0.3% vs last week"
            trend="up"
            icon={
              <svg className="w-4 h-4 text-accent-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
          />
          <StatCard
            label="Annual Yield"
            value={`$${portfolio.projectedAnnualYield.toLocaleString()}`}
            subValue="$210/month"
            trend="neutral"
            icon={
              <svg className="w-4 h-4 text-accent-purple" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
            }
          />
          <StatCard
            label="Protocols"
            value={portfolio.allocations.length.toString()}
            subValue={`${new Set(portfolio.allocations.map(a => a.chain)).size} chains`}
            trend="neutral"
            icon={
              <svg className="w-4 h-4 text-accent-amber" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            }
          />
        </div>

        {/* Active Strategy */}
        {portfolio.activeStrategy && (
          <div className="gradient-border bg-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Active Strategy</h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Last rebalanced {portfolio.lastRebalance?.toLocaleDateString() || 'Never'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-green/10 border border-accent-green/20">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"></div>
                <span className="text-xs text-accent-green font-medium">Active</span>
              </div>
            </div>
            <p className="text-sm text-text-secondary mb-3">{portfolio.activeStrategy}</p>
            <AllocationBar allocations={portfolio.allocations} />
          </div>
        )}

        {/* Current Positions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Current Positions</h3>
            <span className="text-xs text-text-tertiary font-mono">
              {portfolio.allocations.length} positions
            </span>
          </div>
          <div className="grid gap-3">
            {portfolio.allocations.map((alloc, i) => (
              <YieldCard
                key={i}
                protocol={alloc.protocol}
                chain={alloc.chain}
                symbol={alloc.symbol}
                apy={alloc.apy}
                amount={alloc.amount}
                percentage={alloc.percentage}
              />
            ))}
          </div>
        </div>

        {/* Top Yield Opportunities */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Top Yield Opportunities</h3>
            <span className="text-xs text-accent-blue font-medium">Live data</span>
          </div>
          {yieldsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 rounded-lg animate-shimmer border border-border"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {topYields.map((pool, i) => (
                <YieldCard
                  key={i}
                  protocol={pool.protocol}
                  chain={pool.chain}
                  symbol={pool.symbol}
                  apy={pool.apy}
                  tvl={pool.tvl}
                  compact
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Sticky Execute Strategy Button */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
        <button
          onClick={handleExecuteStrategy}
          disabled={isExecuting}
          className={`w-full py-4 rounded-xl font-bold text-base text-white
            transition-all flex items-center justify-center gap-2.5 cursor-pointer
            disabled:cursor-not-allowed disabled:opacity-50
            ${isExecuting
              ? 'bg-accent-green/70'
              : 'bg-gradient-to-r from-[#2a4ab8] via-accent-green to-accent-blue hover:brightness-110 animate-btn-pulse-glow'
            }`}
        >
          {isExecuting ? (
            <>
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Executing Strategy...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Execute Strategy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
