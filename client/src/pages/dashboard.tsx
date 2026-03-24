import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Subscription, Newsletter, Article } from "@shared/schema";
import {
  X, Zap, Settings, FileText, ChevronDown, ChevronUp,
  Download, Clock, CheckCircle2, Building2, Newspaper,
  LogOut, User, Send
} from "lucide-react";

const VALID_COMPANIES = [
  { name: "Visa", logo: "https://logo.clearbit.com/visa.com" },
  { name: "PayPal", logo: "https://logo.clearbit.com/paypal.com" },
  { name: "Discover", logo: "https://logo.clearbit.com/discover.com" },
] as const;

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<"home" | "archive">("home");
  const preferencesRef = useRef<HTMLDivElement>(null);

  // Company multi-select state
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [user, authLoading, toast]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: subscription } = useQuery<Subscription | null>({
    queryKey: ["/api/subscriptions"],
    enabled: !!user,
    retry: false,
    queryFn: async () => {
      try {
        const res = await fetch("/api/subscriptions", { credentials: "include" });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("Failed to fetch subscription");
        return res.json();
      } catch (e) {
        if (e instanceof Error && e.message.includes("404")) return null;
        throw e;
      }
    },
  });

  const { data: newsletters = [], isLoading: newslettersLoading } = useQuery<Newsletter[]>({
    queryKey: ["/api/newsletters"],
    enabled: !!user,
  });

  useEffect(() => {
    if (subscription) {
      setSelectedCompanies(subscription.companies.split(',').map(c => c.trim()).filter(Boolean));
    }
  }, [subscription]);

  const filteredCompanies = VALID_COMPANIES.filter(
    c => c.name.toLowerCase().includes(companySearch.toLowerCase()) && !selectedCompanies.includes(c.name)
  );
  const searchMatchesNothing = companySearch.length > 0 && filteredCompanies.length === 0;

  const removeCompany = (name: string) => {
    setSelectedCompanies(prev => prev.filter(c => c !== name));
    setCompanyError(null);
  };

  const subscribeMutation = useMutation({
    mutationFn: async (data: { companies: string }) => {
      const method = subscription ? "PUT" : "POST";
      const res = await apiRequest(method, "/api/subscriptions", data);
      return await res.json() as Subscription;
    },
    onSuccess: (data: Subscription) => {
      queryClient.setQueryData(["/api/subscriptions"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({ title: "Preferences saved", description: subscription ? "Your companies have been updated." : "You'll receive your first newsletter at 9:00 AM IST tomorrow." });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message || "Failed to save preferences", variant: "destructive" });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/trigger-newsletters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: "Generating newsletter", description: `Your newsletter is being prepared. Check ${user?.email} in a few minutes.` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate", description: error.message, variant: "destructive" });
    },
  });

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    if (companySearch.length > 0 && !VALID_COMPANIES.find(c => c.name.toLowerCase() === companySearch.toLowerCase())) {
      setCompanyError("Invalid company — please select from the list");
      return;
    }
    if (selectedCompanies.length === 0) {
      toast({ title: "Select at least one company", variant: "destructive" });
      return;
    }
    subscribeMutation.mutate({ companies: selectedCompanies.join(", ") });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const recentNewsletters = newsletters.slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Newspaper className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">Payment Chronicle</span>
          </div>

          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => setActiveView("home")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === "home"
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              data-testid="nav-home"
            >
              Home
            </button>
            <button
              onClick={() => setActiveView("archive")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === "archive"
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              data-testid="nav-archive"
            >
              Newsletter Archive
              {newsletters.length > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-600 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  {newsletters.length}
                </span>
              )}
            </button>
          </nav>

          {/* User */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2">
              {user?.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
              )}
              <span className="text-sm font-medium text-slate-700" data-testid="text-username">
                {user?.firstName || user?.email?.split('@')[0]}
              </span>
            </div>
            <button
              onClick={() => window.location.href = '/api/logout'}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
              data-testid="button-logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden flex border-t border-slate-100">
          <button
            onClick={() => setActiveView("home")}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeView === "home" ? "text-blue-600 bg-blue-50" : "text-slate-500"}`}
          >Home</button>
          <button
            onClick={() => setActiveView("archive")}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeView === "archive" ? "text-blue-600 bg-blue-50" : "text-slate-500"}`}
          >Archive</button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">

        {activeView === "home" && (
          <div className="space-y-6">

            {/* Welcome Card */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 sm:p-8 text-white shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-blue-200 text-sm font-medium mb-1">Good to see you</p>
                  <h1 className="text-2xl sm:text-3xl font-bold">
                    Welcome back, {user?.firstName || user?.email?.split('@')[0] || 'there'} 
                  </h1>
                  <p className="text-blue-100 mt-2 text-sm">
                    Your personalised payments industry briefing, powered by AI.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  {subscription ? (
                    <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3">
                      <CheckCircle2 className="w-4 h-4 text-green-300 shrink-0" />
                      <div>
                        <p className="text-xs text-blue-100 font-medium">Subscription</p>
                        <p className="text-sm font-semibold">Active</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-white/15 rounded-xl px-4 py-3">
                      <Clock className="w-4 h-4 text-blue-200 shrink-0" />
                      <div>
                        <p className="text-xs text-blue-100">No subscription yet</p>
                        <p className="text-sm font-semibold">Set up below</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-white/15 rounded-xl px-4 py-3">
                    <Clock className="w-4 h-4 text-blue-200 shrink-0" />
                    <div>
                      <p className="text-xs text-blue-100 font-medium">Next delivery</p>
                      <p className="text-sm font-semibold">9:00 AM IST daily</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid: Company Preferences + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Company Preferences */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6" ref={preferencesRef}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Building2 className="w-4.5 h-4.5 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Company Preferences</h2>
                    <p className="text-xs text-slate-500">Choose up to 3 companies to track</p>
                  </div>
                </div>

                <form onSubmit={handleSavePreferences} className="space-y-4">
                  {/* Multi-select */}
                  <div className="relative" ref={dropdownRef}>
                    <div
                      className={`flex flex-wrap gap-1.5 p-2.5 border rounded-xl min-h-11 items-center cursor-text bg-white transition-colors ${
                        companyError || searchMatchesNothing
                          ? "border-red-400 ring-1 ring-red-300"
                          : dropdownOpen ? "border-blue-400 ring-1 ring-blue-200" : "border-slate-200 hover:border-slate-300"
                      }`}
                      onClick={() => setDropdownOpen(true)}
                      data-testid="input-companies"
                    >
                      {selectedCompanies.map(name => {
                        const co = VALID_COMPANIES.find(c => c.name === name);
                        return (
                          <span
                            key={name}
                            className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-sm font-medium"
                            data-testid={`chip-company-${name}`}
                          >
                            {co && (
                              <img src={co.logo} alt={name} className="w-4 h-4 rounded object-contain"
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            )}
                            {name}
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); removeCompany(name); }}
                              className="text-blue-400 hover:text-blue-700 transition-colors ml-0.5"
                              data-testid={`button-remove-${name}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                      <input
                        type="text"
                        value={companySearch}
                        onChange={e => { setCompanySearch(e.target.value); setDropdownOpen(true); setCompanyError(null); }}
                        onFocus={() => setDropdownOpen(true)}
                        placeholder={selectedCompanies.length === 0 ? "Search Visa, PayPal, Discover…" : ""}
                        className="flex-1 min-w-28 outline-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400"
                        disabled={selectedCompanies.length >= 3 || subscribeMutation.isPending}
                        data-testid="input-company-search"
                      />
                    </div>

                    {/* Dropdown */}
                    {dropdownOpen && filteredCompanies.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                        {filteredCompanies.map(co => (
                          <button
                            type="button"
                            key={co.name}
                            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-slate-700 text-left hover:bg-blue-50 hover:text-blue-700 transition-colors"
                            onMouseDown={e => {
                              e.preventDefault();
                              setSelectedCompanies(prev => [...prev, co.name]);
                              setCompanySearch("");
                              setDropdownOpen(false);
                              setCompanyError(null);
                            }}
                            data-testid={`option-company-${co.name}`}
                          >
                            <img src={co.logo} alt={co.name} className="w-5 h-5 rounded object-contain"
                              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            <span className="font-medium">{co.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {(companyError || searchMatchesNothing) && (
                      <p className="text-xs text-red-500 mt-1.5" data-testid="text-company-error">
                        Invalid company — please select from the list
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={subscribeMutation.isPending || selectedCompanies.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                    data-testid="button-save-subscription"
                  >
                    {subscribeMutation.isPending ? (
                      <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />{subscription ? "Updating…" : "Subscribing…"}</>
                    ) : (
                      <><Settings className="w-3.5 h-3.5 mr-2" />{subscription ? "Update Preferences" : "Start My Newsletter"}</>
                    )}
                  </Button>
                </form>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Zap className="w-4.5 h-4.5 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Quick Actions</h2>
                    <p className="text-xs text-slate-500">Run tasks instantly</p>
                  </div>
                </div>

                <button
                  onClick={() => triggerMutation.mutate()}
                  disabled={triggerMutation.isPending || !subscription}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-blue-100 bg-blue-50 hover:bg-blue-100 hover:border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left group"
                  data-testid="button-trigger-newsletter"
                >
                  <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-700 transition-colors">
                    {triggerMutation.isPending
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Send className="w-4 h-4 text-white" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {triggerMutation.isPending ? "Generating…" : "Generate Newsletter"}
                    </p>
                    <p className="text-xs text-slate-500">Send to {user?.email}</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveView("home");
                    setTimeout(() => preferencesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-colors text-left group"
                  data-testid="button-update-preferences"
                >
                  <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                    <Settings className="w-4 h-4 text-slate-600 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Update Preferences</p>
                    <p className="text-xs text-slate-500">Change tracked companies</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveView("archive")}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-colors text-left group"
                  data-testid="button-view-archive"
                >
                  <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                    <FileText className="w-4 h-4 text-slate-600 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">View Archive</p>
                    <p className="text-xs text-slate-500">{newsletters.length} newsletter{newsletters.length !== 1 ? "s" : ""} stored</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Newsletter Timeline */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Clock className="w-4.5 h-4.5 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Recent Newsletters</h2>
                    <p className="text-xs text-slate-500">Your latest briefings</p>
                  </div>
                </div>
                {newsletters.length > 3 && (
                  <button
                    onClick={() => setActiveView("archive")}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View all {newsletters.length} →
                  </button>
                )}
              </div>

              {newslettersLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <Skeleton className="w-3 h-3 rounded-full" />
                        <Skeleton className="w-0.5 h-12 mt-1" />
                      </div>
                      <div className="flex-1 pb-4 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentNewsletters.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Newspaper className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-900">No newsletters yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {subscription ? "Your first newsletter arrives tomorrow at 9:00 AM IST" : "Subscribe to companies above to get started"}
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[5px] top-2 bottom-0 w-px bg-slate-100" />
                  <div className="space-y-0">
                    {recentNewsletters.map((newsletter, idx) => (
                      <TimelineCard key={newsletter.id} newsletter={newsletter} isLast={idx === recentNewsletters.length - 1} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === "archive" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Newsletter Archive</h2>
                <p className="text-sm text-slate-500">All your past briefings in one place</p>
              </div>
              <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-3 py-1.5 rounded-full">
                {newsletters.length} newsletter{newsletters.length !== 1 ? "s" : ""}
              </span>
            </div>

            {newslettersLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))}
              </div>
            ) : newsletters.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-14 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Newspaper className="w-7 h-7 text-slate-400" />
                </div>
                <p className="font-semibold text-slate-900">No newsletters yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  {subscription ? "Your first newsletter arrives tomorrow at 9:00 AM IST" : "Subscribe on the Home tab to start receiving newsletters"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {newsletters.map(newsletter => (
                  <ArchiveCard key={newsletter.id} newsletter={newsletter} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-slate-200 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Payment Chronicle by Gajanan. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Privacy Policy</a>
            <a href="#" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TimelineCard({ newsletter, isLast }: { newsletter: Newsletter; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ["/api/newsletters", newsletter.id, "articles"],
    enabled: expanded,
  });

  const date = new Date(newsletter.generatedAt!);
  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeAgo = formatTimeAgo(date);

  return (
    <div className={`relative flex gap-4 ${isLast ? "" : "pb-5"}`}>
      {/* Dot */}
      <div className="flex flex-col items-center shrink-0 mt-1">
        <div className={`w-2.5 h-2.5 rounded-full border-2 border-white ring-2 z-10 ${newsletter.emailSent ? "bg-green-500 ring-green-200" : "bg-blue-400 ring-blue-200"}`} />
      </div>

      {/* Card */}
      <div className="flex-1 bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-200 hover:shadow-sm rounded-xl p-4 transition-all">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-semibold text-slate-900">{formattedDate}</span>
              <span className="text-xs text-slate-400">{timeAgo}</span>
              {newsletter.emailSent && (
                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-100 rounded-full px-2 py-0.5 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Delivered
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {newsletter.companies.split(',').map((co, i) => {
                const match = VALID_COMPANIES.find(c => c.name.toLowerCase() === co.trim().toLowerCase());
                return (
                  <span key={i} className="flex items-center gap-1 text-xs bg-white border border-slate-200 text-slate-600 rounded-full px-2 py-0.5">
                    {match && <img src={match.logo} alt={match.name} className="w-3 h-3 rounded object-contain"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                    {co.trim()}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex gap-1.5">
            {newsletter.pdfPath && (
              <button
                onClick={() => newsletter.pdfPath && window.open(newsletter.pdfPath, '_blank')}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-200 rounded-lg px-2.5 py-1.5 transition-colors"
                data-testid={`button-download-${newsletter.id}`}
              >
                <Download className="w-3 h-3" /> PDF
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-200 rounded-lg px-2.5 py-1.5 transition-colors"
              data-testid={`button-toggle-${newsletter.id}`}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-200 space-y-4">
            {articles.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2">Loading articles…</p>
            ) : (
              articles.map(article => (
                <div key={article.id} className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800 font-serif">{article.headline}</p>
                  <p className="text-xs text-slate-500 line-clamp-2">{article.summary}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{article.sourceName}</span>
                    <span>·</span>
                    <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Read more →</a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ArchiveCard({ newsletter }: { newsletter: Newsletter }) {
  const [expanded, setExpanded] = useState(false);
  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ["/api/newsletters", newsletter.id, "articles"],
    enabled: expanded,
  });

  const date = new Date(newsletter.generatedAt!);
  const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:border-blue-200 hover:shadow-md transition-all">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-900">{formattedDate}</h3>
              {newsletter.emailSent && (
                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-100 rounded-full px-2 py-0.5 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Delivered
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {newsletter.companies.split(',').map((co, i) => {
                const match = VALID_COMPANIES.find(c => c.name.toLowerCase() === co.trim().toLowerCase());
                return (
                  <span key={i} className="flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 text-slate-600 rounded-full px-2.5 py-1">
                    {match && <img src={match.logo} alt={match.name} className="w-3.5 h-3.5 rounded object-contain"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                    {co.trim()}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {newsletter.pdfPath && (
              <button
                onClick={() => newsletter.pdfPath && window.open(newsletter.pdfPath, '_blank')}
                className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl px-3 py-2 transition-all"
                data-testid={`button-download-${newsletter.id}`}
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl px-3 py-2 transition-all"
              data-testid={`button-toggle-${newsletter.id}`}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
            {articles.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Loading articles…</p>
            ) : (
              articles.map(article => (
                <div key={article.id} className="space-y-1.5">
                  <p className="text-sm font-semibold text-slate-800 font-serif">{article.headline}</p>
                  <p className="text-xs text-slate-500 line-clamp-3">{article.summary}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-medium text-slate-500">{article.sourceName}</span>
                    <span>·</span>
                    <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
                      Read more →
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}
