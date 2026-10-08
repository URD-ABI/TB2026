import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AdminApp } from "./AdminApp";
import type { AdminClient } from "./useAdminSession";

type Session = { user: { id: string } };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

function makeAdminClient(options: {
  session?: Session | null;
  isAdmin?: boolean;
  signInError?: { message: string } | null;
  signOutError?: { message: string } | null;
} = {}) {
  let authListener: ((event: string, session: Session | null) => void) | undefined;
  const unsubscribe = vi.fn();
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.isAdmin === false ? null : { user_id: "admin-1" },
    error: null,
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getSession = vi.fn().mockResolvedValue({
    data: { session: options.session ?? null },
    error: null,
  });
  const signInWithPassword = vi.fn().mockResolvedValue({
    data: { session: null, user: null },
    error: options.signInError ?? null,
  });
  const signOut = vi.fn().mockResolvedValue({ error: options.signOutError ?? null });
  const onAuthStateChange = vi.fn((listener) => {
    authListener = listener;
    return { data: { subscription: { unsubscribe } } };
  });

  return {
    client: {
      auth: { getSession, onAuthStateChange, signInWithPassword, signOut },
      from,
    } as unknown as AdminClient,
    emitAuth(event: string, session: Session | null) {
      authListener?.(event, session);
    },
    spies: { eq, from, getSession, maybeSingle, onAuthStateChange, select, signInWithPassword, signOut, unsubscribe },
  };
}

function renderAdmin(client: AdminClient, path = "/admin") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/*" element={<AdminApp auth={client} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminApp", () => {
  it("annonce un chargement accessible pendant la vérification de session", () => {
    const pending = deferred<{ data: { session: null }; error: null }>();
    const fake = makeAdminClient();
    fake.spies.getSession.mockReturnValueOnce(pending.promise);

    renderAdmin(fake.client);

    expect(screen.getByRole("status", { name: /vérification de l’accès administrateur/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /se connecter/i })).not.toBeInTheDocument();
  });

  it("affiche le formulaire de connexion lorsqu'aucune session n'existe", async () => {
    const fake = makeAdminClient();
    renderAdmin(fake.client);

    expect(await screen.findByRole("heading", { name: /administration/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /adresse e-mail/i })).toHaveAttribute("type", "email");
    expect(screen.getByLabelText(/mot de passe/i)).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /se connecter/i })).toBeEnabled();
  });

  it("transmet les identifiants à Supabase et désactive la soumission en cours", async () => {
    const user = userEvent.setup();
    const pending = deferred<{ data: { session: null; user: null }; error: null }>();
    const fake = makeAdminClient();
    fake.spies.signInWithPassword.mockReturnValueOnce(pending.promise);
    renderAdmin(fake.client);

    await user.type(await screen.findByRole("textbox", { name: /adresse e-mail/i }), "orga@example.fr");
    await user.type(screen.getByLabelText(/mot de passe/i), "secret-fiable");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(fake.spies.signInWithPassword).toHaveBeenCalledWith({
      email: "orga@example.fr",
      password: "secret-fiable",
    });
    expect(screen.getByRole("button", { name: /connexion en cours/i })).toBeDisabled();

    await act(async () => pending.resolve({ data: { session: null, user: null }, error: null }));
    expect(screen.getByRole("button", { name: /se connecter/i })).toBeEnabled();
  });

  it("affiche une erreur française générique sans révéler le message Supabase", async () => {
    const user = userEvent.setup();
    const fake = makeAdminClient({ signInError: { message: "Invalid login credentials for orga@example.fr" } });
    renderAdmin(fake.client);

    await user.type(await screen.findByRole("textbox", { name: /adresse e-mail/i }), "orga@example.fr");
    await user.type(screen.getByLabelText(/mot de passe/i), "mauvais-secret");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/connexion impossible/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/invalid login credentials|orga@example\.fr/i);
  });

  it("vérifie admin_users puis affiche les cinq espaces pour une session admin", async () => {
    const fake = makeAdminClient({ session: { user: { id: "admin-1" } } });
    renderAdmin(fake.client);

    const navigation = await screen.findByRole("navigation", { name: /administration/i });
    expect(fake.spies.from).toHaveBeenCalledWith("admin_users");
    expect(fake.spies.select).toHaveBeenCalledWith("user_id");
    expect(fake.spies.eq).toHaveBeenCalledWith("user_id", "admin-1");
    expect(fake.spies.maybeSingle).toHaveBeenCalledOnce();
    for (const label of ["Événement", "Équipes et scores", "Participants", "Défis", "Quiz"]) {
      expect(navigation).toContainElement(screen.getByRole("link", { name: label }));
    }
    expect(screen.queryByRole("navigation", { name: /navigation principale/i })).not.toBeInTheDocument();
  });

  it.each([
    ["/admin/evenement", /paramètres de l’événement/i],
    ["/admin/equipes", /équipes et scores/i],
    ["/admin/participants", /gestion des participants/i],
  ])("rend le véritable éditeur de la section %s", async (path, heading) => {
    const fake = makeAdminClient({ session: { user: { id: "admin-1" } } });
    renderAdmin(fake.client, path);

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /tableau de bord/i })).not.toBeInTheDocument();
  });

  it("déconnecte immédiatement un compte authentifié absent de admin_users", async () => {
    const fake = makeAdminClient({ session: { user: { id: "intrus-1" } }, isAdmin: false });
    renderAdmin(fake.client);

    await waitFor(() => expect(fake.spies.signOut).toHaveBeenCalledOnce());
    expect(await screen.findByRole("alert")).toHaveTextContent(/accès administrateur impossible/i);
    expect(screen.getByRole("button", { name: /se connecter/i })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /administration/i })).not.toBeInTheDocument();
  });

  it("réagit aux changements de session et désabonne l'écoute au démontage", async () => {
    const fake = makeAdminClient();
    const view = renderAdmin(fake.client);
    expect(await screen.findByRole("button", { name: /se connecter/i })).toBeInTheDocument();

    await act(async () => fake.emitAuth("SIGNED_IN", { user: { id: "admin-1" } }));
    expect(await screen.findByRole("navigation", { name: /administration/i })).toBeInTheDocument();

    view.unmount();
    expect(fake.spies.onAuthStateChange).toHaveBeenCalledOnce();
    expect(fake.spies.unsubscribe).toHaveBeenCalledOnce();
  });

  it("permet à l'organisateur de se déconnecter", async () => {
    const user = userEvent.setup();
    const fake = makeAdminClient({ session: { user: { id: "admin-1" } } });
    renderAdmin(fake.client);

    await user.click(await screen.findByRole("button", { name: /se déconnecter/i }));
    expect(fake.spies.signOut).toHaveBeenCalledOnce();
  });

  it("conserve la session et affiche une erreur générique si Supabase refuse la déconnexion", async () => {
    const user = userEvent.setup();
    const pending = deferred<{ error: { message: string } }>();
    const fake = makeAdminClient({ session: { user: { id: "admin-1" } } });
    fake.spies.signOut.mockReturnValueOnce(pending.promise);
    renderAdmin(fake.client);

    await user.click(await screen.findByRole("button", { name: /se déconnecter/i }));

    expect(screen.getByRole("button", { name: /déconnexion en cours/i })).toBeDisabled();
    expect(screen.getByRole("navigation", { name: /administration/i })).toBeInTheDocument();

    await act(async () => pending.resolve({ error: { message: "Network request failed for admin-1" } }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/déconnexion impossible/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/network request failed|admin-1/i);
    expect(screen.getByRole("navigation", { name: /administration/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /se déconnecter/i })).toBeEnabled();
  });

  it("revérifie silencieusement un jeton rafraîchi sans démonter l'interface admin", async () => {
    const refreshedLookup = deferred<{ data: { user_id: string }; error: null }>();
    const fake = makeAdminClient({ session: { user: { id: "admin-1" } } });
    renderAdmin(fake.client);

    const navigation = await screen.findByRole("navigation", { name: /administration/i });
    fake.spies.maybeSingle.mockReturnValueOnce(refreshedLookup.promise);

    act(() => fake.emitAuth("TOKEN_REFRESHED", { user: { id: "admin-1" } }));

    expect(screen.getByRole("navigation", { name: /administration/i })).toBe(navigation);
    expect(screen.queryByRole("status", { name: /vérification de l’accès administrateur/i })).not.toBeInTheDocument();

    await act(async () => refreshedLookup.resolve({ data: { user_id: "admin-1" }, error: null }));
    expect(screen.getByRole("navigation", { name: /administration/i })).toBe(navigation);
    expect(fake.spies.maybeSingle).toHaveBeenCalledTimes(2);
  });

  it("ignore une résolution getSession issue d'un effet remplacé", async () => {
    const staleSession = deferred<{ data: { session: null }; error: null }>();
    const activeLookup = deferred<{ data: { user_id: string }; error: null }>();
    const stale = makeAdminClient();
    stale.spies.getSession.mockReturnValueOnce(staleSession.promise);
    const active = makeAdminClient({ session: { user: { id: "admin-1" } } });
    active.spies.maybeSingle.mockReturnValueOnce(activeLookup.promise);

    const view = renderAdmin(stale.client);
    view.rerender(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminApp auth={active.client} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(active.spies.maybeSingle).toHaveBeenCalledOnce());

    await act(async () => staleSession.resolve({ data: { session: null }, error: null }));
    await act(async () => activeLookup.resolve({ data: { user_id: "admin-1" }, error: null }));

    expect(await screen.findByRole("navigation", { name: /administration/i })).toBeInTheDocument();
    expect(active.spies.signOut).not.toHaveBeenCalled();
  });
});
