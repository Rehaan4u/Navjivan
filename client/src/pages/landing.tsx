export default function Landing() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0F1E",
      fontFamily: "'Georgia', serif",
      color: "#ffffff",
      overflowX: "hidden",
    }}>

      {/* ── Animated background particles ── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: Math.random() * 2 + 1,
            height: Math.random() * 2 + 1,
            background: "rgba(255,255,255,0.4)",
            borderRadius: "50%",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `twinkle ${Math.random() * 4 + 2}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 4}s`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        .login-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(201,168,76,0.4);
        }
        .feature-card:hover {
          transform: translateY(-4px);
          border-color: rgba(201,168,76,0.4);
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(10,15,30,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(201,168,76,0.2)",
        padding: "16px 48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Spinning wheel — Gandhi's charkha inspired */}
          <div style={{
            width: 36, height: 36,
            border: "2px solid #C9A84C",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <div style={{
              width: 2, height: 14,
              background: "#C9A84C",
              position: "absolute",
              borderRadius: 2,
            }} />
            <div style={{
              width: 14, height: 2,
              background: "#C9A84C",
              position: "absolute",
              borderRadius: 2,
            }} />
            <div style={{
              width: 6, height: 6,
              background: "#C9A84C",
              borderRadius: "50%",
            }} />
          </div>
          <div>
            <div style={{
              fontSize: 20, fontWeight: 700,
              letterSpacing: "0.05em",
              background: "linear-gradient(135deg, #C9A84C, #F0D080, #C9A84C)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "shimmer 3s linear infinite",
            }}>
              Navjivan
            </div>
            <div style={{
              fontSize: 9, letterSpacing: "2px",
              color: "rgba(201,168,76,0.6)",
              textTransform: "uppercase",
              fontFamily: "sans-serif",
            }}>
              Est. 1919 · Reborn in AI
            </div>
          </div>
        </div>

        <button
          className="login-btn"
          onClick={() => window.location.href = "/api/auth/google"}
          style={{
            background: "linear-gradient(135deg, #C9A84C, #A07830)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 6,
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "sans-serif",
            letterSpacing: "0.5px",
            transition: "all 0.2s ease",
          }}
          data-testid="button-login"
        >
          Sign in with Google
        </button>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        position: "relative",
        zIndex: 1,
        minHeight: "90vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "80px 24px",
        animation: "fadeUp 0.8s ease forwards",
      }}>
        {/* Glow behind hero */}
        <div style={{
          position: "absolute",
          width: 600, height: 600,
          background: "radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)",
          borderRadius: "50%",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }} />

        <div style={{ maxWidth: 760, position: "relative" }}>
          {/* Gandhi quote */}
          <div style={{
            display: "inline-block",
            border: "1px solid rgba(201,168,76,0.3)",
            borderRadius: 2,
            padding: "8px 20px",
            marginBottom: 32,
            fontSize: 12,
            letterSpacing: "2px",
            color: "#C9A84C",
            textTransform: "uppercase",
            fontFamily: "sans-serif",
          }}>
            Founded in the spirit of Mahatma Gandhi's Navjivan · 1919
          </div>

          <h1 style={{
            fontSize: "clamp(40px, 7vw, 72px)",
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: 24,
            letterSpacing: "-1px",
          }}>
            The morning briefing for
            <span style={{
              display: "block",
              background: "linear-gradient(135deg, #C9A84C, #F0D080)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginTop: 8,
            }}>
              Cloud & Technology
            </span>
          </h1>

          <p style={{
            fontSize: 18,
            lineHeight: 1.8,
            color: "rgba(255,255,255,0.6)",
            maxWidth: 560,
            margin: "0 auto 16px",
            fontStyle: "italic",
          }}>
            "Be the change you wish to see in the world."
          </p>
          <p style={{
            fontSize: 13,
            color: "rgba(201,168,76,0.5)",
            marginBottom: 48,
            fontFamily: "sans-serif",
            letterSpacing: "1px",
          }}>
            — Mahatma Gandhi
          </p>

          <p style={{
            fontSize: 16,
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.55)",
            maxWidth: 520,
            margin: "0 auto 48px",
            fontFamily: "sans-serif",
          }}>
            Track AWS, Google Cloud, and Microsoft Azure.
            Receive AI-curated intelligence every morning at 9:00 AM IST.
          </p>

          {/* CTA Button */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{
              position: "absolute",
              inset: -4,
              borderRadius: 10,
              background: "rgba(201,168,76,0.2)",
              animation: "pulse-ring 2s ease-out infinite",
            }} />
            <button
              className="login-btn"
              onClick={() => window.location.href = "/api/auth/google"}
              style={{
                position: "relative",
                background: "linear-gradient(135deg, #C9A84C, #A07830)",
                color: "#0A0F1E",
                border: "none",
                borderRadius: 8,
                padding: "16px 40px",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "sans-serif",
                letterSpacing: "0.5px",
                transition: "all 0.2s ease",
              }}
              data-testid="button-hero-cta"
            >
              Begin Your Journey →
            </button>
          </div>

          <p style={{
            marginTop: 16,
            fontSize: 12,
            color: "rgba(255,255,255,0.3)",
            fontFamily: "sans-serif",
          }}>
            Free · No credit card · Delivered daily at 9:00 AM IST
          </p>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "80px 48px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{
              fontSize: 11, letterSpacing: "3px",
              color: "#C9A84C", textTransform: "uppercase",
              fontFamily: "sans-serif", marginBottom: 12,
            }}>
              How It Works
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 700, margin: 0 }}>
              Three steps to stay ahead
            </h2>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 24,
          }}>
            {[
              {
                number: "01",
                emoji: "☁️",
                title: "Select Cloud Platforms",
                desc: "Choose from AWS, Google Cloud, or Microsoft Azure — the platforms shaping tomorrow's infrastructure.",
              },
              {
                number: "02",
                emoji: "🤖",
                title: "AI Reads Everything",
                desc: "Our AI scans official blogs, tech news, and RSS feeds to find what actually matters to you.",
              },
              {
                number: "03",
                emoji: "📬",
                title: "Inbox by 9 AM",
                desc: "A beautifully written narrative briefing arrives every morning. Read it in 3 minutes. Know everything.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="feature-card"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: "32px 28px",
                  transition: "all 0.3s ease",
                  cursor: "default",
                }}
              >
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: "rgba(201,168,76,0.5)",
                  letterSpacing: "2px",
                  fontFamily: "sans-serif",
                  marginBottom: 16,
                }}>
                  {item.number}
                </div>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{item.emoji}</div>
                <h3 style={{
                  fontSize: 18, fontWeight: 700,
                  marginBottom: 12, margin: "0 0 12px",
                }}>
                  {item.title}
                </h3>
                <p style={{
                  fontSize: 14, lineHeight: 1.7,
                  color: "rgba(255,255,255,0.5)",
                  fontFamily: "sans-serif", margin: 0,
                }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gandhi inspiration section ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "80px 48px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{
            width: 60, height: 1,
            background: "#C9A84C",
            margin: "0 auto 32px",
          }} />
          <blockquote style={{
            fontSize: "clamp(20px, 3vw, 28px)",
            lineHeight: 1.6,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.8)",
            margin: "0 0 24px",
          }}>
            "In a gentle way, you can shake the world."
          </blockquote>
          <p style={{
            fontSize: 13, color: "#C9A84C",
            fontFamily: "sans-serif",
            letterSpacing: "2px",
            textTransform: "uppercase",
            margin: "0 0 32px",
          }}>
            — Mahatma Gandhi, Navjivan, 1919
          </p>
          <p style={{
            fontSize: 15, lineHeight: 1.8,
            color: "rgba(255,255,255,0.45)",
            fontFamily: "sans-serif",
          }}>
            Navjivan — meaning "New Life" in Gujarati — was Gandhi's newspaper
            that shaped a nation's thinking. We carry that spirit forward,
            bringing clarity and wisdom to the age of cloud computing.
          </p>
          <div style={{
            width: 60, height: 1,
            background: "#C9A84C",
            margin: "32px auto 0",
          }} />
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "80px 48px",
        textAlign: "center",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{
            fontSize: 36, fontWeight: 700,
            marginBottom: 16,
          }}>
            Ready for your new life?
          </h2>
          <p style={{
            fontSize: 16, lineHeight: 1.7,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "sans-serif",
            marginBottom: 40,
          }}>
            Join professionals who start every morning with Navjivan.
          </p>
          <button
            className="login-btn"
            onClick={() => window.location.href = "/api/auth/google"}
            style={{
              background: "linear-gradient(135deg, #C9A84C, #A07830)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "16px 40px",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "sans-serif",
              transition: "all 0.2s ease",
            }}
            data-testid="button-final-cta"
          >
            Get Started Free →
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        position: "relative", zIndex: 1,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "32px 48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
      }}>
        <div style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.25)",
          fontFamily: "sans-serif",
        }}>
          © {new Date().getFullYear()} Navjivan. Inspired by Mahatma Gandhi's newspaper of 1919.
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {["Privacy Policy", "Terms of Service"].map((link) => (
            <a key={link} href="#" style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.25)",
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