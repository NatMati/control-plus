"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

// ─── Isótipo inline (provisional hasta que llegue el logo de la diseñadora) ──
function Isotipo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" fill="none">
      <rect x="16.5" y="2.5"  width="10" height="14" rx="2.5" fill="#0E4D6E"/>
      <rect x="16.5" y="27.5" width="10" height="14" rx="2.5" fill="#0E4D6E"/>
      <rect x="2.5"  y="16.5" width="14" height="10" rx="2.5" fill="#0E4D6E"/>
      <rect x="27.5" y="16.5" width="14" height="10" rx="2.5" fill="#0E4D6E"/>
      <rect x="15"   y="1"    width="10" height="14" rx="2.5" fill="#38BDF8"/>
      <rect x="15"   y="26"   width="10" height="14" rx="2.5" fill="#38BDF8"/>
      <rect x="1"    y="15"   width="14" height="10" rx="2.5" fill="#1A7FA8"/>
      <rect x="26"   y="15"   width="14" height="10" rx="2.5" fill="#1A7FA8"/>
    </svg>
  );
}

// ─── Arrow icon ──────────────────────────────────────────────────────────────
function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Check / Dash icons ───────────────────────────────────────────────────────
function Check({ dim }: { dim?: boolean }) {
  return <span style={{ color: dim ? "rgba(255,255,255,0.18)" : "#38BDF8", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{dim ? "–" : "✓"}</span>;
}

// ─── Pill tag ─────────────────────────────────────────────────────────────────
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 11, fontWeight: 500, letterSpacing: "0.14em",
      textTransform: "uppercase", color: "#38BDF8",
      border: "1px solid rgba(56,189,248,0.2)",
      background: "rgba(56,189,248,0.06)",
      padding: "5px 12px", borderRadius: 100,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#38BDF8", display: "inline-block" }}/>
      {children}
    </span>
  );
}

// ─── Testimonial card ─────────────────────────────────────────────────────────
type TestiProps = { stars: number; text: string; name: string; role: string; color: string; };
function TestiCard({ stars, text, name, role, color }: TestiProps) {
  const initial = name[0];
  return (
    <div style={{
      background: "#05080F", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 18, padding: 28,
    }}>
      <div style={{ color: "#FCD34D", fontSize: 13, letterSpacing: 2, marginBottom: 14 }}>
        {"★".repeat(stars)}{"☆".repeat(5 - stars)}
      </div>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.75, fontStyle: "italic", marginBottom: 20, fontWeight: 300 }}>
        "{text}"
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: color, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 13, fontWeight: 600, color: "white", flexShrink: 0,
        }}>{initial}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{name}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", marginTop: 1 }}>{role}</div>
        </div>
      </div>
    </div>
  );
}

// ─── FAQ item ─────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = (typeof window !== "undefined")
    ? [false, () => {}]
    : [false, () => {}];

  // usamos ref para evitar SSR issues
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useClientState(false);

  return (
    <div style={{
      border: `1px solid ${isOpen ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s",
    }}>
      <div
        onClick={() => setIsOpen(v => !v)}
        style={{
          padding: "22px 24px", display: "flex", justifyContent: "space-between",
          alignItems: "center", cursor: "pointer", fontSize: 15, fontWeight: 500,
          userSelect: "none", transition: "background 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        {q}
        <span style={{
          color: isOpen ? "#38BDF8" : "rgba(255,255,255,0.18)",
          fontSize: 20, transition: "transform 0.2s, color 0.2s",
          transform: isOpen ? "rotate(45deg)" : "none", flexShrink: 0,
        }}>+</span>
      </div>
      <div ref={contentRef} style={{
        maxHeight: isOpen ? 300 : 0, overflow: "hidden",
        transition: "max-height 0.3s ease",
      }}>
        <div style={{ padding: "0 24px 22px", fontSize: 14, color: "rgba(255,255,255,0.45)", fontWeight: 300, lineHeight: 1.75 }}>
          {a}
        </div>
      </div>
    </div>
  );
}

// Hook helper para estado en cliente
function useClientState<T>(initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const { useState } = require("react");
  return useState(initial);
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function LandingClient() {

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = "1";
          (e.target as HTMLElement).style.transform = "translateY(0)";
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

    document.querySelectorAll(".reveal").forEach(el => {
      (el as HTMLElement).style.opacity = "0";
      (el as HTMLElement).style.transform = "translateY(24px)";
      (el as HTMLElement).style.transition = "opacity 0.6s ease, transform 0.6s ease";
      observer.observe(el);
    });

    // Nav scroll shadow
    const handleScroll = () => {
      const nav = document.getElementById("main-nav");
      if (nav) nav.style.boxShadow = window.scrollY > 10 ? "0 4px 32px rgba(0,0,0,0.4)" : "none";
    };
    window.addEventListener("scroll", handleScroll);
    return () => { observer.disconnect(); window.removeEventListener("scroll", handleScroll); };
  }, []);

  const S = styles;

  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; background: #05080F; color: white; font-family: 'DM Sans', system-ui, sans-serif; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
        a { text-decoration: none; }

        /* Noise overlay */
        body::before {
          content: '';
          position: fixed; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none; z-index: 0; opacity: 0.4;
        }

        /* Hero grid */
        .hero-grid {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent);
          pointer-events: none;
        }

        /* Animación hero */
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .hero-anim-1 { animation: fadeUp 0.6s 0.0s ease both; }
        .hero-anim-2 { animation: fadeUp 0.6s 0.1s ease both; }
        .hero-anim-3 { animation: fadeUp 0.6s 0.2s ease both; }
        .hero-anim-4 { animation: fadeUp 0.6s 0.3s ease both; }
        .hero-anim-5 { animation: fadeUp 0.6s 0.4s ease both; }
        .hero-anim-6 { animation: fadeUp 0.8s 0.5s ease both; }

        /* Nav hover */
        .nav-link { font-size: 14px; font-weight: 400; color: rgba(255,255,255,0.45); transition: color 0.15s; }
        .nav-link:hover { color: white; }

        /* Buttons */
        .btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #38BDF8; color: #05080F; font-size: 14px; font-weight: 600; padding: 13px 28px; border-radius: 12px; border: none; cursor: pointer; transition: all 0.2s; letter-spacing: 0.01em; }
        .btn-primary:hover { background: #7DD3F8; transform: translateY(-1px); box-shadow: 0 8px 32px rgba(56,189,248,0.25); }
        .btn-ghost { display: inline-flex; align-items: center; gap: 8px; background: transparent; color: rgba(255,255,255,0.45); font-size: 14px; font-weight: 500; padding: 13px 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.07); cursor: pointer; transition: all 0.2s; }
        .btn-ghost:hover { color: white; border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); }
        .btn-sm { padding: 9px 20px !important; font-size: 13px !important; }

        /* Features grid */
        .features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 768px) { .features-grid { grid-template-columns: 1fr; } }
        .feat-wide { grid-column: span 2; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; }
        @media (max-width: 768px) { .feat-wide { grid-column: span 1; grid-template-columns: 1fr; } }

        /* Testimonials grid */
        .testi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 48px; }
        @media (max-width: 900px) { .testi-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) { .testi-grid { grid-template-columns: 1fr; } }

        /* Pricing grid */
        .pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 48px; }
        @media (max-width: 900px) { .pricing-grid { grid-template-columns: 1fr; max-width: 400px; margin-left: auto; margin-right: auto; } }

        /* Proof strip */
        .proof-inner { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; }

        /* Feat card hover */
        .feat-card { transition: border-color 0.2s, box-shadow 0.2s; }
        .feat-card:hover { border-color: rgba(56,189,248,0.2) !important; box-shadow: 0 0 40px rgba(56,189,248,0.04); }
        .price-card { transition: transform 0.2s; }
        .price-card:hover { transform: translateY(-4px); }

        /* Nav mobile */
        @media (max-width: 768px) { .nav-links { display: none !important; } }

        /* Hero mockup */
        .mockup-body { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 640px) { .mockup-body { grid-template-columns: 1fr; } .mock-card:nth-child(n+3) { display: none; } }
      `}</style>

      {/* ══ NAV ══ */}
      <nav id="main-nav" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 24px",
        background: "rgba(5,8,15,0.7)",
        backdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        transition: "box-shadow 0.3s",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: "white" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#0F1623", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Isotipo size={20}/>
            </div>
            Control<span style={{ color: "#38BDF8" }}>+</span>
          </Link>

          <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: 32, listStyle: "none" }}>
            {[["#features","Features"],["#pricing","Precios"],["#testimonios","Testimonios"],["#faq","FAQ"]].map(([href,label]) => (
              <a key={href} href={href} className="nav-link">{label}</a>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/login"    className="btn-ghost btn-sm">Entrar</Link>
            <Link href="/register" className="btn-primary btn-sm">Comenzar gratis</Link>
          </div>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "120px 24px 80px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 800, height: 600, background: "radial-gradient(ellipse, rgba(56,189,248,0.10) 0%, rgba(13,148,136,0.05) 40%, transparent 70%)", pointerEvents: "none" }}/>
        <div style={{ position: "absolute", bottom: -100, left: "20%", width: 400, height: 400, background: "radial-gradient(ellipse, rgba(13,148,136,0.07) 0%, transparent 70%)", pointerEvents: "none" }}/>
        <div className="hero-grid"/>

        <div className="hero-anim-1" style={{ marginBottom: 28 }}><Tag>Gestión financiera personal</Tag></div>

        <h1 className="hero-anim-2" style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(42px, 7vw, 80px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, marginBottom: 24 }}>
          Construí tu patrimonio<br/>
          <span style={{ background: "linear-gradient(135deg, #38BDF8 0%, #0D9488 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            con precisión real
          </span>
        </h1>

        <p className="hero-anim-3" style={{ fontSize: 18, fontWeight: 300, color: "rgba(255,255,255,0.45)", maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.7 }}>
          Portfolio de inversiones, cashflow visual, presupuestos inteligentes y un asesor IA que conoce tus números. Todo en un solo lugar.
        </p>

        <div className="hero-anim-4" style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" className="btn-primary">Empezar gratis <Arrow/></Link>
          <a href="#features" className="btn-ghost">Ver cómo funciona</a>
        </div>

        <p className="hero-anim-5" style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.18)" }}>
          Sin tarjeta de crédito · Plan gratuito siempre disponible
        </p>

        {/* Mockup */}
        <div className="hero-anim-6" style={{ marginTop: 72, width: "100%", maxWidth: 900, position: "relative", zIndex: 1 }}>
          <div style={{ background: "#0C1220", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, overflow: "hidden", boxShadow: "0 0 0 1px rgba(56,189,248,0.08), 0 40px 120px rgba(0,0,0,0.7), 0 0 80px rgba(56,189,248,0.04)" }}>
            {/* Barra de ventana */}
            <div style={{ height: 40, background: "#08101C", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
              {["#F87171","#FCD34D","#34D399"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }}/>)}
            </div>
            {/* Cards mock */}
            <div className="mockup-body" style={{ padding: 28 }}>
              {/* Patrimonio */}
              <div style={S.mockCard}>
                <div style={S.mockLabel}>Patrimonio neto</div>
                <div style={{ ...S.mockValue, color: "#38BDF8" }}>US$ 28.450</div>
                <div style={S.mockSub}>+12.4% este año</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 40, marginTop: 14 }}>
                  {[40,55,45,70,60,85].map((h,i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: "3px 3px 0 0", background: i === 5 ? "#38BDF8" : `rgba(56,189,248,${0.2 + i*0.03})` }}/>
                  ))}
                </div>
              </div>
              {/* Inversiones */}
              <div style={S.mockCard}>
                <div style={S.mockLabel}>Inversiones</div>
                <div style={{ ...S.mockValue, color: "#34D399" }}>+US$ 1.240</div>
                <div style={S.mockSub}>Ganancia del mes</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {[["AAPL","+8.2%","#34D399"],["BTC","+14.1%","#34D399"],["SPY","-1.3%","#F87171"]].map(([t,v,c]) => (
                    <div key={t} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{t}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: c }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Presupuesto */}
              <div style={S.mockCard}>
                <div style={S.mockLabel}>Presupuesto</div>
                <div style={{ ...S.mockValue, fontSize: 18, color: "white" }}>$U 38.200 / 60k</div>
                <div style={S.mockSub}>Marzo · 63% usado</div>
                {[["Comida","84%","#F87171"],["Transporte","42%","#34D399"],["Ocio","61%","#FCD34D"]].map(([cat,pct,c]) => (
                  <div key={cat} style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.18)", marginBottom: 4 }}>
                      <span>{cat}</span><span>{pct}</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: pct, background: c, borderRadius: 4 }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ PROOF STRIP ══ */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "24px 0", overflow: "hidden" }}>
        <div className="proof-inner" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          {[["Usuarios activos","+3.200"],["Países","12"],["Patrimonio gestionado","US$42M"],["Valoración promedio","4.8 ★"]].map(([label, num], i) => (
            <div key={label} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 && <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.07)", margin: "0 8px" }}/>}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 32px" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700 }}>{num}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", marginTop: 2 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ FEATURES ══ */}
      <section id="features" style={{ padding: "100px 0", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <div className="reveal" style={{ textAlign: "center", marginBottom: 64 }}>
            <Tag>Features</Tag>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 800, letterSpacing: -1.5, marginTop: 16, lineHeight: 1.1 }}>
              Herramientas que<br/><span style={{ color: "#38BDF8" }}>marcan la diferencia</span>
            </h2>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.45)", maxWidth: 480, margin: "16px auto 0", fontWeight: 300 }}>
              No es otra app de gastos. Es un sistema financiero completo para personas que quieren crecer.
            </p>
          </div>

          <div className="features-grid reveal">
            {/* Inversiones */}
            <FeatCard icon="📈" title="Portfolio de inversiones unificado">
              Acciones, ETFs, cripto, bonos y metales en un solo dashboard. Performance histórica, rendimiento por activo, distribución del portfolio y alertas de variación configurables. Lo que antes necesitaba cuatro apps, ahora en una.
            </FeatCard>

            {/* Nito IA */}
            <FeatCard icon="✦" title="Nito — tu asesor financiero IA" accent badge="Plan Deluxe">
              Hacele preguntas en lenguaje natural: "¿En qué gasté más este mes?", "¿Cómo va mi portfolio?", "¿Cuánto puedo ahorrar si bajo el gasto en ocio?". Nito conoce tus números y responde en segundos.
            </FeatCard>

            {/* Cashflow — wide */}
            <div className="feat-card feat-wide feat-card" style={{ background: "#080C16", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 36 }}>
              <div>
                <div style={S.featIcon}>🌊</div>
                <h3 style={S.featTitle}>Cashflow visual con diagrama Sankey</h3>
                <p style={S.featText}>Visualizá exactamente de dónde viene y adónde va tu dinero. El diagrama Sankey muestra el flujo completo — de ingresos a categorías de gasto — de un vistazo. Filtrá por cualquier rango de fechas y detectá dónde se escapa la plata.</p>
                <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {["Diagrama Sankey interactivo","Rango de fechas libre","KPIs automáticos","Exportación"].map(t => (
                    <span key={t} style={{ fontSize: 12, color: "#38BDF8", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", padding: "4px 12px", borderRadius: 6 }}>{t}</span>
                  ))}
                </div>
              </div>
              {/* Mini cashflow visual */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>Cashflow · Marzo 2025</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  {[
                    { label: "INGRESOS", val: "+ $U 95.000", sub: "Sueldo · Freelance", c: "#34D399", bg: "rgba(52,211,153,0.15)", b: "rgba(52,211,153,0.2)" },
                    { label: "GASTOS",   val: "- $U 63.200", sub: "6 categorías",       c: "#F87171", bg: "rgba(248,113,113,0.1)", b: "rgba(248,113,113,0.2)" },
                    { label: "AHORRO",   val: "$U 31.800",   sub: "33% del ingreso",    c: "#38BDF8", bg: "rgba(56,189,248,0.08)", b: "rgba(56,189,248,0.15)" },
                  ].map((item, i) => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                      {i > 0 && <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 16, flexShrink: 0 }}>→</span>}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", marginBottom: 6 }}>{item.label}</div>
                        <div style={{ background: item.bg, border: `1px solid ${item.b}`, borderRadius: 8, padding: "10px 12px" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: item.c }}>{item.val}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", marginTop: 2 }}>{item.sub}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Presupuestos */}
            <FeatCard icon="🎯" title="Presupuestos con alertas reales">
              Límites mensuales por categoría con alertas al 80% y 100%. Detecta categorías donde gastás sin presupuesto asignado y muestra la tendencia de los últimos 6 meses por rubro.
            </FeatCard>

            {/* Calendario */}
            <FeatCard icon="📅" title="Calendario financiero + inversiones">
              Navegá mes a mes con todos tus movimientos. Con Deluxe, activás el overlay de performance de tu portfolio — ves en el mismo calendario cuándo subió o bajó tu patrimonio invertido.
            </FeatCard>
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIOS ══ */}
      <section id="testimonios" style={{ padding: "100px 0", background: "#080C16", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}/>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}/>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <div className="reveal" style={{ textAlign: "center" }}>
            <Tag>Testimonios</Tag>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 800, letterSpacing: -1.5, marginTop: 16, lineHeight: 1.1 }}>
              Lo que dicen<br/><span style={{ color: "#38BDF8" }}>nuestros usuarios</span>
            </h2>
          </div>
          <div className="testi-grid reveal">
            <TestiCard stars={5} text="Finalmente entiendo a dónde se va mi plata cada mes. El cashflow visual es increíble, nunca había tenido tanta claridad sobre mis finanzas." name="Santiago M." role="Desarrollador · Montevideo" color="linear-gradient(135deg,#0d9488,#2563eb)"/>
            <TestiCard stars={5} text="Tenía mis inversiones en 4 apps distintas. Ahora todo está en Control+ y veo el portfolio completo en segundos. Un cambio enorme en mi día a día." name="Valentina R." role="Analista financiera · Buenos Aires" color="linear-gradient(135deg,#7c3aed,#2563eb)"/>
            <TestiCard stars={5} text="El feature de costo real me cambió cómo tomo decisiones de compra. Ver que un par de zapatillas vale 8 horas de trabajo te hace pensar dos veces." name="Matías L." role="Freelancer · Santiago de Chile" color="linear-gradient(135deg,#0d9488,#0ea5e9)"/>
            <TestiCard stars={4} text="La interfaz es muy cuidada, se nota que está hecha con atención al detalle. Los presupuestos con alertas me ayudaron a bajar el gasto un 20% en dos meses." name="Lucía F." role="Médica · Córdoba" color="linear-gradient(135deg,#f59e0b,#ef4444)"/>
            <TestiCard stars={5} text="Llevaba años queriendo organizar mis finanzas y nunca encontraba una app que me convenciera. Control+ es la primera que sigo usando después de 6 meses." name="Andrés P." role="Emprendedor · Bogotá" color="linear-gradient(135deg,#2563eb,#0d9488)"/>
            <TestiCard stars={5} text="El plan Deluxe vale cada centavo. El overlay de inversiones en el calendario y Nito IA son herramientas que no encontré en ningún otro lado." name="Carolina V." role="Inversora · Lima" color="linear-gradient(135deg,#fbbf24,#f59e0b)"/>
          </div>
        </div>
      </section>

      {/* ══ PRICING ══ */}
      <section id="pricing" style={{ padding: "100px 0", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <div className="reveal" style={{ textAlign: "center", marginBottom: 0 }}>
            <Tag>Precios</Tag>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 800, letterSpacing: -1.5, marginTop: 16, lineHeight: 1.1 }}>
              Empezá gratis,<br/><span style={{ color: "#38BDF8" }}>crecé cuando quieras</span>
            </h2>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.45)", maxWidth: 400, margin: "16px auto 0", fontWeight: 300 }}>
              Sin compromisos. Podés cambiar de plan en cualquier momento.
            </p>
          </div>

          <div className="pricing-grid reveal">
            <PriceCard plan="Free" planColor="rgba(255,255,255,0.18)" amount="$0" period="Para siempre"
              desc="Para empezar a ordenar tus finanzas y tener visibilidad sobre tus gastos y cuentas."
              features={["Movimientos y cuentas (hasta 3)","Presupuestos por categoría","Calendario financiero","Tipo de cambio automático"]}
              dimFeatures={["Portfolio de inversiones","Cashflow + Sankey","Nito IA"]}
              cta="Empezar gratis" ctaStyle="outline"/>
            <PriceCard plan="Pro" planColor="#38BDF8" amount="$8" period="por mes"
              desc="Todas las herramientas para gestionar inversiones y cashflow con precisión."
              features={["Todo lo del plan Free","Cuentas ilimitadas","Portfolio de inversiones completo","Cashflow con diagrama Sankey","Exportación de reportes","Herramienta de costo real"]}
              dimFeatures={["Nito IA"]}
              cta="Empezar con Pro" ctaStyle="primary" featured badge="Más popular"/>
            <PriceCard plan="Deluxe" planColor="#fbbf24" amount="$15" period="por mes"
              desc="El stack financiero completo con inteligencia artificial integrada."
              features={["Todo lo del plan Pro","✦ Nito IA — análisis en lenguaje natural","Overlay de inversiones en calendario","Alertas inteligentes de gastos","Soporte prioritario","Acceso anticipado a features"]}
              cta="Empezar con Deluxe" ctaStyle="outline"/>
          </div>
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section id="faq" style={{ padding: "100px 0", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <div className="reveal" style={{ textAlign: "center" }}>
            <Tag>FAQ</Tag>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 800, letterSpacing: -1.5, marginTop: 16, lineHeight: 1.1 }}>
              Preguntas<br/><span style={{ color: "#38BDF8" }}>frecuentes</span>
            </h2>
          </div>
          <div className="reveal" style={{ maxWidth: 700, margin: "48px auto 0", display: "flex", flexDirection: "column", gap: 2 }}>
            {FAQS.map(f => <FaqItem key={f.q} q={f.q} a={f.a}/>)}
          </div>
        </div>
      </section>

      {/* ══ CTA FINAL ══ */}
      <section style={{ padding: "120px 0", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(56,189,248,0.12) 0%, transparent 70%)", pointerEvents: "none" }}/>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", position: "relative", zIndex: 1 }} className="reveal">
          <div style={{ marginBottom: 28 }}><Tag>Empezá hoy</Tag></div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 20 }}>
            Las herramientas que<br/><span style={{ color: "#38BDF8" }}>tu patrimonio merece</span>
          </h2>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.45)", maxWidth: 440, margin: "0 auto 40px", fontWeight: 300 }}>
            Portfolio, cashflow, presupuestos y un asesor IA. Gratis para siempre, sin tarjeta de crédito.
          </p>
          <Link href="/register" className="btn-primary" style={{ fontSize: 16, padding: "16px 36px" }}>
            Crear cuenta gratis <Arrow/>
          </Link>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "48px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700 }}>
            Control<span style={{ color: "#38BDF8" }}>+</span>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            {[["Privacidad","/privacidad"],["Términos","/terminos"],["Contacto","mailto:hola@controlplus.app"]].map(([label,href]) => (
              <a key={href} href={href} style={{ fontSize: 13, color: "rgba(255,255,255,0.18)", transition: "color 0.15s" }}
                onMouseEnter={e=>(e.currentTarget.style.color="white")}
                onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,255,255,0.18)")}>{label}</a>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.18)" }}>© 2025 Control+. Todos los derechos reservados.</div>
        </div>
      </footer>
    </>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function FeatCard({ icon, title, children, accent, badge }: {
  icon: string; title: string; children: React.ReactNode; accent?: boolean; badge?: string;
}) {
  return (
    <div className="feat-card" style={{
      background: accent ? "linear-gradient(160deg,#080C16,#05101A)" : "#080C16",
      border: `1px solid ${accent ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 20, padding: 36,
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, fontSize: 20 }}>{icon}</div>
      <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 10, letterSpacing: -0.3 }}>{title}</h3>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, fontWeight: 300 }}>{children}</p>
      {badge && (
        <div style={{ marginTop: 16 }}>
          <span style={{ fontSize: 11, color: "#38BDF8", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)", padding: "3px 10px", borderRadius: 6, fontWeight: 500 }}>{badge}</span>
        </div>
      )}
    </div>
  );
}

function PriceCard({ plan, planColor, amount, period, desc, features, dimFeatures = [], cta, ctaStyle, featured, badge }: {
  plan: string; planColor: string; amount: string; period: string; desc: string;
  features: string[]; dimFeatures?: string[]; cta: string; ctaStyle: "primary"|"outline";
  featured?: boolean; badge?: string;
}) {
  return (
    <div className="price-card" style={{
      background: featured ? "linear-gradient(160deg,#0a1628,#061418)" : "#080C16",
      border: `1px solid ${featured ? "rgba(56,189,248,0.3)" : "rgba(255,255,255,0.07)"}`,
      boxShadow: featured ? "0 0 60px rgba(56,189,248,0.08), inset 0 1px 0 rgba(56,189,248,0.1)" : "none",
      borderRadius: 20, padding: "36px 32px",
      display: "flex", flexDirection: "column", position: "relative",
    }}>
      {badge && (
        <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#38BDF8", color: "#05080F", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 14px", borderRadius: 100, whiteSpace: "nowrap" }}>
          {badge}
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: planColor, marginBottom: 12 }}>{plan}</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 48, fontWeight: 800, letterSpacing: -2, lineHeight: 1, marginBottom: 4 }}>
        {amount}<span style={{ fontSize: 18, fontWeight: 400, color: "rgba(255,255,255,0.18)", letterSpacing: 0 }}></span>
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.18)", marginBottom: 20 }}>{period}</div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 24, fontWeight: 300 }}>{desc}</div>
      <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 24 }}/>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, marginBottom: 32, flex: 1 }}>
        {features.map(f => (
          <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
            <Check/>{f}
          </li>
        ))}
        {dimFeatures.map(f => (
          <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.18)" }}>
            <Check dim/>{f}
          </li>
        ))}
      </ul>
      <Link href="/register" style={{
        display: "block", textAlign: "center",
        fontSize: 14, fontWeight: 600, padding: 13, borderRadius: 12,
        transition: "all 0.2s",
        background: ctaStyle === "primary" ? "#38BDF8" : "transparent",
        color: ctaStyle === "primary" ? "#05080F" : "rgba(255,255,255,0.45)",
        border: ctaStyle === "outline" ? "1px solid rgba(255,255,255,0.07)" : "none",
      }}
        onMouseEnter={e => {
          if (ctaStyle === "primary") { e.currentTarget.style.background = "#7DD3F8"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(56,189,248,0.25)"; }
          else { e.currentTarget.style.color = "white"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }
        }}
        onMouseLeave={e => {
          if (ctaStyle === "primary") { e.currentTarget.style.background = "#38BDF8"; e.currentTarget.style.boxShadow = "none"; }
          else { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "transparent"; }
        }}>
        {cta}
      </Link>
    </div>
  );
}

// ─── Datos estáticos ──────────────────────────────────────────────────────────
const FAQS = [
  { q: "¿Es seguro conectar mis cuentas?", a: "Control+ no se conecta directamente a tu banco. Vos ingresás los movimientos manualmente o importando archivos, lo que significa que tus credenciales bancarias nunca pasan por nuestra plataforma." },
  { q: "¿Puedo cambiar de plan en cualquier momento?", a: "Sí. Podés subir o bajar de plan cuando quieras. Si bajás de plan, tus datos se mantienen guardados — solo perdés acceso a las features premium hasta que vuelvas a subir." },
  { q: "¿Qué monedas soporta Control+?", a: "Soportamos USD, EUR, UYU, ARS y BRL con conversión automática de tipo de cambio actualizada diariamente. Podés tener cuentas en distintas monedas y ver todo consolidado en la moneda que elijas." },
  { q: "¿Qué es Nito IA?", a: "Nito es el asistente de inteligencia artificial integrado en Control+. Puede analizar tus finanzas, responder preguntas sobre tu portfolio, sugerir ajustes en tus presupuestos y ayudarte a tomar decisiones de inversión. Disponible en el plan Deluxe." },
  { q: "¿Tienen app móvil?", a: "La versión web está optimizada para mobile y funciona perfectamente desde el navegador. Una app nativa para iOS y Android está en desarrollo y llegará próximamente." },
  { q: "¿Qué pasa con mis datos si cancelo?", a: "Tus datos son tuyos. Podés exportar todo en cualquier momento. Si cancelás tu cuenta, te damos 30 días para descargar tus datos antes de que sean eliminados permanentemente de nuestros servidores." },
];

// ─── Estilos reutilizables ────────────────────────────────────────────────────
const styles = {
  mockCard:  { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 } as React.CSSProperties,
  mockLabel: { fontSize: 10, color: "rgba(255,255,255,0.18)", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 8 },
  mockValue: { fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700 } as React.CSSProperties,
  mockSub:   { fontSize: 11, color: "rgba(255,255,255,0.18)", marginTop: 4 },
  featIcon:  { width: 44, height: 44, borderRadius: 12, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, fontSize: 20 } as React.CSSProperties,
  featTitle: { fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 10, letterSpacing: -0.3 } as React.CSSProperties,
  featText:  { fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, fontWeight: 300 } as React.CSSProperties,
};
