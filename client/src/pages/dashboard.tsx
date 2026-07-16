import { useEffect, useState } from "react";
import { authFetch, clearAuth } from "@/lib/auth";

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [newsletters, setNewsletters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [subsRes, newsRes] = await Promise.all([
          authFetch("/subscriptions"),
          authFetch("/newsletters"),
        ]);
        setSubscriptions(await subsRes.json());
        setNewsletters(await newsRes.json());
      } catch (err: any) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleLogout() {
    clearAuth();
    onLogout();
  }

  if (loading) return <div className="p-8 text-center">Loading dashboard...</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <button onClick={handleLogout} className="text-sm underline text-muted-foreground">Log out</button>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <section>
        <h2 className="font-medium mb-2">Subscriptions</h2>
        {subscriptions.map((s) => <div key={s.id} className="text-sm border rounded p-2 mb-1">{JSON.stringify(s)}</div>)}
      </section>
      <section>
        <h2 className="font-medium mb-2">Newsletters</h2>
        {newsletters.map((n) => <div key={n.id} className="text-sm border rounded p-2 mb-1">{JSON.stringify(n)}</div>)}
      </section>
    </div>
  );
}