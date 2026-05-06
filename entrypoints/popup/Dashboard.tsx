import React, { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Info,
  Loader2,
  Lock,
  ShoppingCart,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Separator } from '@/components/ui/Separator';
import type { Genome } from '@/lib/types';
import type { ScrapeRequest, ScrapeResponse } from '@/lib/messaging/types';

interface DashboardProps {
  genome: Genome;
}

type ScoutStatus = 'idle' | 'scouting' | 'success' | 'error';
type ScoutResult = {
  asin: string;
  trueValue: number;
  personalFit: number;
  price: number | null;
  currency: string;
  region: string;
};

const AMAZON_PRODUCT_PATH = /\/(dp|gp\/product)\/[A-Z0-9]{10}/i;

function isAmazonProductUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      /(^|\.)amazon\.(com|co\.uk|de|co\.jp|ca|fr|it|es)$/i.test(u.hostname) &&
      AMAZON_PRODUCT_PATH.test(u.pathname)
    );
  } catch {
    return false;
  }
}

async function getActiveTab(): Promise<{ id?: number; url?: string } | null> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    return tabs[0] ?? null;
  } catch {
    return null;
  }
}

function scoreTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 75) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

const ScoreTile: React.FC<{ label: string; value: number; description: string }> = ({
  label,
  value,
  description,
}) => {
  const tone = scoreTone(value);
  const indicatorClass =
    tone === 'success' ? 'bg-success' : tone === 'warning' ? 'bg-warning' : 'bg-danger';
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Badge variant={tone}>{value}</Badge>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
      <Progress
        value={value}
        className="mt-2"
        indicatorClassName={indicatorClass}
        aria-label={`${label} score ${value} out of 100`}
      />
      <p className="mt-1.5 text-[11px] leading-tight text-muted-foreground">{description}</p>
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ genome }) => {
  const [activeUrl, setActiveUrl] = useState<string | undefined>(undefined);
  const [activeTabId, setActiveTabId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<ScoutStatus>('idle');
  const [result, setResult] = useState<ScoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshActiveTab = useCallback(async () => {
    const tab = await getActiveTab();
    setActiveUrl(tab?.url);
    setActiveTabId(tab?.id);
  }, []);

  useEffect(() => {
    void refreshActiveTab();
    const onUpdated = (_id: number, changeInfo: { url?: string }) => {
      if (changeInfo.url) void refreshActiveTab();
    };
    const onActivated = () => void refreshActiveTab();
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onActivated.addListener(onActivated);
    return () => {
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onActivated.removeListener(onActivated);
    };
  }, [refreshActiveTab]);

  const onAmazonProduct = isAmazonProductUrl(activeUrl);

  const handleQuickScout = async () => {
    setStatus('scouting');
    setError(null);
    setResult(null);
    try {
      const message: ScrapeRequest = { type: 'SCRAPE_REQUEST' };
      const res = (await browser.runtime.sendMessage(message)) as ScrapeResponse | undefined;
      if (!res) throw new Error('No response from background service');
      if (!res.success) throw new Error(res.error || 'Unknown failure');
      setResult(res.payload);
      setStatus('success');
      toast.success('Scout complete', {
        description: `True Value ${Math.round(res.payload.trueValue)} · Personal Fit ${Math.round(
          res.payload.personalFit,
        )}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[smartdeal-hunter] Quick Scout failed', e);
      setError(msg);
      setStatus('error');
      toast.error('Scout failed', { description: msg });
    }
  };

  const handleOpenAmazon = async () => {
    await browser.tabs.create({ url: 'https://www.amazon.com' });
  };

  const handleFocusActiveTab = async () => {
    if (!activeTabId) return;
    await browser.tabs.update(activeTabId, { active: true });
  };

  const topDimensions = Object.entries(genome.dimensions)
    .sort(([, a], [, b]) => b.weight - a.weight)
    .slice(0, 3)
    .map(([dim, state]) => ({
      name: dim.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      weight: state.weight,
    }));

  const scouting = status === 'scouting';

  return (
    <div className="flex flex-col gap-3 p-3">
      <header className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Lock className="size-3.5" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">SmartDeal Hunter</span>
            <span className="text-[10px] text-muted-foreground">Privacy-first · on-device</span>
          </div>
        </div>
        <Badge variant="outline" className="font-mono text-[10px]">
          v0.1.0
        </Badge>
      </header>

      <Separator />

      {!onAmazonProduct && (
        <Alert variant="info">
          <Info />
          <AlertTitle>Open an Amazon product page</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Quick Scout reads the product currently in your active tab. It only runs on
            <span className="font-mono"> amazon.com/dp/...</span> URLs.
          </AlertDescription>
          <div className="mt-2 pl-6">
            <Button variant="outline" size="sm" onClick={handleOpenAmazon}>
              <ShoppingCart /> Browse Amazon
            </Button>
          </div>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top genome priorities</CardTitle>
          <CardDescription>What scoring leans on most for you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {topDimensions.map((dim) => (
            <div key={dim.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{dim.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {(dim.weight * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={dim.weight * 100} aria-label={`${dim.name} weight`} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button
        onClick={handleQuickScout}
        disabled={scouting || !onAmazonProduct}
        className="w-full"
        size="lg"
      >
        {scouting ? (
          <>
            <Loader2 className="animate-spin" /> Scouting…
          </>
        ) : (
          <>Quick Scout</>
        )}
      </Button>
      <p className="-mt-1 text-center text-[11px] text-muted-foreground">
        On-device scoring. Nothing leaves your machine.
      </p>

      {status === 'error' && error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Scout failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {status === 'success' && result && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              <CardTitle className="text-sm">Scout result</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-[10px]">
                {result.region}
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px]">
                {result.asin}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <div className="col-span-2 mb-2 rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Detected Price</p>
              <p className="text-lg font-bold">
                {result.price !== null
                  ? new Intl.NumberFormat(undefined, {
                      style: 'currency',
                      currency: result.currency || 'USD',
                    }).format(result.price)
                  : 'N/A'}
              </p>
            </div>
            <ScoreTile
              label="True Value"
              value={Math.round(result.trueValue)}
              description="Objective worth based on price, reviews, brand."
            />
            <ScoreTile
              label="Personal Fit"
              value={Math.round(result.personalFit)}
              description="Match to your genome priorities."
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFocusActiveTab}
              className="col-span-2 h-8"
            >
              <ExternalLink /> View on Amazon page
            </Button>
          </CardContent>
        </Card>
      )}

      {status === 'idle' && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
            <Inbox className="size-6 text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">No recent analyses</p>
            <p className="text-[11px] text-muted-foreground">Run Quick Scout to see scores here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
