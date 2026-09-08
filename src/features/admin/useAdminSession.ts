import { useCallback, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

type AdminLookupResult = {
  data: { user_id: string } | null;
  error: unknown;
};

type AdminLookup = {
  maybeSingle(): Promise<AdminLookupResult>;
};

type AdminSelect = {
  eq(column: "user_id", value: string): AdminLookup;
};

export type AdminClient = {
  auth: {
    getSession(): Promise<{ data: { session: Session | null }; error: unknown }>;
    onAuthStateChange(
      listener: (event: string, session: Session | null) => void,
    ): { data: { subscription: { unsubscribe(): void } } };
    signInWithPassword(credentials: {
      email: string;
      password: string;
    }): Promise<{ data: unknown; error: unknown }>;
    signOut(): Promise<{ error: unknown }>;
  };
  from(table: "admin_users"): {
    select(columns: "user_id"): AdminSelect;
  };
};

export type AdminSessionState = {
  loading: boolean;
  user: User | null;
  isAdmin: boolean;
  signInPending: boolean;
  error: "login" | "access" | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};

export function useAdminSession(client: AdminClient): AdminSessionState {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signInPending, setSignInPending] = useState(false);
  const [error, setError] = useState<"login" | "access" | null>(null);
  const verificationId = useRef(0);

  const verifySession = useCallback(async (session: Session | null, active: () => boolean) => {
    const currentVerification = ++verificationId.current;
    const canUpdate = () => active() && currentVerification === verificationId.current;
    setLoading(true);

    if (!session) {
      if (canUpdate()) {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      }
      return;
    }

    const { data, error: lookupError } = await client
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!canUpdate()) return;

    if (lookupError || data?.user_id !== session.user.id) {
      setUser(null);
      setIsAdmin(false);
      setError("access");
      await client.auth.signOut();
      if (canUpdate()) setLoading(false);
      return;
    }

    setUser(session.user);
    setIsAdmin(true);
    setError(null);
    setLoading(false);
  }, [client]);

  useEffect(() => {
    let active = true;
    const isActive = () => active;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      void verifySession(session, isActive);
    });

    void client.auth.getSession().then(({ data }) => {
      void verifySession(data.session, isActive);
    }).catch(() => {
      if (!active) return;
      setUser(null);
      setIsAdmin(false);
      setError("access");
      setLoading(false);
    });

    return () => {
      active = false;
      verificationId.current += 1;
      subscription.unsubscribe();
    };
  }, [client, verifySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    setSignInPending(true);
    setError(null);
    try {
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) setError("login");
    } catch {
      setError("login");
    } finally {
      setSignInPending(false);
    }
  }, [client]);

  const signOut = useCallback(async () => {
    try {
      await client.auth.signOut();
    } finally {
      verificationId.current += 1;
      setUser(null);
      setIsAdmin(false);
      setError(null);
      setLoading(false);
    }
  }, [client]);

  return { loading, user, isAdmin, signInPending, error, signIn, signOut };
}
