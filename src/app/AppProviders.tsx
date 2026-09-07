import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  ConnectionStatus,
  EventRepository,
  EventSnapshot,
  Unsubscribe,
} from "../repositories/EventRepository";
import { ConnectionBanner } from "../components/ConnectionBanner";

type EventContextValue = {
  snapshot: EventSnapshot;
  status: ConnectionStatus;
  repository: EventRepository;
};

const EventContext = createContext<EventContextValue | null>(null);

export type AppProvidersProps = {
  repository: EventRepository;
  eventSlug: string;
  children: ReactNode;
};

export function AppProviders({ repository, eventSlug, children }: AppProvidersProps) {
  const [snapshot, setSnapshot] = useState<EventSnapshot | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("online");

  useEffect(() => {
    let active = true;
    const acceptSnapshot = (nextSnapshot: EventSnapshot) => {
      if (active) setSnapshot(nextSnapshot);
    };
    const acceptStatus = (nextStatus: ConnectionStatus) => {
      if (active) setStatus(nextStatus);
    };
    const unsubscribe: Unsubscribe = repository.subscribe(
      eventSlug,
      acceptSnapshot,
      acceptStatus,
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [eventSlug, repository]);

  const contextValue = useMemo<EventContextValue>(
    () => ({ snapshot: snapshot as EventSnapshot, status, repository }),
    [repository, snapshot, status],
  );

  if (snapshot === null) {
    return <div className="loading-screen" role="status" aria-label="Chargement de l'événement">Chargement de l’événement…</div>;
  }

  return (
    <EventContext.Provider value={contextValue}>
      <ConnectionBanner status={status} />
      {children}
    </EventContext.Provider>
  );
}

export function useEventContext(): EventContextValue {
  const context = useContext(EventContext);
  if (!context) throw new Error("useEventContext must be used inside AppProviders");
  return context;
}
