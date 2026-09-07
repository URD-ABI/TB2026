import { useEffect, type CSSProperties } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { getPublicNavigation } from "../app/routes";
import { useEventContext } from "../app/AppProviders";

type EventBackgroundStyle = CSSProperties & {
  "--event-background"?: string;
};

function toCssBackground(backgroundUrl: string | null): string | undefined {
  if (!backgroundUrl) return undefined;

  try {
    const parsed = new URL(backgroundUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
    return `url(${JSON.stringify(parsed.href)})`;
  } catch {
    return undefined;
  }
}

export function PublicLayout() {
  const { snapshot } = useEventContext();
  const { event } = snapshot;
  const background = toCssBackground(event.backgroundUrl);
  const style: EventBackgroundStyle | undefined = background
    ? { "--event-background": background }
    : undefined;

  useEffect(() => {
    document.title = event.title;
  }, [event.title]);

  return (
    <div className="public-layout" data-testid="public-layout" style={style}>
      <div className="public-layout__veil" aria-hidden="true" />
      <div className="public-layout__glow public-layout__glow--left" aria-hidden="true" />
      <div className="public-layout__glow public-layout__glow--right" aria-hidden="true" />

      <header className="event-header">
        <p className="event-header__eyebrow">Cinq équipes · une aventure</p>
        <h1>{event.title}</h1>
        <p className="event-header__subtitle">{event.subtitle}</p>

        <nav className="main-navigation" aria-label="Navigation principale">
          {getPublicNavigation(event.quizEnabled).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => isActive ? "main-navigation__link is-active" : "main-navigation__link"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="public-content" id="contenu-principal">
        <Outlet />
      </main>
    </div>
  );
}
