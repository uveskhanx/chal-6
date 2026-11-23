"use client";

import React, { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SaansAI GlobalError] Root crash exception:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-900">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center shadow-lg">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Critical System Error</h1>
          <p className="text-sm text-slate-600 mb-6">
            A critical application error occurred. You can attempt to recover by refreshing the page.
          </p>
          <Button
            onClick={() => reset()}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Restart Application</span>
          </Button>
        </div>
      </body>
    </html>
  );
}
