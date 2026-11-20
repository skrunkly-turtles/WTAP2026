"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, Meta, Persona, setActingUserId } from "./api";

// Demo stand-in for auth: the app starts as an admin. On the main dashboard the admin can
// "view as" a participant persona to preview exactly what participants see.
interface ViewState {
  meta: Meta | null;
  actingUser: Persona | null;
  setActingUser: (id: number) => void;
  isAdmin: boolean;
  version: number; // bumps when acting user changes so views refetch
}

const Ctx = createContext<ViewState | null>(null);
const DEFAULT_ADMIN = 1;

export function ViewProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [actingId, setActingId] = useState(DEFAULT_ADMIN);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => setMeta(null));
  }, []);

  const setActingUser = useCallback((id: number) => {
    setActingUserId(id);
    setActingId(id);
    setVersion((v) => v + 1);
  }, []);

  const value = useMemo<ViewState>(() => {
    const actingUser = meta?.personas.find((p) => p.id === actingId) ?? null;
    return { meta, actingUser, setActingUser, isAdmin: actingUser ? actingUser.role === "admin" : true, version };
  }, [meta, actingId, setActingUser, version]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useView() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useView outside ViewProvider");
  return v;
}

export const DEFAULT_ADMIN_ID = DEFAULT_ADMIN;
