'use client';

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TokenSync />
      {children}
    </SessionProvider>
  );
}

function TokenSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (session?.accessToken) localStorage.setItem('token', session.accessToken);
    else if (status === 'unauthenticated') localStorage.removeItem('token');
  }, [session?.accessToken, status]);

  return null;
}
