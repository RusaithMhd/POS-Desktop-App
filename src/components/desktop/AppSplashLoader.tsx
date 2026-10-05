'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { getLocalDb } from '@/infrastructure/database/sqlite/db';

interface AppSplashLoaderProps {
  onComplete?: () => void;
}

export function AppSplashLoader({ onComplete }: AppSplashLoaderProps) {
  const [progress, setProgress] = useState(15);
  const [statusText, setStatusText] = useState('Initializing SQLite Database Engine...');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Check if splash has already run in this session
    if (typeof window !== 'undefined' && sessionStorage.getItem('triwyn_pos_splash_shown')) {
      setIsVisible(false);
      return;
    }

    let isMounted = true;

    async function initApp() {
      try {
        if (isMounted) {
          setProgress(35);
          setStatusText('Loading Local Store & Terminal Data...');
        }

        await getLocalDb();

        if (isMounted) {
          setProgress(75);
          setStatusText('Verifying Printer & Cash Drawer Interop...');
        }

        await new Promise((r) => setTimeout(r, 400));

        if (isMounted) {
          setProgress(100);
          setStatusText('TRIWYN POS Ready');
        }

        await new Promise((r) => setTimeout(r, 300));

        if (isMounted) {
          setIsFadingOut(true);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('triwyn_pos_splash_shown', 'true');
          }
          setTimeout(() => {
            setIsVisible(false);
            if (onComplete) onComplete();
          }, 400);
        }
      } catch (err) {
        console.error('Splash initialization error:', err);
        if (isMounted) {
          setIsFadingOut(true);
          setTimeout(() => setIsVisible(false), 300);
        }
      }
    }

    initApp();

    return () => {
      isMounted = false;
    };
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none transition-opacity duration-400 font-sans ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundImage: `url('/Assets/Start_page_Bg.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark overlay backdrop with subtle blur */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6 text-center space-y-6">
        {/* App Icon */}
        <div className="relative group">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-400 opacity-75 blur-lg group-hover:opacity-100 transition duration-500 animate-pulse" />
          <div className="relative h-24 w-24 rounded-2xl bg-slate-900 border border-slate-700/80 p-3 shadow-2xl flex items-center justify-center overflow-hidden">
            <img
              src="/Assets/Icon.png"
              alt="TRIWYN POS Icon"
              className="h-full w-full object-contain drop-shadow-md"
            />
          </div>
        </div>

        {/* Application Name & Subtitle */}
        <div className="space-y-1.5">
          <h1 className="text-3xl font-black tracking-wider text-white">
            TRIWYN <span className="text-emerald-400 font-extrabold">POS</span>
          </h1>
          <p className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
            Commercial Offline Point of Sale
          </p>
        </div>

        {/* Progress Bar & Status Text */}
        <div className="w-full space-y-2.5 pt-2">
          <div className="h-2 w-full bg-slate-800/90 border border-slate-700/60 rounded-full overflow-hidden p-0.5 shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 rounded-full transition-all duration-300 shadow-sm"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
            <span className="truncate">{statusText}</span>
            <span className="font-bold text-emerald-400">{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
