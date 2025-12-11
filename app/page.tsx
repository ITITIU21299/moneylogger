"use client";

import { createClient, type User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

type FlowDirection = "incoming" | "topup";

type CashFlow = {
  id: string;
  amount: number;
  direction: FlowDirection;
  event_date: string;
  pack: string | null;
  game: string | null;
  note: string | null;
  created_at: string;
};

type FormState = {
  amount: string;
  date: string;
  pack?: string;
  game?: string;
  note?: string;
};

const DEFAULT_BACKGROUNDS = ["/img/background-1.jpg", "/img/background-2.jpg"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const today = new Date().toISOString().slice(0, 10);

const currency = (value: number) =>
  `${value.toLocaleString("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} VND`;

export default function Home() {
  const [flows, setFlows] = useState<CashFlow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    supabase
      ? null
      : "Missing Supabase config. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
  const [status, setStatus] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<string | null>(null);

  const [incomingForm, setIncomingForm] = useState<FormState>({
    amount: "",
    date: today,
    note: "",
  });

  const [topupForm, setTopupForm] = useState<FormState>({
    amount: "",
    date: today,
    pack: "",
    game: "",
    note: "",
  });

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [backgrounds, setBackgrounds] = useState<string[]>(DEFAULT_BACKGROUNDS);
  const [bgIndex, setBgIndex] = useState(0);
  const [packOptions, setPackOptions] = useState<string[]>([]);
  const [gameOptions, setGameOptions] = useState<string[]>([]);

  useEffect(() => {
    if (packOptions.length && !topupForm.pack) {
      queueMicrotask(() =>
        setTopupForm((p) => ({ ...p, pack: packOptions[0] }))
      );
    }
  }, [packOptions, topupForm.pack]);

  useEffect(() => {
    if (gameOptions.length && !topupForm.game) {
      queueMicrotask(() =>
        setTopupForm((p) => ({ ...p, game: gameOptions[0] }))
      );
    }
  }, [gameOptions, topupForm.game]);

  const summary = useMemo(() => {
    const incoming = flows
      .filter((f) => f.direction === "incoming")
      .reduce((sum, f) => sum + (f.amount || 0), 0);
    const topups = flows
      .filter((f) => f.direction === "topup")
      .reduce((sum, f) => sum + (f.amount || 0), 0);
    return { incoming, topups, balance: incoming - topups };
  }, [flows]);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("cash_flows")
      .select("*")
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setFlows(data || []);
    }
    setLoading(false);
  }, []);

  const loadOptions = useCallback(async () => {
    if (!supabase) return;
    const [{ data: packs }, { data: games }] = await Promise.all([
      supabase
        .from("pack_options")
        .select("name")
        .order("name", { ascending: true }),
      supabase
        .from("game_options")
        .select("name")
        .order("name", { ascending: true }),
    ]);
    if (packs?.length) setPackOptions(packs.map((p) => p.name));
    if (games?.length) setGameOptions(games.map((g) => g.name));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    queueMicrotask(() => {
      void loadData();
      void loadOptions();
    });
  }, [loadData, loadOptions]);

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) setError(error.message);
      setUser(data.session?.user ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      }
    );
    return () => {
      isMounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const maxImagesToCheck = 12;
    async function discoverBackgrounds() {
      const found: string[] = [];
      for (let i = 1; i <= maxImagesToCheck; i++) {
        const res = await fetch(`/img/background-${i}.jpg`, { method: "HEAD" });
        if (res.ok) {
          found.push(`/img/background-${i}.jpg`);
        } else {
          break;
        }
      }
      if (!cancelled && found.length) {
        setBackgrounds(found);
        setBgIndex(0);
      }
    }
    discoverBackgrounds();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (backgrounds.length <= 1) return;
    const id = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % backgrounds.length);
    }, 10000);
    return () => clearInterval(id);
  }, [backgrounds.length]);

  async function handleSignIn() {
    if (!supabase) return;
    setAuthLoading(true);
    setAuthStatus(null);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (error) {
      setError(error.message);
    } else {
      setAuthStatus("Signed in");
      setShowAuth(false);
      void loadData();
    }
    setAuthLoading(false);
  }

  async function handleSignOut() {
    if (!supabase) return;
    setAuthLoading(true);
    setError(null);
    setAuthStatus(null);
    await supabase.auth.signOut();
    setShowAuth(false);
    setAuthLoading(false);
  }

  async function addFlow(direction: FlowDirection, form: FormState) {
    if (!supabase) {
      setError(
        "Missing Supabase config. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      return;
    }
    if (!user) {
      setError("Please sign in to add records.");
      return;
    }
    if (direction === "topup" && (!form.pack || !form.game)) {
      setError("Select pack and game for a top-up.");
      return;
    }
    if (!form.amount) {
      setError("Amount is required.");
      return;
    }
    setLoading(true);
    setError(null);
    setStatus(null);

    const payload = {
      amount: Number(form.amount),
      direction,
      event_date: form.date || today,
      pack: direction === "topup" ? form.pack || null : null,
      game: direction === "topup" ? form.game || null : null,
      note: form.note || null,
    };

    const { error } = await supabase.from("cash_flows").insert(payload);
    if (error) {
      setError(error.message);
    } else {
      setStatus("Saved");
      await loadData();
      if (direction === "incoming") {
        setIncomingForm({ amount: "", date: today, note: "" });
      } else {
        setTopupForm({
          amount: "",
          date: today,
          pack: packOptions[0] ?? "",
          game: gameOptions[0] ?? "",
          note: "",
        });
      }
    }
    setLoading(false);
  }

  const disableEditing = !user;

  const history = [...flows].sort(
    (a, b) =>
      new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="absolute inset-0">
        {backgrounds.map((src, idx) => (
          <div
            key={src}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
              idx === bgIndex ? "opacity-100" : "opacity-0"
            }`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
        <div className="absolute inset-0 bg-white/80 backdrop-blur-none" />
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Total Received
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">
              {currency(summary.incoming)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Total Top-ups
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-600">
              {currency(summary.topups)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Remaining Balance
            </p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                summary.balance >= 0 ? "text-slate-900" : "text-rose-600"
              }`}
            >
              {currency(summary.balance)}
            </p>
          </div>
        </section>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        {authStatus && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {authStatus}
          </div>
        )}
        {status && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {status}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Add incoming money
              </h2>
              {disableEditing && (
                <span className="text-xs text-slate-500">View only</span>
              )}
            </div>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (disableEditing) return;
                addFlow("incoming", incomingForm);
              }}
            >
              <label className="text-sm text-slate-700">
                Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
                  value={incomingForm.amount}
                  onChange={(e) =>
                    setIncomingForm((p) => ({ ...p, amount: e.target.value }))
                  }
                  disabled={disableEditing}
                  required
                />
              </label>
              <label className="text-sm text-slate-700">
                Date
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
                  value={incomingForm.date}
                  onChange={(e) =>
                    setIncomingForm((p) => ({ ...p, date: e.target.value }))
                  }
                  disabled={disableEditing}
                />
              </label>
              <label className="text-sm text-slate-700">
                Note (optional)
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
                  value={incomingForm.note}
                  onChange={(e) =>
                    setIncomingForm((p) => ({ ...p, note: e.target.value }))
                  }
                  disabled={disableEditing}
                />
              </label>
              <button
                type="submit"
                className="mt-2 inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={disableEditing || loading}
              >
                Save incoming
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Add top-up
              </h2>
              {disableEditing && (
                <span className="text-xs text-slate-500">View only</span>
              )}
            </div>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (disableEditing) return;
                addFlow("topup", topupForm);
              }}
            >
              <label className="text-sm text-slate-700">
                Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
                  value={topupForm.amount}
                  onChange={(e) =>
                    setTopupForm((p) => ({ ...p, amount: e.target.value }))
                  }
                  disabled={disableEditing}
                  required
                />
              </label>
              <label className="text-sm text-slate-700">
                Date
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
                  value={topupForm.date}
                  onChange={(e) =>
                    setTopupForm((p) => ({ ...p, date: e.target.value }))
                  }
                  disabled={disableEditing}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-700">
                  Pack
                  <select
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
                    value={topupForm.pack}
                    onChange={(e) =>
                      setTopupForm((p) => ({ ...p, pack: e.target.value }))
                    }
                    disabled={disableEditing}
                  >
                    <option value="">Select pack</option>
                    {packOptions.map((opt) => (
                      <option key={opt}>{opt}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-700">
                  Game
                  <select
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
                    value={topupForm.game}
                    onChange={(e) =>
                      setTopupForm((p) => ({ ...p, game: e.target.value }))
                    }
                    disabled={disableEditing}
                  >
                    <option value="">Select game</option>
                    {gameOptions.map((opt) => (
                      <option key={opt}>{opt}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="text-sm text-slate-700">
                Note (optional)
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
                  value={topupForm.note}
                  onChange={(e) =>
                    setTopupForm((p) => ({ ...p, note: e.target.value }))
                  }
                  disabled={disableEditing}
                />
              </label>

              <button
                type="submit"
                className="mt-2 inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={disableEditing || loading}
              >
                Save top-up
              </button>
            </form>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">History</h2>
            {loading && (
              <span className="text-xs text-slate-500">Refreshing…</span>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-slate-600">No records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Pack</th>
                    <th className="px-3 py-2 font-medium">Game</th>
                    <th className="px-3 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-3 py-2 text-slate-800">
                        {row.event_date}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            row.direction === "incoming"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {row.direction === "incoming" ? "Incoming" : "Top-up"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        {currency(row.amount)}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.pack || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.game || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {row.note || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <button
        className="fixed bottom-4 right-4 z-40 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-slate-800"
        onClick={() => setShowAuth(true)}
      >
        {user ? `Hi, ${user.email}` : "Sign in"}
      </button>

      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Account</h3>
              <button
                className="text-slate-500 transition hover:text-slate-700"
                onClick={() => setShowAuth(false)}
              >
                ✕
              </button>
            </div>

            {user ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  Signed in as <span className="font-medium">{user.email}</span>
                </p>
                <button
                  className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  onClick={handleSignOut}
                  disabled={authLoading}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    onClick={handleSignIn}
                    disabled={authLoading}
                  >
                    Sign in
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
