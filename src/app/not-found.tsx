import React from "react";
import Link from "next/link";
import { Compass, Home, BotMessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 mb-4 shadow-sm">
        <Compass className="h-7 w-7" aria-hidden="true" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
        404 — Page Not Found
      </h1>

      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md">
        The requested atmospheric dashboard, simulator view, or corridor route does not exist or has been moved.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href="/">
          <Button
            variant="primary"
            className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs px-4 py-2"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Return to Overview</span>
          </Button>
        </Link>

        <Link href="/assistant">
          <Button
            variant="outline"
            className="flex items-center gap-1.5 border-slate-200 dark:border-slate-800 text-xs px-4 py-2"
          >
            <BotMessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ask AI Assistant</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
