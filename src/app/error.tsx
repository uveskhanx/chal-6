"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log exception to monitoring
    console.error("[SaansAI ErrorBoundary] Unhandled client exception:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mb-4 shadow-sm">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
        Something went wrong
      </h1>

      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md">
        An unexpected error occurred while loading this environmental view.
        Our atmospheric physics engines and calculation models remain safe.
      </p>

      {error.digest && (
        <p className="mt-2 text-xs font-mono text-slate-400">
          Error Reference: <span className="select-all">{error.digest}</span>
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => reset()}
          variant="primary"
          className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs px-4 py-2"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Try Again</span>
        </Button>

        <Link href="/">
          <Button
            variant="outline"
            className="flex items-center gap-1.5 border-slate-200 dark:border-slate-800 text-xs px-4 py-2"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Return to Overview</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
