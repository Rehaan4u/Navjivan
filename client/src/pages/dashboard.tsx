import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Subscription, Newsletter, Article } from "@shared/schema";
import {
  X, Zap, Settings, FileText, ChevronDown, ChevronUp,
  Download, Clock, CheckCircle2, Building2, Newspaper,
  LogOut, User, Send
} from "lucide-react";

const VALID_COMPANIES = [
  { name: "Visa",     logo: "https://logo.clearbit.com/visa.com" },
  { name: "PayPal",   logo: "https://logo.clearbit.com/paypal.com" },
  { name: "Discover", logo: "https://logo.clearbit.com/discover.com" },
] as const;

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<"home" | "archive">("home");
  const preferencesRef = useRef<HTMLDivElement>(null);

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
      if (isUnauthorizedError(error)) { setTimeout(() => { window.location.href = "/api/login"; }, 500); return; }
      toast({ title: "Error", description: error.message || "Failed to save preferences", variant: "destructive" });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/trigger-newsletters", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), credentials: "include",
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
      setCompanyError("Invalid company — please select from the list"); return;
    }
    if (selectedCompanies.length === 0) {
      toast({ title: "Select at least one company", variant: "destructive" }); return;
    }
    subscribeMutation.mutate({ companies: selectedCompanies.join(", ") });
  };

  if (authLoading) {
    return (
      <div className="pc-root" style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "3px solid rgba(201,168,76,0.3)", borderTopColor: "#c9a84c", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--pc-text-muted)", fontSize: 14 }}>Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const recentNewsletters = newsletters.slice(0, 3);

  return (
    <div className="pc-root">

      {/* ── Header ── */}
      <header className="pc-header">
        <div className="pc-header-inner">

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, background: "var(--pc-gold-soft)", border: "1px solid var(--pc-gold-border)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Newspaper size={18} color="var(--pc-gold)" />
            </div>
            <div>
              <div className="pc-brand-name">Payment Chronicle</div>
              <div className="pc-brand-sub">by Gajanan Pujari</div>
            </div>
          </div>

          {/* Nav */}
          <nav className="hidden sm:flex" style={{ alignItems: "center", gap: 0 }}>
            <button
              className={`pc-nav-btn${activeView === "home" ? " active" : ""}`}
              onClick={() => setActiveView("home")}
              data-testid="nav-home"
            >Home</button>
            <button
              className={`pc-nav-btn${activeView === "archive" ? " active" : ""}`}
              onClick={() => setActiveView("archive")}
              data-testid="nav-archive"
            >
              Newsletter Archive
              {newsletters.length > 0 && (
                <span className="pc-nav-badge">{newsletters.length}</span>
              )}
            </button>
          </nav>

          {/* User */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div className="hidden md:flex" style={{ alignItems: "center", gap: 10 }}>
              {user?.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="avatar" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--pc-gold-border)" }} />
              ) : (
                <div className="pc-avatar-ring"><User size={15} color="var(--pc-gold)" /></div>
              )}
              <span className="pc-user-name" data-testid="text-username">
                {user?.firstName || user?.email?.split('@')[0]}
              </span>
            </div>
            <div className="pc-separator hidden md:block" />
            <button className="pc-logout-btn" onClick={() => window.location.href = '/api/logout'} data-testid="button-logout">
              <LogOut size={14} />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <div className="pc-mobile-nav sm:hidden">
        <button className={`pc-mobile-nav-btn${activeView === "home" ? " active" : ""}`} onClick={() => setActiveView("home")}>Home</button>
        <button className={`pc-mobile-nav-btn${activeView === "archive" ? " active" : ""}`} onClick={() => setActiveView("archive")}>Archive</button>
      </div>

      {/* ── Main ── */}
      <main className="pc-main">

        {activeView === "home" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Welcome Banner */}
            <div className="pc-banner">
              <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
                <div>
                  <div className="pc-banner-eyebrow">Good to see you</div>
                  <div className="pc-banner-title">
                    Welcome back, {user?.firstName || user?.email?.split('@')[0] || 'there'}
                  </div>
                  <div className="pc-banner-sub">Your personalised payments industry briefing, powered by AI.</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="pc-banner-stat">
                    <div className="pc-banner-stat-icon"><CheckCircle2 size={18} /></div>
                    <div>
                      <div className="pc-stat-label">Subscription</div>
                      {subscription
                        ? <div className="pc-stat-value"><span className="pc-active-badge">Active</span></div>
                        : <div className="pc-stat-value" style={{ color: "var(--pc-text-muted)" }}>Not set up</div>
                      }
                    </div>
                  </div>
                  <div className="pc-banner-stat">
                    <div className="pc-banner-stat-icon"><Clock size={18} /></div>
                    <div>
                      <div className="pc-stat-label">Next delivery</div>
                      <div className="pc-stat-value">9:00 AM IST daily</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }} className="lg:grid-cols-3-custom">
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 24 }} className="grid-responsive">

                {/* Company Preferences */}
                <div className="pc-card pc-card-inner" ref={preferencesRef} style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 22 }}>
                    <div className="pc-section-icon"><Building2 size={18} /></div>
                    <div>
                      <div className="pc-section-title">Company Preferences</div>
                      <div className="pc-section-desc">Choose up to 3 companies to track</div>
                    </div>
                  </div>

                  <form onSubmit={handleSavePreferences} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ position: "relative" }} ref={dropdownRef}>
                      <div
                        className={`pc-company-input-box${companyError || searchMatchesNothing ? " error" : ""}`}
                        onClick={() => setDropdownOpen(true)}
                        data-testid="input-companies"
                      >
                        {selectedCompanies.map(name => {
                          const co = VALID_COMPANIES.find(c => c.name === name);
                          return (
                            <span key={name} className="pc-chip" data-testid={`chip-company-${name}`}>
                              {co && <img src={co.logo} alt={name} style={{ width: 16, height: 16, borderRadius: 3, objectFit: "contain" }}
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                              {name}
                              <button type="button" className="pc-chip-remove" onClick={ev => { ev.stopPropagation(); removeCompany(name); }} data-testid={`button-remove-${name}`}>
                                <X size={12} />
                              </button>
                            </span>
                          );
                        })}
                        <input
                          type="text"
                          className="pc-company-input"
                          value={companySearch}
                          onChange={e => { setCompanySearch(e.target.value); setDropdownOpen(true); setCompanyError(null); }}
                          onFocus={() => setDropdownOpen(true)}
                          placeholder={selectedCompanies.length === 0 ? "Search Visa, PayPal, Discover…" : ""}
                          disabled={selectedCompanies.length >= 3 || subscribeMutation.isPending}
                          data-testid="input-company-search"
                        />
                      </div>

                      {dropdownOpen && filteredCompanies.length > 0 && (
                        <div className="pc-dropdown">
                          {filteredCompanies.map(co => (
                            <button type="button" key={co.name} className="pc-dropdown-item"
                              onMouseDown={e => { e.preventDefault(); setSelectedCompanies(prev => [...prev, co.name]); setCompanySearch(""); setDropdownOpen(false); setCompanyError(null); }}
                              data-testid={`option-company-${co.name}`}>
                              <img src={co.logo} alt={co.name} style={{ width: 20, height: 20, borderRadius: 4, objectFit: "contain" }}
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              {co.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {(companyError || searchMatchesNothing) && (
                        <div className="pc-error-text" data-testid="text-company-error">
                          Invalid company — please select from the list
                        </div>
                      )}
                    </div>

                    <div>
                      <button type="submit" className="pc-btn-gold" disabled={subscribeMutation.isPending || selectedCompanies.length === 0} data-testid="button-save-subscription">
                        {subscribeMutation.isPending
                          ? <><div style={{ width: 14, height: 14, border: "2px solid rgba(10,15,30,0.3)", borderTopColor: "#0a0f1e", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />{subscription ? "Updating…" : "Subscribing…"}</>
                          : <><Settings size={14} />{subscription ? "Update Preferences" : "Start My Newsletter"}</>
                        }
                      </button>
                    </div>
                  </form>
                </div>

                {/* Quick Actions */}
                <div className="pc-card pc-card-inner" style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 22 }}>
                    <div className="pc-section-icon"><Zap size={18} /></div>
                    <div>
                      <div className="pc-section-title">Quick Actions</div>
                      <div className="pc-section-desc">Run tasks instantly</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button
                      className="pc-action-item"
                      onClick={() => triggerMutation.mutate()}
                      disabled={triggerMutation.isPending || !subscription}
                      data-testid="button-trigger-newsletter"
                    >
                      <div className="pc-action-icon-primary">
                        {triggerMutation.isPending
                          ? <div style={{ width: 16, height: 16, border: "2px solid rgba(10,15,30,0.3)", borderTopColor: "#0a0f1e", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                          : <Send size={16} />
                        }
                      </div>
                      <div>
                        <div className="pc-action-title">{triggerMutation.isPending ? "Generating…" : "Generate Newsletter"}</div>
                        <div className="pc-action-desc">Send to {user?.email?.split('@')[0]}…</div>
                      </div>
                    </button>

                    <button className="pc-action-item" onClick={() => { setActiveView("home"); setTimeout(() => preferencesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); }} data-testid="button-update-preferences">
                      <div className="pc-action-icon"><Settings size={16} /></div>
                      <div>
                        <div className="pc-action-title">Update Preferences</div>
                        <div className="pc-action-desc">Change tracked companies</div>
                      </div>
                    </button>

                    <button className="pc-action-item" onClick={() => setActiveView("archive")} data-testid="button-view-archive">
                      <div className="pc-action-icon"><FileText size={16} /></div>
                      <div>
                        <div className="pc-action-title">View Archive</div>
                        <div className="pc-action-desc">{newsletters.length} newsletter{newsletters.length !== 1 ? "s" : ""}</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Newsletters Timeline */}
            <div className="pc-card pc-card-inner">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div className="pc-section-icon"><Clock size={18} /></div>
                  <div>
                    <div className="pc-section-title">Recent Newsletters</div>
                    <div className="pc-section-desc">Your latest briefings</div>
                  </div>
                </div>
                {newsletters.length > 3 && (
                  <button className="pc-gold-link" onClick={() => setActiveView("archive")}>
                    View all {newsletters.length} →
                  </button>
                )}
              </div>

              {newslettersLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {[1, 2].map(i => (
                    <div key={i} style={{ display: "flex", gap: 16 }}>
                      <div className="pc-skeleton" style={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, marginTop: 4 }} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div className="pc-skeleton" style={{ height: 14, width: 140 }} />
                        <div className="pc-skeleton" style={{ height: 12, width: "100%" }} />
                        <div className="pc-skeleton" style={{ height: 12, width: "70%" }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentNewsletters.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div style={{ width: 56, height: 56, background: "var(--pc-surface-2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                    <Newspaper size={24} color="var(--pc-text-muted)" />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pc-text)", marginBottom: 4 }}>No newsletters yet</div>
                  <div style={{ fontSize: 13, color: "var(--pc-text-muted)" }}>
                    {subscription ? "Your first newsletter arrives tomorrow at 9:00 AM IST" : "Subscribe to companies above to get started"}
                  </div>
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <div className="pc-timeline-line" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {recentNewsletters.map((nl, idx) => (
                      <TimelineCard key={nl.id} newsletter={nl} isLast={idx === recentNewsletters.length - 1} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === "archive" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--pc-text)", fontFamily: "'Playfair Display', serif", marginBottom: 4 }}>Newsletter Archive</div>
                <div style={{ fontSize: 14, color: "var(--pc-text-muted)" }}>All your past briefings in one place</div>
              </div>
              <div style={{ background: "var(--pc-gold-soft)", border: "1px solid var(--pc-gold-border)", color: "var(--pc-gold)", borderRadius: 999, padding: "4px 14px", fontSize: 13, fontWeight: 600 }}>
                {newsletters.length} newsletter{newsletters.length !== 1 ? "s" : ""}
              </div>
            </div>

            {newslettersLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} className="pc-card pc-card-inner" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div className="pc-skeleton" style={{ height: 16, width: 160 }} />
                    <div className="pc-skeleton" style={{ height: 13, width: "100%" }} />
                    <div className="pc-skeleton" style={{ height: 13, width: "60%" }} />
                  </div>
                ))}
              </div>
            ) : newsletters.length === 0 ? (
              <div className="pc-card" style={{ padding: "60px 32px", textAlign: "center" }}>
                <div style={{ width: 64, height: 64, background: "var(--pc-surface-2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Newspaper size={28} color="var(--pc-text-muted)" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--pc-text)", marginBottom: 6 }}>No newsletters yet</div>
                <div style={{ fontSize: 14, color: "var(--pc-text-muted)" }}>
                  {subscription ? "Your first newsletter arrives tomorrow at 9:00 AM IST" : "Subscribe on the Home tab to start receiving newsletters"}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {newsletters.map(nl => <ArchiveCard key={nl.id} newsletter={nl} />)}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="pc-footer">
        <div className="pc-footer-inner">
          <span className="pc-footer-copy">© {new Date().getFullYear()} Payment Chronicle by Gajanan. All rights reserved.</span>
          <div style={{ display: "flex", gap: 20 }}>
            <a href="#" className="pc-footer-link">Privacy Policy</a>
            <a href="#" className="pc-footer-link">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Timeline Card (Recent) ── */
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
    <div style={{ display: "flex", gap: 16, paddingBottom: isLast ? 0 : 16 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div className={newsletter.emailSent ? "pc-timeline-dot-delivered" : "pc-timeline-dot-pending"} />
      </div>
      <div className="pc-timeline-card" style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pc-text)" }}>{formattedDate}</span>
              <span style={{ fontSize: 12, color: "var(--pc-text-muted)" }}>{timeAgo}</span>
              {newsletter.emailSent && (
                <span className="pc-delivered-badge"><CheckCircle2 size={11} /> Delivered</span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {newsletter.companies.split(',').map((co, i) => {
                const match = VALID_COMPANIES.find(c => c.name.toLowerCase() === co.trim().toLowerCase());
                return (
                  <span key={i} className="pc-company-tag">
                    {match && <img src={match.logo} alt={match.name} style={{ width: 14, height: 14, borderRadius: 3, objectFit: "contain" }}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                    {co.trim()}
                  </span>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {newsletter.pdfPath && (
              <button className="pc-icon-btn" onClick={() => newsletter.pdfPath && window.open(newsletter.pdfPath, '_blank')} data-testid={`button-download-${newsletter.id}`}>
                <Download size={12} /> PDF
              </button>
            )}
            <button className="pc-icon-btn" onClick={() => setExpanded(!expanded)} data-testid={`button-toggle-${newsletter.id}`}>
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="pc-article-divider">
            {articles.length === 0
              ? <div style={{ fontSize: 13, color: "var(--pc-text-muted)", textAlign: "center", padding: "8px 0" }}>Loading articles…</div>
              : articles.map(a => (
                <div key={a.id} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pc-text)", fontFamily: "'Lora', serif", marginBottom: 4 }}>{a.headline}</div>
                  <div style={{ fontSize: 13, color: "var(--pc-text-muted)", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 6 }}>{a.summary}</div>
                  <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--pc-text-muted)", alignItems: "center" }}>
                    <span style={{ fontWeight: 500 }}>{a.sourceName}</span>
                    <span>·</span>
                    <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--pc-gold)", textDecoration: "none", transition: "filter 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.2)")}
                      onMouseLeave={e => (e.currentTarget.style.filter = "")}>
                      Read more →
                    </a>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Archive Card ── */
function ArchiveCard({ newsletter }: { newsletter: Newsletter }) {
  const [expanded, setExpanded] = useState(false);
  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ["/api/newsletters", newsletter.id, "articles"],
    enabled: expanded,
  });

  const date = new Date(newsletter.generatedAt!);
  const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="pc-archive-card">
      <div style={{ padding: "20px 28px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--pc-text)" }}>{formattedDate}</span>
              {newsletter.emailSent && <span className="pc-delivered-badge"><CheckCircle2 size={11} /> Delivered</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {newsletter.companies.split(',').map((co, i) => {
                const match = VALID_COMPANIES.find(c => c.name.toLowerCase() === co.trim().toLowerCase());
                return (
                  <span key={i} className="pc-company-tag">
                    {match && <img src={match.logo} alt={match.name} style={{ width: 14, height: 14, borderRadius: 3, objectFit: "contain" }}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                    {co.trim()}
                  </span>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {newsletter.pdfPath && (
              <button className="pc-icon-btn" style={{ fontSize: 13, padding: "8px 14px" }}
                onClick={() => newsletter.pdfPath && window.open(newsletter.pdfPath, '_blank')} data-testid={`button-download-${newsletter.id}`}>
                <Download size={13} /> PDF
              </button>
            )}
            <button className="pc-icon-btn" style={{ fontSize: 13, padding: "8px 14px" }}
              onClick={() => setExpanded(!expanded)} data-testid={`button-toggle-${newsletter.id}`}>
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="pc-article-divider">
            {articles.length === 0
              ? <div style={{ fontSize: 13, color: "var(--pc-text-muted)", textAlign: "center", padding: "10px 0" }}>Loading articles…</div>
              : articles.map(a => (
                <div key={a.id} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pc-text)", fontFamily: "'Lora', serif", marginBottom: 6 }}>{a.headline}</div>
                  <div style={{ fontSize: 13, color: "var(--pc-text-muted)", lineHeight: 1.65, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 8 }}>{a.summary}</div>
                  <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--pc-text-muted)", alignItems: "center" }}>
                    <span style={{ fontWeight: 500, color: "var(--pc-text-muted)" }}>{a.sourceName}</span>
                    <span>·</span>
                    <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--pc-gold)", textDecoration: "none" }}
                      onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.2)")}
                      onMouseLeave={e => (e.currentTarget.style.filter = "")}>
                      Read more →
                    </a>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const h = Math.floor(diffMs / 3600000);
  const d = Math.floor(diffMs / 86400000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}
