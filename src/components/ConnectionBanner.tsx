import type { ConnectionStatus } from "../repositories/EventRepository";

type ConnectionBannerProps = {
  status: ConnectionStatus;
};

export function ConnectionBanner({ status }: ConnectionBannerProps) {
  if (status !== "reconnecting") return null;

  return (
    <div
      className="connection-banner"
      role="status"
      aria-label="Connexion interrompue"
      aria-live="polite"
    >
      Reconnexion en cours… Les dernières données restent affichées.
    </div>
  );
}
