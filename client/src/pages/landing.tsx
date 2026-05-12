import { useState, useEffect, useRef } from "react";

function GandhiFigure() {
  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
    }}>
      <style>{`
        @keyframes walk {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-4px) rotate(0.5deg); }
          75% { transform: translateY(4px) rotate(-0.5deg); }
        }
        @keyframes stickSwing {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        @keyframes cloudFloat1 {
          0%, 100% { transform: translate(0px, 0px); opacity: 0.7; }
          50% { transform: translate(8px, -12px); opacity: 1; }
        }
        @keyframes cloudFloat2 {
          0%, 100% { transform: translate(0px, 0px); opacity: 0.5; }
          50% { transform: translate(-10px, -8px); opacity: 0.9; }
        }
        @keyframes cloudFloat3 {
          0%, 100% { transform: translate(0px, 0px); opacity: 0.6; }
          50% { transform: translate(6px, 10px); opacity: 1; }
        }
        @keyframes globeRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes globeRotateReverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes orbitDot {
          from { transform: rotate(0deg) translateX(180px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(180px) rotate(-360deg); }
        }
        @keyframes orbitDot2 {
          from { transform: rotate(120deg) translateX(180px) rotate(-120deg); }
          to { transform: rotate(480deg) translateX(180px) rotate(-480deg); }
        }
        @keyframes orbitDot3 {
          from { transform: rotate(240deg) translateX(180px) rotate(-240deg); }
          to { transform: rotate(600deg) translateX(180px) rotate(-600deg); }
        }
        @keyframes dataLine {
          0% { stroke-dashoffset: 200; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(76,154,255,0.4)); }
          50% { filter: drop-shadow(0 0 24px rgba(76,154,255,0.9)); }
        }
        @keyframes legLeft {
          0%, 100% { transform: rotate(-8deg); transform-origin: top center; }
          50% { transform: rotate(8deg); transform-origin: top center; }
        }
        @keyframes legRight {
          0%, 100% { transform: rotate(8deg); transform-origin: top center; }
          50% { transform: rotate(-8deg); transform-origin: top center; }
        }
        @keyframes armSwing {
          0%, 100% { transform: rotate(15deg); transform-origin: top center; }
          50% { transform: rotate(-15deg); transform-origin: top center; }
        }
      `}</style>

      <svg
        viewBox="0 0 520 520"
        width="520"
        height="520"
        style={{ overflow: "visible" }}
      >
        {/* ── Outer glow ring ── */}
        <circle
          cx="260" cy="300"
          r="185"
          fill="none"
          stroke="rgba(76,154,255,0.08)"
          strokeWidth="1"
        />

        {/* ── Globe base circle ── */}
        <circle
          cx="260" cy="300"
          r="170"
          fill="rgba(10,20,50,0.6)"
          stroke="rgba(76,154,255,0.35)"
          strokeWidth="1.5"
          style={{ filter: "drop-shadow(0 0 20px rgba(76,154,255,0.3))" }}
        />

        {/* ── Globe latitude lines ── */}
        {[0.2, 0.4, 0.6, 0.8].map((t, i) => {
          const y = 300 - 170 + t * 340;
          const halfW = Math.sqrt(Math.max(0, 170 * 170 - (y - 300) * (y - 300)));
          return (
            <ellipse
              key={i}
              cx="260" cy={y}
              rx={halfW * 0.95} ry={halfW * 0.12}
              fill="none"
              stroke="rgba(76,154,255,0.12)"
              strokeWidth="0.8"
            />
          );
        })}

        {/* ── Globe longitude lines (animated rotation) ── */}
        <g style={{ transformOrigin: "260px 300px", animation: "globeRotate 20s linear infinite" }}>
          {[0, 30, 60, 90, 120, 150].map((angle, i) => (
            <ellipse
              key={i}
              cx="260" cy="300"
              rx="50" ry="170"
              fill="none"
              stroke="rgba(76,154,255,0.10)"
              strokeWidth="0.8"
              transform={`rotate(${angle} 260 300)`}
            />
          ))}
        </g>

        {/* ── Outer ring spinning ── */}
        <circle
          cx="260" cy="300"
          r="200"
          fill="none"
          stroke="rgba(76,154,255,0.15)"
          strokeWidth="1"
          strokeDasharray="4 8"
          style={{ transformOrigin: "260px 300px", animation: "globeRotate 30s linear infinite" }}
        />

        {/* ── Orbit ring ── */}
        <ellipse
          cx="260" cy="300"
          rx="200" ry="55"
          fill="none"
          stroke="rgba(76,154,255,0.15)"
          strokeWidth="1"
          transform="rotate(-20 260 300)"
        />

        {/* ── Orbiting dots ── */}
        <g style={{ transformOrigin: "260px 300px", animation: "orbitDot 8s linear infinite" }}>
          <circle cx="260" cy="300" r="5" fill="#4C9AFF"
            style={{ filter: "drop-shadow(0 0 6px #4C9AFF)" }} />
        </g>
        <g style={{ transformOrigin: "260px 300px", animation: "orbitDot2 8s linear infinite" }}>
          <circle cx="260" cy="300" r="4" fill="#C9A84C"
            style={{ filter: "drop-shadow(0 0 6px #C9A84C)" }} />
        </g>
        <g style={{ transformOrigin: "260px 300px", animation: "orbitDot3 8s linear infinite" }}>
          <circle cx="260" cy="300" r="3" fill="#4C9AFF"
            style={{ filter: "drop-shadow(0 0 4px #4C9AFF)" }} />
        </g>

        {/* ── Animated data lines ── */}
        {[
          { x1: 110, y1: 200, x2: 260, y2: 300, delay: "0s" },
          { x1: 410, y1: 180, x2: 260, y2: 300, delay: "1.5s" },
          { x1: 150, y1: 420, x2: 260, y2: 300, delay: "3s" },
          { x1: 380, y1: 400, x2: 260, y2: 300, delay: "4.5s" },
        ].map((line, i) => (
          <line
            key={i}
            x1={line.x1} y1={line.y1}
            x2={line.x2} y2={line.y2}
            stroke="#4C9AFF"
            strokeWidth="0.8"
            strokeDasharray="200"
            strokeDashoffset="200"
            opacity="0"
            style={{
              animation: "dataLine 3s ease-in-out infinite",
              animationDelay: line.delay,
            }}
          />
        ))}

        {/* ── Cloud 1 (top left) — AWS style ── */}
        <g style={{ animation: "cloudFloat1 5s ease-in-out infinite" }}>
          <rect x="60" y="130" width="90" height="36"
            rx="18"
            fill="rgba(76,154,255,0.12)"
            stroke="rgba(76,154,255,0.4)"
            strokeWidth="1"
          />
          <circle cx="84" cy="130" r="18"
            fill="rgba(76,154,255,0.12)"
            stroke="rgba(76,154,255,0.4)"
            strokeWidth="1"
          />
          <circle cx="112" cy="124" r="22"
            fill="rgba(76,154,255,0.12)"
            stroke="rgba(76,154,255,0.4)"
            strokeWidth="1"
          />
          <circle cx="136" cy="130" r="16"
            fill="rgba(76,154,255,0.12)"
            stroke="rgba(76,154,255,0.4)"
            strokeWidth="1"
          />
          <text x="105" y="154"
            fill="#FF9900"
            fontSize="8"
            fontFamily="sans-serif"
            fontWeight="700"
            textAnchor="middle"
            letterSpacing="1"
          >AWS</text>
        </g>

        {/* ── Cloud 2 (top right) — GCP style ── */}
        <g style={{ animation: "cloudFloat2 6s ease-in-out infinite", animationDelay: "1s" }}>
          <rect x="340" y="110" width="100" height="36"
            rx="18"
            fill="rgba(66,133,244,0.12)"
            stroke="rgba(66,133,244,0.4)"
            strokeWidth="1"
          />
          <circle cx="366" cy="110" r="18"
            fill="rgba(66,133,244,0.12)"
            stroke="rgba(66,133,244,0.4)"
            strokeWidth="1"
          />
          <circle cx="395" cy="104" r="22"
            fill="rgba(66,133,244,0.12)"
            stroke="rgba(66,133,244,0.4)"
            strokeWidth="1"
          />
          <circle cx="420" cy="110" r="16"
            fill="rgba(66,133,244,0.12)"
            stroke="rgba(66,133,244,0.4)"
            strokeWidth="1"
          />
          <text x="392" y="134"
            fill="#4285F4"
            fontSize="7"
            fontFamily="sans-serif"
            fontWeight="700"
            textAnchor="middle"
            letterSpacing="0.5"
          >GOOGLE</text>
        </g>

        {/* ── Cloud 3 (right middle) — Azure style ── */}
        <g style={{ animation: "cloudFloat3 7s ease-in-out infinite", animationDelay: "2s" }}>
          <rect x="370" y="260" width="95" height="34"
            rx="17"
            fill="rgba(0,120,212,0.12)"
            stroke="rgba(0,120,212,0.4)"
            strokeWidth="1"
          />
          <circle cx="394" cy="260" r="17"
            fill="rgba(0,120,212,0.12)"
            stroke="rgba(0,120,212,0.4)"
            strokeWidth="1"
          />
          <circle cx="420" cy="255" r="21"
            fill="rgba(0,120,212,0.12)"
            stroke="rgba(0,120,212,0.4)"
            strokeWidth="1"
          />
          <circle cx="444" cy="260" r="15"
            fill="rgba(0,120,212,0.12)"
            stroke="rgba(0,120,212,0.4)"
            strokeWidth="1"
          />
          <text x="420" y="282"
            fill="#0078D4"
            fontSize="7"
            fontFamily="sans-serif"
            fontWeight="700"
            textAnchor="middle"
            letterSpacing="0.5"
          >AZURE</text>
        </g>

        {/* ══════════════════════════════════
            GANDHI FIGURE — walking forward
            facing viewer, blue outline style
        ══════════════════════════════════ */}

        {/* Walking animation wrapper */}
        <g style={{ animation: "walk 2s ease-in-out infinite" }}>

          {/* ── Shadow on globe ── */}
          <ellipse
            cx="262" cy="385"
            rx="28" ry="8"
            fill="rgba(76,154,255,0.15)"
          />

          {/* ── Dhoti / lower robe ── */}
          <path
            d="M238 320 Q250 370 245 385 L262 380 L279 385 Q274 370 286 320 Z"
            fill="rgba(76,154,255,0.08)"
            stroke="#4C9AFF"
            strokeWidth="1.2"
          />

          {/* ── Left leg (animated) ── */}
          <g style={{
            transformOrigin: "250px 350px",
            animation: "legLeft 1s ease-in-out infinite",
          }}>
            <line
              x1="250" y1="350"
              x2="244" y2="385"
              stroke="#4C9AFF"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Left foot */}
            <ellipse cx="242" cy="387" rx="7" ry="3"
              fill="rgba(76,154,255,0.2)"
              stroke="#4C9AFF"
              strokeWidth="1"
            />
          </g>

          {/* ── Right leg (animated) ── */}
          <g style={{
            transformOrigin: "274px 350px",
            animation: "legRight 1s ease-in-out infinite",
          }}>
            <line
              x1="274" y1="350"
              x2="280" y2="385"
              stroke="#4C9AFF"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Right foot */}
            <ellipse cx="282" cy="387" rx="7" ry="3"
              fill="rgba(76,154,255,0.2)"
              stroke="#4C9AFF"
              strokeWidth="1"
            />
          </g>

          {/* ── Upper robe / shawl ── */}
          <path
            d="M238 265 Q230 280 232 310 L248 315 Q252 290 262 285 Q272 290 276 315 L292 310 Q294 280 286 265 Z"
            fill="rgba(76,154,255,0.08)"
            stroke="#4C9AFF"
            strokeWidth="1.2"
          />

          {/* ── Shawl drape ── */}
          <path
            d="M238 265 Q220 275 218 295 Q230 298 240 285"
            fill="none"
            stroke="rgba(76,154,255,0.5)"
            strokeWidth="1"
          />

          {/* ── Left arm + stick (animated) ── */}
          <g style={{
            transformOrigin: "238px 270px",
            animation: "stickSwing 2s ease-in-out infinite",
          }}>
            {/* Arm */}
            <line
              x1="238" y1="270"
              x2="225" y2="310"
              stroke="#4C9AFF"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Walking stick */}
            <line
              x1="225" y1="310"
              x2="215" y2="390"
              stroke="#C9A84C"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Stick top knob */}
            <circle cx="225" cy="310" r="3"
              fill="#C9A84C"
              style={{ filter: "drop-shadow(0 0 4px #C9A84C)" }}
            />
            {/* Stick bottom tip */}
            <circle cx="215" cy="390" r="2.5"
              fill="#C9A84C"
            />
          </g>

          {/* ── Right arm (animated opposite) ── */}
          <g style={{
            transformOrigin: "286px 270px",
            animation: "armSwing 2s ease-in-out infinite",
          }}>
            <line
              x1="286" y1="270"
              x2="298" y2="310"
              stroke="#4C9AFF"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>

          {/* ── Neck ── */}
          <line
            x1="262" y1="255"
            x2="262" y2="268"
            stroke="#4C9AFF"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* ── Head ── */}
          <circle
            cx="262" cy="245"
            r="22"
            fill="rgba(76,154,255,0.08)"
            stroke="#4C9AFF"
            strokeWidth="1.5"
            style={{ filter: "drop-shadow(0 0 8px rgba(76,154,255,0.4))" }}
          />

          {/* ── Gandhi's round glasses ── */}
          <circle cx="253" cy="246" r="6"
            fill="none"
            stroke="#4C9AFF"
            strokeWidth="1.2"
          />
          <circle cx="271" cy="246" r="6"
            fill="none"
            stroke="#4C9AFF"
            strokeWidth="1.2"
          />
          {/* Bridge of glasses */}
          <line x1="259" y1="246" x2="265" y2="246"
            stroke="#4C9AFF"
            strokeWidth="1"
          />
          {/* Left arm of glasses */}
          <line x1="247" y1="246" x2="241" y2="248"
            stroke="#4C9AFF"
            strokeWidth="1"
          />
          {/* Right arm of glasses */}
          <line x1="277" y1="246" x2="283" y2="248"
            stroke="#4C9AFF"
            strokeWidth="1"
          />

          {/* ── Nose ── */}
          <path d="M262 249 Q264 254 262 256"
            fill="none"
            stroke="#4C9AFF"
            strokeWidth="1"
          />

          {/* ── Ears ── */}
          <path d="M240 244 Q236 247 240 252"
            fill="none"
            stroke="#4C9AFF"
            strokeWidth="1.2"
          />
          <path d="M284 244 Q288 247 284 252"
            fill="none"
            stroke="#4C9AFF"
            strokeWidth="1.2"
          />

          {/* ── Gandhi cap (topi) ── */}
          <path
            d="M242 234 Q262 222 282 234 Q278 228 262 226 Q246 228 242 234 Z"
            fill="rgba(76,154,255,0.15)"
            stroke="#4C9AFF"
            strokeWidth="1.2"
          />

          {/* ── Slight smile ── */}
          <path d="M256 252 Q262 257 268 252"
            fill="none"
            stroke="#4C9AFF"
            strokeWidth="1"
            strokeLinecap="round"
          />

        </g>
        {/* End walking animation wrapper */}

        {/* ── Tech node dots on globe ── */}
        {[
          { cx: 160, cy: 260, r: 3, delay: "0s" },
          { cx: 350, cy: 240, r: 3, delay: "0.5s" },
          { cx: 180, cy: 360, r: 3, delay: "1s" },
          { cx: 340, cy: 350, r: 3, delay: "1.5s" },
          { cx: 220, cy: 200, r: 3, delay: "2s" },
          { cx: 310, cy: 195, r: 3, delay: "2.5s" },
        ].map((dot, i) => (
          <circle
            key={i}
            cx={dot.cx} cy={dot.cy}
            r={dot.r}
            fill="#4C9AFF"
            style={{
              filter: "drop-shadow(0 0 4px #4C9AFF)",
              animation: `pulse-glow 2s ease-in-out infinite`,
              animationDelay: dot.delay,
            }}
          />
        ))}

      </svg>
    </div>
  );
}

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

export default function Landing() {
  const [mouseX, setMouseX] = useState(50);
  const [mouseY, setMouseY] = useState(50);
  const [scrollY, setScrollY] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const heroRef = useRef<HTMLDivElement>(null);

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
          {/* Animated chakra logo */}
          <div style={{ position: "relative", width: 40, height: 40 }}>
            {/* Outer ring spinning */}
            <div style={{
              position: "absolute", inset: 0,
              border: "2px solid rgba(76,154,255,0.4)",
              borderRadius: "50%",
              animation: "spin-slow 8s linear infinite",
              borderTopColor: "#4C9AFF",
            }} />
            {/* Inner ring spinning reverse */}
            <div style={{
              position: "absolute", inset: 6,
              border: "1.5px solid rgba(201,168,76,0.4)",
              borderRadius: "50%",
              animation: "spin-reverse 5s linear infinite",
              borderTopColor: "#C9A84C",
            }} />
            {/* Center dot */}
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
              Est. 1919 · Reborn in AI
            </div>
          </div>
        </div>

        <button
          className="login-btn"
          onClick={() => window.location.href = "/api/auth/google"}
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
        {/* Gandhi figure on the right */}
            <div style={{
              position: "absolute",
              right: "-20px",
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 0,
              opacity: 0.92,
              pointerEvents: "none",
              width: 520,
              height: 520,
            }}>
              <GandhiFigure />
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
              onClick={() => window.location.href = "/api/auth/google"}
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
                {/* Card glow on hover via border color change handled by CSS */}
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

          {/* Sample article cards */}
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
            Navjivan — "New Life" in Gujarati — was Gandhi's newspaper that shaped a
            nation's thinking. We carry that spirit forward, bringing clarity and
            wisdom to the age of cloud computing.
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
              onClick={() => window.location.href = "/api/auth/google"}
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