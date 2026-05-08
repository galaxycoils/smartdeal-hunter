import React, { useState, useEffect, useRef } from 'react';
import { browser } from 'wxt/browser';
import { Card, CardContent, CardHeader } from './Card';
import { Button } from './Button';
import { Bell, BellOff, LineChart, Loader2 } from 'lucide-react';
import { PriceChart } from './PriceChart';
import { get30DayPriceHistory, PriceRecord } from '../../lib/price-history';
import type { ListEnrolledAlertsResponse } from '../../lib/messaging/types';
import { extractReviews } from '../../lib/review-extractor';
import type { AuthenticityResult } from '../../lib/types';

export interface ScoutPanelProps {
  asin: string;
  trueValue: number;
  personalFit: number;
  onClose: () => void;
  onFeedback?: (type: 'not_interested' | 'saved' | 'purchased') => void;
}

export const ScoutPanel: React.FC<ScoutPanelProps> = ({
  asin: _asin,
  trueValue,
  personalFit,
  onClose,
  onFeedback,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyData, setHistoryData] = useState<PriceRecord[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [notificationsAllowed, setNotificationsAllowed] = useState(true);
  const authCacheRef = useRef<Map<string, AuthenticityResult>>(new Map());
  const [authResult, setAuthResult] = useState<AuthenticityResult | null>(null);
  const [whyExpanded, setWhyExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = (await browser.runtime.sendMessage({
          type: 'LIST_ENROLLED_ALERTS',
        })) as ListEnrolledAlertsResponse | undefined;
        if (cancelled) return;
        if (res?.type === 'ENROLLED_ALERTS') {
          setIsEnrolled(res.payload.asins.includes(_asin));
        }
      } catch {
        /* ignore */
      }

      try {
        const level = await chrome.notifications.getPermissionLevel();
        if (!cancelled) setNotificationsAllowed(level === 'granted');
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [_asin]);

  const handleWatchToggle = async () => {
    const type = isEnrolled ? 'DISENROLL_ALERT' : 'ENROLL_ALERT';
    setIsEnrolled(!isEnrolled);
    try {
      await browser.runtime.sendMessage({ type, payload: { asin: _asin } });
    } catch {
      setIsEnrolled(isEnrolled); // revert on failure
    }
  };

  useEffect(() => {
    if (!_asin) {
      setAuthResult(null);
      return;
    }
    const cached = authCacheRef.current.get(_asin);
    if (cached) {
      setAuthResult(cached);
      return;
    }
    const samples = extractReviews(document);
    if (samples.length < 5) {
      setAuthResult(null);
      return;
    }
    let cancelled = false;
    chrome.runtime
      .sendMessage({ type: 'COMPUTE_AUTHENTICITY', payload: { asin: _asin, samples } })
      .then((reply: { type: string; payload: AuthenticityResult } | undefined) => {
        if (cancelled) return;
        if (reply?.type === 'AUTHENTICITY_RESULT') {
          authCacheRef.current.set(_asin, reply.payload);
          setAuthResult(reply.payload);
        }
      })
      .catch(() => {
        /* swallow — extension can be reloaded mid-session */
      });
    return () => {
      cancelled = true;
    };
  }, [_asin]);

  useEffect(() => {
    let isMounted = true;
    if (showHistory && historyData.length === 0) {
      setIsLoadingHistory(true);
      get30DayPriceHistory(_asin).then((data) => {
        if (isMounted) {
          setHistoryData(data);
          setIsLoadingHistory(false);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [showHistory, _asin, historyData.length]);

  return (
    <Card className="w-80 shadow-lg border-gray-300 font-sans text-gray-900">
      <CardHeader className="flex justify-between items-center bg-gray-50 py-3">
        <h2 className="text-lg font-bold text-gray-800 m-0">SmartDeal Scout</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 focus:outline-none p-1 rounded-full hover:bg-gray-200 transition-colors"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex justify-between items-center">
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              True Value
            </span>
            <span className="text-3xl font-extrabold text-blue-600">{trueValue}</span>
          </div>
          <div className="h-12 w-px bg-gray-200"></div>
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Personal Fit
            </span>
            <span className="text-3xl font-extrabold text-green-600">{personalFit}</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full flex items-center justify-center gap-2 mt-2"
          onClick={handleWatchToggle}
          disabled={!notificationsAllowed}
          aria-pressed={isEnrolled}
        >
          {isEnrolled ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {isEnrolled ? 'Stop watching' : 'Watch'}
        </Button>

        <Button
          variant="outline"
          className="w-full flex items-center justify-center gap-2 mt-2"
          onClick={() => setShowHistory(!showHistory)}
          aria-expanded={showHistory}
        >
          <LineChart className="w-4 h-4" />
          {showHistory ? 'Hide Price History' : 'View Price History'}
        </Button>

        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            showHistory ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'
          }`}
        >
          {isLoadingHistory ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : historyData.length > 0 ? (
            <PriceChart data={historyData} />
          ) : null}
        </div>

        {authResult && authResult.sampleCount >= 5 && (
          <div className="flex flex-col gap-1 mt-2 text-sm text-gray-700">
            <div className="flex items-center gap-2 flex-wrap">
              <span>Reviews: {authResult.score}% authentic</span>
              <span className="text-xs text-gray-400">
                based on {authResult.sampleCount} visible reviews
              </span>
              {authResult.suspiciousIndices.length > 0 && (
                <button
                  onClick={() => setWhyExpanded((v) => !v)}
                  className="text-xs underline text-blue-600 hover:text-blue-800"
                >
                  Why?
                </button>
              )}
            </div>
            {whyExpanded && (
              <ul className="mt-1 pl-4 list-disc text-xs text-gray-600">
                {authResult.suspiciousIndices.slice(0, 3).map((idx) => (
                  <li key={idx}>{(authResult.reasons[idx] ?? []).join('; ')}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 mt-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Feedback
          </span>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="text-xs py-1.5 px-2"
              onClick={() => onFeedback?.('not_interested')}
            >
              Not Interested
            </Button>
            <Button
              variant="outline"
              className="text-xs py-1.5 px-2"
              onClick={() => onFeedback?.('saved')}
            >
              Saved
            </Button>
            <Button
              variant="primary"
              className="text-xs py-1.5 px-2"
              onClick={() => onFeedback?.('purchased')}
            >
              Purchased
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
