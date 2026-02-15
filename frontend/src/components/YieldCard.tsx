'use client';

interface YieldCardProps {
  protocol: string;
  chain: string;
  symbol: string;
  apy: number;
  tvl?: number;
  percentage?: number;
  amount?: number;
  compact?: boolean;
}

const chainColors: Record<string, string> = {
  Ethereum: '#627EEA',
  Arbitrum: '#28A0F0',
  Optimism: '#FF0420',
  Base: '#0052FF',
  Polygon: '#8247E5',
  Avalanche: '#E84142',
};

const protocolColors: Record<string, string> = {
  Aave: '#B6509E',
  Compound: '#00D395',
  Lido: '#00A3FF',
  Morpho: '#5B72E4',
  Pendle: '#1FC7D4',
  Yearn: '#006AE3',
  Convex: '#3A82F7',
  Stargate: '#9CA3AF',
};

function formatTVL(tvl: number): string {
  if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(1)}B`;
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(1)}M`;
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(1)}K`;
  return `$${tvl.toFixed(0)}`;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function YieldCard({
  protocol,
  chain,
  symbol,
  apy,
  tvl,
  percentage,
  amount,
  compact = false,
}: YieldCardProps) {
  const chainColor = chainColors[chain] || '#64748b';
  const protocolColor = protocolColors[protocol] || '#64748b';

  if (compact) {
    return (
      <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-input/50 hover:bg-input transition-colors">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: protocolColor + '30' }}
          >
            <span style={{ color: protocolColor }}>
              {protocol.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">{protocol}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: chainColor }}
              ></div>
              <p className="text-xs text-text-tertiary">{chain} &middot; {symbol}</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono font-semibold text-accent-green">
            {apy.toFixed(2)}%
          </p>
          {amount && (
            <p className="text-xs text-text-tertiary font-mono mt-0.5">
              {formatAmount(amount)}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative bg-card border border-border rounded-xl p-4 hover:border-border-hover transition-all duration-200">
      {/* Percentage bar */}
      {percentage !== undefined && (
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl overflow-hidden">
          <div
            className="h-full rounded-t-xl transition-all duration-500"
            style={{
              width: `${percentage}%`,
              backgroundColor: protocolColor,
            }}
          ></div>
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: protocolColor + '20' }}
          >
            <span style={{ color: protocolColor }}>
              {protocol.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{protocol}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: chainColor }}
              ></div>
              <span className="text-xs text-text-secondary">{chain}</span>
            </div>
          </div>
        </div>

        {/* APY Badge */}
        <div className="flex flex-col items-end">
          <div className="px-2.5 py-1 rounded-lg bg-accent-green/10 border border-accent-green/20">
            <span className="text-sm font-mono font-bold text-accent-green">
              {apy.toFixed(2)}%
            </span>
          </div>
          <span className="text-[10px] text-text-tertiary mt-1 uppercase tracking-wider">APY</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded-md bg-input text-text-secondary">
            {symbol}
          </span>
          {percentage !== undefined && (
            <span className="text-text-tertiary">
              {percentage}% allocation
            </span>
          )}
        </div>
        {tvl !== undefined && (
          <span className="text-text-tertiary font-mono">
            TVL {formatTVL(tvl)}
          </span>
        )}
        {amount !== undefined && (
          <span className="text-text-secondary font-mono font-medium">
            {formatAmount(amount)}
          </span>
        )}
      </div>
    </div>
  );
}
