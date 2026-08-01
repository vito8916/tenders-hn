import React from 'react'
import Link from 'next/link'
import SupaNextLogo from "@/components/supanext-logo";

/**
 * Minimal layout for auth pages (login, sign-up, password flows).
 * Centers content and shows the brand logo.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <SupaNextLogo className="w-40" />
        </Link>
        {children}
      </div>
    </div>
  )
}
