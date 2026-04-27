import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Subscription, Newsletter, Article } from "@shared/schema";
import {
  X, Zap, Settings, FileText, ChevronDown, ChevronUp,
  Download, CheckCircle2, Building2, Newspaper,
  Send
} from "lucide-react";

const VALID_COMPANIES = [
  // Global majors
  { name: "Visa",           logo: "https://logo.clearbit.com/visa.com" },
  { name: "Mastercard",     logo: "https://logo.clearbit.com/mastercard.com" },
  { name: "PayPal",         logo: "https://logo.clearbit.com/paypal.com" },
  { name: "Stripe",         logo: "https://logo.clearbit.com/stripe.com" },
  { name: "American Express", logo: "https://logo.clearbit.com/americanexpress.com" },
  { name: "Discover",       logo: "https://logo.clearbit.com/discover.com" },
  // Indian fintech
  { name: "Razorpay",       logo: "https://logo.clearbit.com/razorpay.com" },
  { name: "Paytm",          logo: "https://logo.clearbit.com/paytm.com" },
  { name: "PhonePe",        logo: "https://logo.clearbit.com/phonepe.com" },
  { name: "BharatPe",       logo: "https://logo.clearbit.com/bharatpe.com" },
  { name: "Cashfree",       logo: "https://logo.clearbit.com/cashfree.com" },
  { name: "Juspay",         logo: "https://logo.clearbit.com/juspay.in" },
  { name: "Pine Labs",      logo: "https://logo.clearbit.com/pinelabs.com" },
  { name: "BillDesk",       logo: "https://logo.clearbit.com/billdesk.com" },
  { name: "CCAvenue",       logo: "https://logo.clearbit.com/ccavenue.com" },
  { name: "MobiKwik",       logo: "https://logo.clearbit.com/mobikwik.com" },
  { name: "Zaggle",         logo: "https://logo.clearbit.com/zaggle.in" },
  { name: "Setu",           logo: "https://logo.clearbit.com/setu.co" },
  { name: "Open",           logo: "https://logo.clearbit.com/open.money" },
  { name: "Perfios",        logo: "https://logo.clearbit.com/perfios.com" },
  // Indian banks active in payments
  { name: "HDFC Bank",      logo: "https://logo.clearbit.com/hdfcbank.com" },
  { name: "ICICI Bank",     logo: "https://logo.clearbit.com/icicibank.com" },
  { name: "Axis Bank",      logo: "https://logo.clearbit.com/axisbank.com" },
  { name: "Kotak Mahindra", logo: "https://logo.clearbit.com/kotak.com" },
  { name: "SBI",            logo: "https://logo.clearbit.com/sbi.co.in" },
  // Infrastructure & networks
  { name: "NPCI",           logo: "https://logo.clearbit.com/npci.org.in" },
  { name: "RuPay",          logo: "https://logo.clearbit.com/rupay.co.in" },
  { name: "Adyen",          logo: "https://logo.clearbit.com/adyen.com" },
  { name: "Worldline",      logo: "https://logo.clearbit.com/worldline.com" },
  { name: "FIS",            logo: "https://logo.clearbit.com/fisglobal.com" },
  { name: "Fiserv",         logo: "https://logo.clearbit.com/fiserv.com" },
];

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<"home" | "archive">("home");
  const preferencesRef = useRef<HTMLDivElement>(null);
  const globeCanvasRef = useRef<HTMLCanvasElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  //added ghost auto-complete feature
  const [ghostSuggestion, setGhostSuggestion] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      console.log("Auth skipped (dev mode)");
    }
  }, [authLoading, user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const gCanvas = globeCanvasRef.current;
    const pCanvas = particleCanvasRef.current;
    if (!gCanvas || !pCanvas) return;
    const gCtx = gCanvas.getContext('2d');
    const pCtx = pCanvas.getContext('2d');
    if (!gCtx || !pCtx) return;

    const isMobile = window.innerWidth < 640;
    const S = isMobile ? 280 : 480;
    gCanvas.width = S;
    gCanvas.height = S;
    const cx = S / 2, cy = S / 2;
    const R = S * 0.38;

    const syncParticleSize = () => {
      const rect = pCanvas.parentElement?.getBoundingClientRect();
      if (rect) { pCanvas.width = rect.width; pCanvas.height = rect.height; }
    };
    syncParticleSize();

    type Particle = { x: number; y: number; size: number; opacity: number; speed: number; phase: number; phaseSpeed: number };
    const buildParticles = (): Particle[] => Array.from({ length: 80 }, () => ({
      x: Math.random() * pCanvas.width,
      y: Math.random() * pCanvas.height,
      size: Math.random() + 0.5,
      opacity: Math.random() * 0.4 + 0.3,
      speed: Math.random() * 0.3 + 0.1,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: Math.random() * 0.02 + 0.005,
    }));
    let particles = buildParticles();

    const rings = [
      { tilt: 0,                    pulse: 0,              speed: 0.008 },
      { tilt: 35 * Math.PI / 180,   pulse: Math.PI * 0.7,  speed: 0.006 },
      { tilt: 70 * Math.PI / 180,   pulse: Math.PI * 1.4,  speed: 0.010 },
    ];

    type Spark = { x: number; y: number; t0: number };
    const sparks: Spark[] = [];
    let lastSpark = 0;
    let rotation = 0;

    const drawGlobe = (t: number) => {
      gCtx.clearRect(0, 0, S, S);

      gCtx.save();
      gCtx.shadowBlur = 40;
      gCtx.shadowColor = 'rgba(30,100,255,0.4)';
      gCtx.strokeStyle = 'rgba(30,100,255,0.3)';
      gCtx.lineWidth = 2;
      gCtx.beginPath();
      gCtx.arc(cx, cy, R + 10, 0, Math.PI * 2);
      gCtx.stroke();
      gCtx.shadowBlur = 0;
      gCtx.restore();

      const sg = gCtx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
      sg.addColorStop(0, 'rgba(20,80,180,0.9)');
      sg.addColorStop(1, 'rgba(5,20,80,0.95)');
      gCtx.beginPath();
      gCtx.arc(cx, cy, R, 0, Math.PI * 2);
      gCtx.fillStyle = sg;
      gCtx.fill();

      gCtx.save();
      gCtx.beginPath();
      gCtx.arc(cx, cy, R, 0, Math.PI * 2);
      gCtx.clip();
      gCtx.strokeStyle = 'rgba(80,160,255,0.25)';
      gCtx.lineWidth = 0.8;

      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + rotation;
        const rx = Math.abs(Math.cos(a)) * R;
        if (rx < 1) continue;
        gCtx.beginPath();
        gCtx.ellipse(cx, cy, rx, R, 0, 0, Math.PI * 2);
        gCtx.stroke();
      }

      for (let j = 1; j < 8; j++) {
        const phi = (j / 8) * Math.PI;
        const ly = cy + Math.cos(phi) * R;
        const lr = Math.sin(phi) * R;
        gCtx.beginPath();
        gCtx.ellipse(cx, ly, lr, lr * 0.15, 0, 0, Math.PI * 2);
        gCtx.stroke();
      }
      gCtx.restore();

      rings.forEach((ring) => {
        gCtx.save();
        gCtx.translate(cx, cy);
        gCtx.rotate(ring.tilt);
        const rOuter = R * 1.35;
        const rInner = rOuter * 0.25;

        gCtx.strokeStyle = 'rgba(100,200,255,0.15)';
        gCtx.lineWidth = 1.5;
        gCtx.beginPath();
        gCtx.ellipse(0, 0, rOuter, rInner, 0, 0, Math.PI * 2);
        gCtx.stroke();

        const TAIL = 8;
        for (let ti = TAIL; ti >= 0; ti--) {
          const a = ring.pulse - ti * 0.07;
          const px = Math.cos(a) * rOuter;
          const py = Math.sin(a) * rInner;
          const isHead = ti === 0;
          const opacity = isHead ? 1 : ((TAIL - ti) / TAIL) * 0.8;
          const size = isHead ? 4 : Math.max(0.5, 3 - (ti / TAIL) * 2.5);
          if (isHead) { gCtx.shadowBlur = 20; gCtx.shadowColor = '#00d4ff'; }
          gCtx.beginPath();
          gCtx.arc(px, py, size, 0, Math.PI * 2);
          gCtx.fillStyle = `rgba(0,212,255,${opacity})`;
          gCtx.fill();
          if (isHead) { gCtx.shadowBlur = 0; gCtx.shadowColor = 'transparent'; }
        }
        gCtx.restore();
      });

      sparks.forEach((spark, idx) => {
        const age = t - spark.t0;
        const dur = 600;
        if (age > dur) { sparks.splice(idx, 1); return; }
        const prog = age / dur;
        const sr = prog * 30;
        const so = 1 - prog;
        gCtx.save();
        gCtx.globalAlpha = so;
        gCtx.strokeStyle = 'rgba(255,220,100,0.8)';
        gCtx.lineWidth = 1.5;
        gCtx.shadowBlur = 10;
        gCtx.shadowColor = 'rgba(255,220,100,0.8)';
        gCtx.beginPath();
        gCtx.arc(cx + spark.x, cy + spark.y, sr, 0, Math.PI * 2);
        gCtx.stroke();
        gCtx.shadowBlur = 0;
        gCtx.restore();
      });
    };

    const drawParticles = (_t: number) => {
      pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
      particles.forEach(p => {
        p.y -= p.speed;
        p.phase += p.phaseSpeed;
        if (p.y < -2) p.y = pCanvas.height + 2;
        const twinkle = 0.5 + 0.5 * Math.sin(p.phase);
        const op = p.opacity * (0.6 + 0.4 * twinkle);
        pCtx.beginPath();
        pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        pCtx.fillStyle = `rgba(255,255,255,${op})`;
        pCtx.fill();
      });
    };

    let animId: number;
    const animate = (t: number) => {
      rotation += 0.003;
      rings.forEach(r => { r.pulse += r.speed; });

      if (t - lastSpark > 2000 + Math.random() * 1000) {
        const rIdx = Math.floor(Math.random() * 3);
        const sAngle = Math.random() * Math.PI * 2;
        const rOuter = R * 1.35;
        const rInner = rOuter * 0.25;
        const sx = Math.cos(sAngle) * rOuter - cx;
        const sy = Math.sin(sAngle + rings[rIdx].tilt) * rInner - cy;
        sparks.push({ x: sx, y: sy, t0: t });
        lastSpark = t;
      }

      drawParticles(t);
      drawGlobe(t);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  const { data: subscription } = useQuery<Subscription | null>({
    queryKey: ["subscriptions"],
    enabled: !!user,
    retry: false,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await fetch("/api/subscriptions", { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch subscription");
      return res.json();
    },
  });

  const { data: newsletters = [], isLoading: newslettersLoading } = useQuery<Newsletter[]>({
    queryKey: ["newsletters"],
    enabled: !!user,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await fetch("/api/newsletters", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch newsletters");
      return res.json();
    },
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
      queryClient.setQueryData(["subscriptions"], data);
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      toast({ title: "Preferences saved", description: subscription ? "Your companies have been updated." : "You'll receive your first newsletter at 9:00 AM IST tomorrow." });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) { setTimeout(() => { window.location.href = "/api/login"; }, 500); return; }
      toast({ title: "Error", description: error.message || "Failed to save preferences", variant: "destructive" });
    },
  });

const triggerMutation = useMutation({
  mutationFn: async () => {
    // ✅ Always refetch latest subscription before triggering
    await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    await queryClient.refetchQueries({ queryKey: ["subscriptions"] });

    const res = await fetch("/api/admin/trigger-newsletters", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), credentials: "include",
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res;
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
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

  return (
    <div className="pc-root">

      <header className="pc-header">
        <canvas
          ref={particleCanvasRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
        />
        <canvas
          ref={globeCanvasRef}
          style={{
            position: "absolute",
            right: "5%",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            zIndex: 1,
            opacity: 0.92,
          }}
        />
        <div className="pc-header-inner" style={{ position: "relative", zIndex: 2 }}>

          <div className="pc-header-row1">
            <div className="pc-header-top-row">
              <div style={{ width: 36, height: 36, background: "rgba(255,255,255,0.20)", border: "1px solid rgba(255,255,255,0.40)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Newspaper size={18} color="#ffffff" />
              </div>

              <nav className="hidden sm:flex">
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

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="pc-user-name" style={{ color: "#ffffff", fontWeight: 600 }} data-testid="text-username">
                  {user?.firstName || user?.email?.split('@')[0]}
                </span>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
                <button className="pc-logout-btn" onClick={() => window.location.href = '/api/logout'} data-testid="button-logout" style={{ color: "#93c5fd", fontWeight: 500 }}>
                  <span>Log out</span>
                </button>
              </div>
            </div>

            <div className="pc-header-brand-row">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div>
                  <div className="pc-brand-name">Payment Chronicle</div>
                  <div className="pc-brand-sub">BY GAJANAN PUJARI</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pc-header-row2">
            <div>
              <div className="pc-header-eyebrow">Good to see you</div>
              <div className="pc-header-welcome-title">
                Welcome back, {user?.firstName || user?.email?.split('@')[0] || 'there'}
              </div>
              <div className="pc-header-welcome-sub">
                Your personalised payments industry briefing, powered by AI.
              </div>
            </div>
            <div className="pc-header-pills">
              <div className="pc-header-pill">
                <span className="pc-header-pill-dot" />
                {subscription ? "Subscription Active" : "Not subscribed"}
              </div>
              <div className="pc-header-pill">
                <span className="pc-header-pill-dot-blue" />
                Next delivery: 9:00 AM IST
              </div>
            </div>
          </div>

        </div>
      </header>

      <div className="pc-mobile-nav sm:hidden">
        <button className={`pc-mobile-nav-btn${activeView === "home" ? " active" : ""}`} onClick={() => setActiveView("home")}>Home</button>
        <button className={`pc-mobile-nav-btn${activeView === "archive" ? " active" : ""}`} onClick={() => setActiveView("archive")}>Archive</button>
      </div>

      <main className="pc-main">

        {activeView === "home" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div className="animate-float" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24, animationDelay: "0ms" }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 24 }} className="grid-responsive">

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
                        <div style={{ position: "relative", display: "flex", alignItems: "center", flex: 1 }}>
                            {/* Ghost suggestion shown behind the real input */}
                            {ghostSuggestion && companySearch.length > 0 && (
                              <span style={{
                                position: "absolute",
                                left: 0,
                                top: "50%",
                                transform: "translateY(-50%)",
                                pointerEvents: "none",
                                whiteSpace: "nowrap",
                                fontSize: 14,
                                fontFamily: "inherit",
                              }}>
                                {/* Typed part — invisible (matches input text) */}
                                <span style={{ color: "transparent" }}>{companySearch}</span>
                                {/* Ghost part — visible in light grey */}
                                <span style={{ color: "#BBBBBB" }}>
                                  {ghostSuggestion.slice(companySearch.length)}
                                </span>
                              </span>
                            )}
                                <input
                                type="text"
                                className="pc-company-input"
                                value={companySearch}
                                style={{ background: "transparent", position: "relative", zIndex: 1 }}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCompanySearch(val);
                                  setDropdownOpen(true);
                                  setCompanyError(null);
                                  // Ghost suggestion: find first company that starts with typed text
                                  if (val.length > 0) {
                                    const match = VALID_COMPANIES.find(
                                      c => c.name.toLowerCase().startsWith(val.toLowerCase()) &&
                                          !selectedCompanies.includes(c.name)
                                    );
                                    setGhostSuggestion(match ? match.name : "");
                                  } else {
                                    setGhostSuggestion("");
                                  }
                                }}
                                
                                onFocus={() => setDropdownOpen(true)}
                                onKeyDown={e => {
                                if (e.key === "Tab" && ghostSuggestion) {
                                  e.preventDefault();
                                  if (selectedCompanies.length < 3) {
                                    setSelectedCompanies(prev => [...prev, ghostSuggestion]);
                                    setCompanySearch("");
                                    setGhostSuggestion("");
                                    setDropdownOpen(false);
                                  }
                                }
                              }}
                                placeholder={selectedCompanies.length === 0 ? "Search Razorpay, PhonePe, Visa… (Tab to select)" : ""}
                                disabled={selectedCompanies.length >= 3 || subscribeMutation.isPending}
                                data-testid="input-company-search"
                            />
                          </div>
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
                          ? <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.30)", borderTopColor: "#ffffff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />{subscription ? "Updating…" : "Subscribing…"}</>
                          : <><Settings size={14} />{subscription ? "Update Preferences" : "Start My Newsletter"}</>
                        }
                      </button>
                    </div>
                  </form>
                </div>

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
                          ? <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.30)", borderTopColor: "#ffffff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
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
          </div>
        )}

        {activeView === "archive" && (
          <div className="animate-float" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
                <div style={{ width: 64, height: 64, background: "rgba(241,245,249,0.90)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "1px solid var(--pc-border)" }}>
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

function ArchiveCard({ newsletter }: { newsletter: Newsletter }) {
  const [expanded, setExpanded] = useState(false);
  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ["articles", newsletter.id],
    enabled: expanded,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await fetch(`/api/newsletters/${newsletter.id}/articles`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch articles");
      return res.json();
    },
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