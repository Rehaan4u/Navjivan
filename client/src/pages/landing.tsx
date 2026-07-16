import { useState, useEffect, useRef } from "react";
import { saveAuth } from "@/lib/auth";

const GOOGLE_CLIENT_ID = "64548102157-matft6q184tjj7jucbodp3ub5s9vdfbj.apps.googleusercontent.com";
// Confirm this is current: aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='navjivan-api'].ApiEndpoint" --output text
const API_BASE = "https://qlprgt28b3.execute-api.ap-south-1.amazonaws.com";

// ── Animated floating node for the network visualization ──
function FloatingNode({ x, y, size, color, delay }: {
  x: number; y: number; size: number; color: string; delay: number;
}) {
  return (
    <div style={{
      position: "absolute",
      left: `${x}%`,
      top: `${y}%`,
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      boxShadow: `0 0 ${size * 2}px ${color}`,
      animation: `floatNode 6s ease-in-out infinite`,
      animationDelay: `${delay}s`,
      pointerEvents: "none",
    }} />
  );
}

// ── Animated news card flying across screen ──
function NewsCard({ title, source, x, y, delay }: {
  title: string; source: string; x: number; y: number; delay: number;
}) {
  return (
    <div style={{
      position: "absolute",
      left: `${x}%`,
      top: `${y}%`,
      background: "rgba(255,255,255,0.06)",
      backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10,
      padding: "10px 14px",
      width: 200,
      animation: `driftCard 12s ease-in-out infinite`,
      animationDelay: `${delay}s`,
      pointerEvents: "none",
      zIndex: 0,
    }}>
      <div style={{
        fontSize: 10, color: "#4C9AFF",
        fontFamily: "sans-serif",
        letterSpacing: "1px",
        textTransform: "uppercase",
        marginBottom: 4,
      }}>{source}</div>
      <div style={{
        fontSize: 12, color: "rgba(255,255,255,0.7)",
        fontFamily: "sans-serif",
        lineHeight: 1.4,
      }}>{title}</div>
    </div>
  );
}

export default function Landing({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [mouseX, setMouseX] = useState(50);
  const [mouseY, setMouseY] = useState(50);
  const [scrollY, setScrollY] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const heroRef = useRef<HTMLDivElement>(null);

  // ── Auth modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const fullText = "Cloud & Technology";

  // ── Typewriter effect ──
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 80);
    return () => clearInterval(interval);
  }, []);

  // ── Cursor blink ──
  useEffect(() => {
    const interval = setInterval(() => setShowCursor(p => !p), 500);
    return () => clearInterval(interval);
  }, []);

  // ── Mouse parallax ──
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMouseX((e.clientX / window.innerWidth) * 100);
      setMouseY((e.clientY / window.innerHeight) * 100);
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  // ── Scroll tracking ──
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ── Initialize Google Identity Services once ──
  useEffect(() => {
    // @ts-ignore
    if (window.google) {
      // @ts-ignore
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: any) => {
          setGoogleToken(response.credential);
          try {
            const payload = JSON.parse(atob(response.credential.split(".")[1]));
            setGoogleEmail(payload.email || null);
          } catch {
            setGoogleEmail(null);
          }
          setAuthError("");
        },
      });
    }
  }, []);

  // ── Render the real Google button into the modal once it's open ──
  useEffect(() => {
    if (modalOpen && googleBtnRef.current) {
      // @ts-ignore
      window.google?.accounts.id.renderButton(googleBtnRef.current, {
        theme: "filled_blue",
        size: "large",
        width: 280,
      });
    }
  }, [modalOpen]);

  function openLoginModal() {
    setAuthError("");
    setModalOpen(true);
  }

  function closeLoginModal() {
    setModalOpen(false);
    setGoogleToken(null);
    setGoogleEmail(null);
    setAccessCode("");
    setAuthError("");
  }

  async function handleVerify() {
    if (!googleToken || !accessCode) {
      setAuthError("Sign in with Google and enter your access code.");
      return;
    }
    setVerifying(true);
    setAuthError("");
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${googleToken}`,
          "x-access-code": accessCode,
        },
      });
      if (!res.ok) throw new Error("Invalid access code or token.");
      saveAuth(googleToken, accessCode);
      setModalOpen(false);
      onLoginSuccess();
    } catch (err: any) {
      setAuthError(err.message || "Login failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  const floatingNodes = [
    { x: 15, y: 20, size: 8,  color: "rgba(76,154,255,0.6)",  delay: 0 },
    { x: 80, y: 15, size: 12, color: "rgba(201,168,76,0.5)",  delay: 1 },
    { x: 90, y: 60, size: 6,  color: "rgba(76,154,255,0.4)",  delay: 2 },
    { x: 10, y: 70, size: 10, color: "rgba(201,168,76,0.4)",  delay: 0.5 },
    { x: 50, y: 85, size: 8,  color: "rgba(76,154,255,0.5)",  delay: 1.5 },
    { x: 70, y: 40, size: 5,  color: "rgba(201,168,76,0.6)",  delay: 3 },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050A18",
      fontFamily: "'Georgia', serif",
      color: "#ffffff",
      overflowX: "hidden",
    }}>

      <style>{`
        @keyframes floatNode {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.6; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 1; }
        }
        @keyframes driftCard {
          0%, 100% { transform: translateY(0px) rotate(-1deg); opacity: 0.6; }
          50% { transform: translateY(-30px) rotate(1deg); opacity: 0.9; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(76,154,255,0.3); }
          50% { box-shadow: 0 0 60px rgba(76,154,255,0.8); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-60px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(60px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalFadeIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .login-btn {
          transition: all 0.25s ease !important;
        }
        .login-btn:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 12px 40px rgba(76,154,255,0.5) !important;
        }
        .feature-card {
          transition: all 0.3s cubic-bezier(0.16,1,0.3,1) !important;
        }
        .feature-card:hover {
          transform: translateY(-8px) !important;
          border-color: rgba(76,154,255,0.4) !important;
          background: rgba(76,154,255,0.08) !important;
        }
        .scroll-reveal {
          opacity: 0;
          transform: translateY(40px);
          transition: all 0.7s cubic-bezier(0.16,1,0.3,1);
        }
        .scroll-reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

      {/* ── Mouse parallax glow ── */}
      <div style={{
        position: "fixed",
        width: 600,
        height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(76,154,255,0.06) 0%, transparent 70%)",
        left: `${mouseX}%`,
        top: `${mouseY}%`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 0,
        transition: "left 0.3s ease, top 0.3s ease",
      }} />

      {/* ── Login Modal ── */}
      {modalOpen && (
        <div
          onClick={closeLoginModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5,10,24,0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0A1226",
              border: "1px solid rgba(76,154,255,0.25)",
              borderRadius: 16,
              padding: "40px 36px",
              width: 340,
              maxWidth: "90vw",
              animation: "modalFadeIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
              fontFamily: "sans-serif",
              position: "relative",
            }}
          >
            <button
              onClick={closeLoginModal}
              style={{
                position: "absolute", top: 16, right: 16,
                background: "none", border: "none",
                color: "rgba(255,255,255,0.4)",
                fontSize: 18, cursor: "pointer",
              }}
            >
              ✕
            </button>

            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: "#fff" }}>
              Sign in to Navjivan
            </h3>

            {/* Real Google button renders into this div */}
            <div ref={googleBtnRef} style={{ display: "flex", justifyContent: "center", marginBottom: 20 }} />

            {googleEmail && (
              <p style={{ fontSize: 12, color: "rgba(76,154,255,0.8)", marginBottom: 16, textAlign: "center" }}>
                Signed in as {googleEmail}
              </p>
            )}

            {googleToken && (
              <div>
                <input
                  type="text"
                  placeholder="Access code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#fff",
                    fontSize: 14,
                    marginBottom: 12,
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="login-btn"
                  style={{
                    width: "100%",
                    background: "linear-gradient(135deg, #1a6fd8, #0052CC)",
                    color: "#fff",
                    border: "1px solid rgba(76,154,255,0.3)",
                    borderRadius: 8,
                    padding: "12px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: verifying ? "default" : "pointer",
                    opacity: verifying ? 0.6 : 1,
                  }}
                >
                  {verifying ? "Verifying..." : "Continue"}
                </button>
              </div>
            )}

            {authError && (
              <p style={{ color: "#ff6b6b", fontSize: 12, marginTop: 12, textAlign: "center" }}>
                {authError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(5,10,24,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(76,154,255,0.15)",
        padding: "0 48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 64,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", width: 40, height: 40 }}>
            <div style={{
              position: "absolute", inset: 0,
              border: "2px solid rgba(76,154,255,0.4)",
              borderRadius: "50%",
              animation: "spin-slow 8s linear infinite",
              borderTopColor: "#4C9AFF",
            }} />
            <div style={{
              position: "absolute", inset: 6,
              border: "1.5px solid rgba(201,168,76,0.4)",
              borderRadius: "50%",
              animation: "spin-reverse 5s linear infinite",
              borderTopColor: "#C9A84C",
            }} />
            <div style={{
              position: "absolute",
              inset: "50%",
              transform: "translate(-50%, -50%)",
              width: 6, height: 6,
              borderRadius: "50%",
              background: "#4C9AFF",
              boxShadow: "0 0 8px #4C9AFF",
            }} />
          </div>

          <div>
            <div style={{
              fontSize: 22, fontWeight: 700,
              background: "linear-gradient(135deg, #4C9AFF, #C9A84C)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "shimmer 4s linear infinite",
              letterSpacing: "0.02em",
            }}>
              Navjivan
            </div>
            <div style={{
              fontSize: 8, letterSpacing: "2.5px",
              color: "rgba(76,154,255,0.5)",
              textTransform: "uppercase",
              fontFamily: "sans-serif",
              marginTop: -2,
            }}>
              Your daily dispatch from the cloud frontier.
            </div>
          </div>
        </div>

        <button
          className="login-btn"
          onClick={openLoginModal}
          style={{
            background: "linear-gradient(135deg, #1a6fd8, #0052CC)",
            color: "#ffffff",
            border: "1px solid rgba(76,154,255,0.3)",
            borderRadius: 8,
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "sans-serif",
            letterSpacing: "0.3px",
          }}
        >
          Sign in with Google
        </button>
      </nav>

      {/* ── Hero ── */}
      <section
        ref={heroRef}
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "92vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "80px 80px",
        }}
      >
        {/* Gandhi image on the right */}
        <div style={{
          position: "absolute",
          right: "-60px",
          top: "38%",
          transform: "translateY(-55%)",
          zIndex: 0,
          pointerEvents: "none",
          width: "58%",
          maxWidth: 740,
        }}>
          <img
            src="/gandhi.png"
            alt="Navjivan — Gandhi with cloud globe"
            style={{
              width: "100%",
              height: "auto",
              opacity: 0.92,
              mixBlendMode: "screen",
            }}
          />
        </div>
        <div style={{
          maxWidth: 580,
          position: "relative",
          animation: "fadeUp 1s cubic-bezier(0.16,1,0.3,1) forwards",
          textAlign: "left",
          zIndex: 2,
        }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: "1px solid rgba(76,154,255,0.3)",
            borderRadius: 999,
            padding: "6px 18px",
            marginBottom: 40,
            fontSize: 11,
            letterSpacing: "2px",
            color: "#4C9AFF",
            textTransform: "uppercase",
            fontFamily: "sans-serif",
            background: "rgba(76,154,255,0.06)",
            backdropFilter: "blur(8px)",
          }}>
            <span style={{
              width: 6, height: 6,
              borderRadius: "50%",
              background: "#4C9AFF",
              boxShadow: "0 0 6px #4C9AFF",
              animation: "glow-pulse 2s infinite",
            }} />
            Founded in the spirit of Gandhi's Navjivan · 1919
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: "clamp(36px, 6vw, 68px)",
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: 20,
            letterSpacing: "-1px",
          }}>
            The morning briefing for
            <br />
            <span style={{
              background: "linear-gradient(135deg, #4C9AFF 0%, #C9A84C 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              {typedText}
              <span style={{
                opacity: showCursor ? 1 : 0,
                WebkitTextFillColor: "#4C9AFF",
                transition: "opacity 0.1s",
              }}>|</span>
            </span>
          </h1>

          {/* Gandhi quote */}
          <p style={{
            fontSize: 17,
            lineHeight: 1.8,
            color: "rgba(255,255,255,0.5)",
            maxWidth: 520,
            margin: "0 0 8px",
            fontStyle: "italic",
          }}>
            "Be the change you wish to see in the world."
          </p>
          <p style={{
            fontSize: 12,
            color: "rgba(201,168,76,0.5)",
            marginBottom: 40,
            fontFamily: "sans-serif",
            letterSpacing: "1px",
          }}>
            — Mahatma Gandhi
          </p>

          <p style={{
            fontSize: 16,
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.5)",
            maxWidth: 480,
            margin: "0 auto 52px",
            fontFamily: "sans-serif",
          }}>
            Track AWS, Google Cloud, and Microsoft Azure.
            AI-curated intelligence every morning at 9:00 AM IST.
          </p>

          {/* CTA */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{
              position: "absolute",
              inset: -6,
              borderRadius: 14,
              background: "rgba(76,154,255,0.2)",
              animation: "pulse-ring 2.5s ease-out infinite",
            }} />
            <button
              className="login-btn"
              onClick={openLoginModal}
              style={{
                position: "relative",
                background: "linear-gradient(135deg, #1a6fd8 0%, #0052CC 100%)",
                color: "#ffffff",
                border: "1px solid rgba(76,154,255,0.4)",
                borderRadius: 10,
                padding: "18px 48px",
                fontSize: 17,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "sans-serif",
                letterSpacing: "0.3px",
                boxShadow: "0 4px 24px rgba(76,154,255,0.3)",
              }}
            >
              Begin Your Journey →
            </button>
          </div>

          <p style={{
            marginTop: 20,
            fontSize: 12,
            color: "rgba(255,255,255,0.25)",
            fontFamily: "sans-serif",
          }}>
            Free · No credit card · Delivered daily at 9:00 AM IST
          </p>

          {/* Stats row */}
          <div style={{
            display: "flex",
            justifyContent: "flex-start",
            gap: 48,
            marginTop: 64,
            flexWrap: "wrap",
          }}>
            {[
              { value: "3", label: "Cloud Platforms" },
              { value: "9AM", label: "Daily Delivery IST" },
              { value: "AI", label: "Powered Summaries" },
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: "center", animation: `countUp 0.6s ease forwards`, animationDelay: `${i * 0.2 + 0.5}s`, opacity: 0 }}>
                <div style={{
                  fontSize: 32, fontWeight: 700,
                  background: "linear-gradient(135deg, #4C9AFF, #C9A84C)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  marginBottom: 4,
                }}>
                  {stat.value}
                </div>
                <div style={{
                  fontSize: 12, color: "rgba(255,255,255,0.4)",
                  fontFamily: "sans-serif",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "100px 48px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{
              fontSize: 11, letterSpacing: "3px",
              color: "#4C9AFF", textTransform: "uppercase",
              fontFamily: "sans-serif", marginBottom: 14,
            }}>
              How It Works
            </div>
            <h2 style={{ fontSize: 40, fontWeight: 700, margin: 0 }}>
              Three steps to stay ahead
            </h2>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
          }}>
            {[
              {
                number: "01",
                emoji: "☁️",
                title: "Select Cloud Platforms",
                desc: "Choose from AWS, Google Cloud, or Microsoft Azure — the three platforms shaping tomorrow's infrastructure.",
                color: "#4C9AFF",
              },
              {
                number: "02",
                emoji: "🤖",
                title: "AI Reads Everything",
                desc: "Our Llama AI scans official blogs, tech publications, and RSS feeds to surface what actually matters.",
                color: "#C9A84C",
              },
              {
                number: "03",
                emoji: "📬",
                title: "Inbox by 9 AM",
                desc: "A narrative briefing with images arrives every morning. Read it in 3 minutes. Know everything.",
                color: "#4C9AFF",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="feature-card"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16,
                  padding: "36px 32px",
                  cursor: "default",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: item.color,
                  letterSpacing: "3px",
                  fontFamily: "sans-serif",
                  marginBottom: 20,
                  opacity: 0.6,
                }}>
                  {item.number}
                </div>
                <div style={{ fontSize: 40, marginBottom: 18 }}>{item.emoji}</div>
                <h3 style={{
                  fontSize: 19, fontWeight: 700,
                  marginBottom: 12,
                  color: "#ffffff",
                }}>
                  {item.title}
                </h3>
                <p style={{
                  fontSize: 14, lineHeight: 1.75,
                  color: "rgba(255,255,255,0.45)",
                  fontFamily: "sans-serif",
                  margin: 0,
                }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live feed preview ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "80px 48px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            fontSize: 11, letterSpacing: "3px",
            color: "#C9A84C", textTransform: "uppercase",
            fontFamily: "sans-serif", marginBottom: 14,
          }}>
            What You'll Receive
          </div>
          <h2 style={{ fontSize: 36, fontWeight: 700, marginBottom: 48 }}>
            Stories like these, every morning
          </h2>

          {[
            {
              headline: "AWS Launches Next-Gen AI Inference Chips for Enterprise",
              summary: "🔷 Deep in the silicon labs of Amazon's hardware division, a quiet revolution is taking shape. AWS has unveiled its latest Trainium2 chips, purpose-built for large language model inference at scale — a move that signals the company's intent to own the full AI stack from cloud to chip.",
              source: "AWS Blog",
              color: "#FF9900",
            },
            {
              headline: "Google Cloud Expands Southeast Asia Presence with 3 New Regions",
              summary: "🌏 The race for cloud dominance in Asia-Pacific is accelerating. Google Cloud's strategic expansion into three new Southeast Asian markets reflects a calculated bet on the region's surging digital economy, positioning the platform to capture enterprise workloads currently dominated by local providers.",
              source: "Google Cloud Blog",
              color: "#4285F4",
            },
          ].map((article, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: "28px 32px",
              marginBottom: 20,
              textAlign: "left",
              animation: `slideIn${i === 0 ? "Left" : "Right"} 0.8s cubic-bezier(0.16,1,0.3,1) forwards`,
              animationDelay: `${i * 0.2}s`,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 12,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: article.color,
                  boxShadow: `0 0 6px ${article.color}`,
                }} />
                <span style={{
                  fontSize: 11, color: article.color,
                  fontFamily: "sans-serif",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}>
                  {article.source}
                </span>
              </div>
              <h4 style={{
                fontSize: 17, fontWeight: 700,
                marginBottom: 12, color: "#ffffff",
                lineHeight: 1.35,
              }}>
                {article.headline}
              </h4>
              <p style={{
                fontSize: 14, lineHeight: 1.75,
                color: "rgba(255,255,255,0.5)",
                fontFamily: "sans-serif",
                margin: 0,
              }}>
                {article.summary}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Gandhi section ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "100px 48px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{
            width: 1, height: 60,
            background: "linear-gradient(to bottom, transparent, #C9A84C)",
            margin: "0 auto 40px",
          }} />
          <blockquote style={{
            fontSize: "clamp(20px, 3vw, 26px)",
            lineHeight: 1.65,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.75)",
            margin: "0 0 20px",
          }}>
            "In a gentle way, you can shake the world."
          </blockquote>
          <p style={{
            fontSize: 12, color: "#C9A84C",
            fontFamily: "sans-serif",
            letterSpacing: "2px",
            textTransform: "uppercase",
            margin: "0 0 36px",
          }}>
            — Mahatma Gandhi, Navjivan, 1919
          </p>
          <p style={{
            fontSize: 15, lineHeight: 1.85,
            color: "rgba(255,255,255,0.38)",
            fontFamily: "sans-serif",
          }}>
            Gandhi freed India from colonial rule. We free you from cloud chaos —
            one morning briefing at a time. AWS, Google Cloud, Azure: distilled
            into three minutes of clarity, delivered before your first coffee.
          </p>
          <div style={{
            width: 1, height: 60,
            background: "linear-gradient(to top, transparent, #C9A84C)",
            margin: "40px auto 0",
          }} />
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "100px 48px",
        textAlign: "center",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontSize: 40, fontWeight: 700, marginBottom: 16 }}>
            Ready for your new life?
          </h2>
          <p style={{
            fontSize: 16, lineHeight: 1.7,
            color: "rgba(255,255,255,0.45)",
            fontFamily: "sans-serif", marginBottom: 48,
          }}>
            Join professionals who start every morning with Navjivan.
          </p>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{
              position: "absolute", inset: -6,
              borderRadius: 14,
              background: "rgba(76,154,255,0.15)",
              animation: "pulse-ring 2.5s ease-out infinite",
            }} />
            <button
              className="login-btn"
              onClick={openLoginModal}
              style={{
                position: "relative",
                background: "linear-gradient(135deg, #1a6fd8, #0052CC)",
                color: "#ffffff",
                border: "1px solid rgba(76,154,255,0.3)",
                borderRadius: 10,
                padding: "18px 48px",
                fontSize: 17,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "sans-serif",
                boxShadow: "0 4px 24px rgba(76,154,255,0.25)",
              }}
            >
              Get Started Free →
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        position: "relative", zIndex: 1,
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "32px 48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
      }}>
        <div style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.2)",
          fontFamily: "sans-serif",
        }}>
          © {new Date().getFullYear()} Navjivan. Inspired by Gandhi's newspaper of 1919.
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {["Privacy Policy", "Terms of Service"].map(link => (
            <a key={link} href="#" style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.2)",
              textDecoration: "none",
              fontFamily: "sans-serif",
            }}>
              {link}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}