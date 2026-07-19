import { motion } from "framer-motion";
import { Activity, Radar, Rocket, Search, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AreaChart, Bars, CountUp } from "@/components/public/landingKit";
import { sectionVars, type ModuleId } from "@/lib/sections";

import { TRAFFIC } from "./shared";

/** Sticky workflow. Each step keys to a workflow-section accent, matching the
 *  in-app dashboard stepper (Research=purple, Audit=red, Optimize=violet,
 *  Track=green, Manage=slate). */
const FLOW: { k: string; desc: string; icon: typeof Radar; mod: ModuleId }[] = [
  { k: "Audit", desc: "Crawl and score every page — technical issues surfaced by priority.", icon: Radar, mod: "audit" },
  { k: "Research", desc: "Find the keywords and questions your audience actually searches.", icon: Search, mod: "keywords" },
  { k: "Optimize", desc: "Fix on-page, content and structure with AI-written guidance.", icon: Sparkles, mod: "content" },
  { k: "Publish", desc: "Ship optimized content and web stories — GEO & AEO ready.", icon: Rocket, mod: "overview" },
  { k: "Monitor", desc: "Track rankings, AI visibility and site health on autopilot.", icon: Activity, mod: "rank" },
  { k: "Grow", desc: "Compound gains with automated reporting and alerts.", icon: TrendingUp, mod: "manage" },
];
/** Chart colour per workflow step — matched to each step's section accent
 *  (Audit=red, Research/Optimize=purple, Publish=blue, Monitor=green, Grow=slate). */
const FLOW_TONES = ["rose", "violet", "violet", "blue", "emerald", "slate"] as const;

export function Workflow() {
  // Sticky workflow scroll tracking — plain listener computing progress from the
  // section's position over its scrollable height (reliable on every scroll).
  const flowRef = useRef<HTMLDivElement>(null);
  const [flowStep, setFlowStep] = useState(0);
  useEffect(() => {
    const el = flowRef.current;
    if (!el) return;
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const dist = r.height - window.innerHeight;
      if (dist <= 0) {
        setFlowStep(0);
        return;
      }
      const p = Math.min(1, Math.max(0, -r.top / dist));
      setFlowStep(Math.min(FLOW.length - 1, Math.floor(p * FLOW.length)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section ref={flowRef} className="relative lg:h-[280vh]">
      <div className="lg:sticky lg:top-0 lg:flex lg:min-h-screen lg:items-center">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-ink">Workflow</span>
            <h2 className="mt-3 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
              From audit to growth, on autopilot
            </h2>
            <p className="mt-4 text-lg text-text-muted">
              A closed loop that keeps improving your visibility — you stay in control, the platform does the work.
            </p>
            <ol className="mt-6 space-y-1.5">
              {FLOW.map((s, i) => {
                const active = i === flowStep;
                return (
                  <li key={s.k} style={sectionVars(s.mod)}>
                    <div
                      className={`flex items-start gap-4 rounded-2xl border p-3.5 transition-all duration-300 ${
                        active
                          ? "border-[color:var(--section)] bg-surface shadow-md"
                          : "border-border bg-surface lg:border-transparent lg:bg-transparent lg:opacity-60"
                      }`}
                    >
                      <span className="section-gradient grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm">
                        <s.icon size={17} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text-muted">0{i + 1}</span>
                          <h3 className="font-bold">{s.k}</h3>
                        </div>
                        {/* Progressive disclosure: on desktop only the active step
                            shows its description, keeping the column within one screen. */}
                        <p className={`mt-0.5 text-sm text-text-muted ${active ? "" : "lg:hidden"}`}>{s.desc}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Live panel that updates with scroll */}
          <div className="hidden lg:block">
            <div className="lp-ring rounded-3xl" style={sectionVars(FLOW[flowStep].mod)}>
              <div className="rounded-3xl border border-border lp-glass p-6 lp-shadow-lg">
                <motion.div
                  key={flowStep}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                    <div className="flex items-center gap-3">
                      <span className="section-gradient grid h-11 w-11 place-items-center rounded-xl text-white">
                        {(() => {
                          const Icon = FLOW[flowStep].icon;
                          return <Icon size={20} />;
                        })()}
                      </span>
                      <div>
                        <p className="text-xs text-text-muted">Step 0{flowStep + 1}</p>
                        <h4 className="text-lg font-bold">{FLOW[flowStep].k}</h4>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-text-muted">{FLOW[flowStep].desc}</p>
                    <div className="mt-5 h-40 rounded-xl border border-border bg-[var(--lp-panel)] p-3">
                      {flowStep % 2 === 0 ? (
                        <AreaChart
                          values={TRAFFIC.map((v) => v + flowStep * 4)}
                          id={`flow-${flowStep}`}
                          height={140}
                          tone={FLOW_TONES[flowStep % FLOW_TONES.length]}
                        />
                      ) : (
                        <Bars values={[40, 62, 50, 78, 64, 92, 74, 88]} className="h-full" tone={FLOW_TONES[flowStep % FLOW_TONES.length]} />
                      )}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {["Issues", "Keywords", "Score"].map((k, j) => (
                        <div key={k} className="rounded-xl border border-border bg-surface px-3 py-2">
                          <div className="text-sm font-bold text-text">
                            <CountUp to={[12, 432, 98][j] + flowStep} />
                          </div>
                          <div className="text-[10px] text-text-muted">{k}</div>
                        </div>
                      ))}
                    </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
