import { RankBadge, signalFill, signalInkVars, visibility } from "@/components/shared/RankBadge";
import { ScoreGauge } from "@/components/shared/ScoreGauge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { moduleForSection, sectionVars } from "@/lib/sections";
import { useDarkMode } from "@/lib/useDarkMode";

/**
 * Dev-only visual review sheet for the Aperture system (docs/DESIGN_SYSTEM.md).
 *
 * Renders the REAL primitives with the REAL tokens — not a re-implementation —
 * so what you see here is what ships. Everything the migration changed and that
 * needs a human eye is on this one page, in both themes.
 *
 * Not registered in production (see router.tsx).
 */

const MODULES = ["Overview", "1 · Research", "2 · Audit", "3 · Optimize", "4 · Track", "5 · Manage", "Free tools"];
const SPECTRUM = [0, 1, 2, 3, 4, 5];
const RANKS = [1, 3, 8, 20, 45, 70, 100];

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-sm text-text-muted">{hint}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export default function DesignReview() {
  // The shared hook, not a local copy — a toggle without the transition
  // suppression freezes every token-driven colour on its previous value.
  const { dark, toggle } = useDarkMode();

  return (
    <div className="min-h-screen bg-app-bg p-8 text-text">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Aperture — visual review</h1>
          <p className="mt-1 text-sm text-text-muted">
            Real components, real tokens. Toggle the theme; both must look deliberate.
          </p>
        </div>
        <Button variant="secondary" onClick={toggle}>
          {dark ? "Light" : "Dark"} mode
        </Button>
      </header>

      <Row title="Buttons" hint="10px radius, NOT pill. Primary is a lit surface (180° gradient + inset highlight), and depresses on press.">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
        <Button meta="1 of 10 today">Run analysis</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </Row>

      <Row title="Input" hint="Sits inset (surface-2) at rest and RISES to the top surface on focus. Click it.">
        <div className="w-72"><Input placeholder="example.com" /></div>
        <div className="w-72"><Input placeholder="Disabled" disabled /></div>
      </Row>

      <Row title="Card" hint="Solid, 18px radius, hairline border, lift-1. Deliberately NOT glass — data surfaces stay opaque.">
        <Card className="w-72">
          <CardHeader>
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[color:var(--section-soft)] text-[color:var(--section-ink)]">A</span>
            <div>
              <CardTitle>Site health</CardTitle>
              <p className="mt-0.5 text-xs text-text-muted">Across 340 pages</p>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-text-muted">Body copy sits at --text-muted on --surface.</p>
          </CardBody>
        </Card>
        <div className="glass-card w-72 rounded-xl p-5">
          <p className="text-sm font-semibold">Glass (chrome only)</p>
          <p className="mt-1 text-sm text-text-muted">For comparison. Never used behind tables.</p>
        </div>
      </Row>

      <Row title="Rank as light" hint="THE thesis. #1 glows, #100 sits dim. Brightness should read before the digits do.">
        {RANKS.map((p) => (
          <div key={p} className="flex flex-col items-center gap-1">
            <RankBadge position={p} />
            <span className="text-[10px] text-text-muted">#{p}</span>
          </div>
        ))}
        {/* Text takes signalInk. signalFill is for FILLS — on a light surface
            the bright end of the spectrum is unreadable as type (a #1 measured
            1.3:1 before this was corrected). */}
        <div className="ml-4 flex items-end gap-3">
          {RANKS.map((p) => (
            <span key={p} className="signal-ink font-mono text-2xl tabular-nums" style={signalInkVars(visibility(p))}>
              #{p}
            </span>
          ))}
        </div>
        <div className="ml-2 flex items-end gap-1" title="signalFill — fills only">
          {RANKS.map((p) => (
            <span key={p} className="h-8 w-6 rounded" style={{ background: signalFill(visibility(p)) }} />
          ))}
        </div>
      </Row>

      <Row title="Signal Spectrum" hint="One perceptual ramp, buried → visible. --signal-2 IS the logo blue.">
        {SPECTRUM.map((i) => (
          <div key={i} className="text-center">
            <div className="h-14 w-24 rounded-lg border border-border" style={{ background: `var(--signal-${i})` }} />
            <span className="mt-1 block text-[11px] text-text-muted">--signal-{i}</span>
          </div>
        ))}
      </Row>

      <Row title="Module accents" hint="All one lightness band — only hue varies. Chip uses the accent; the label uses -ink (text-safe).">
        {MODULES.map((m) => (
          <div key={m} style={sectionVars(moduleForSection(m))} className="text-center">
            <div className="h-14 w-28 rounded-lg border border-border" style={{ background: "var(--section)" }} />
            <span className="mt-1 block text-[11px] font-semibold" style={{ color: "var(--section-ink)" }}>
              {m.replace(/^\d+ · /, "")}
            </span>
          </div>
        ))}
      </Row>

      <Row title="Nav item states" hint="Active is a soft tint + a 3px rail that emits the accent — not a filled pill.">
        {["Overview", "2 · Audit", "4 · Track"].map((m) => (
          <div key={m} style={sectionVars(moduleForSection(m))} className="w-52 rounded-lg border border-border bg-surface p-2">
            <span className="relative flex items-center gap-3 rounded-md bg-[color:var(--section-soft)] px-3 py-2 text-sm font-semibold text-[color:var(--section-ink)] before:absolute before:left-0 before:top-1/2 before:h-3/5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-[color:var(--section)] before:shadow-[0_0_12px_var(--section-glow)]">
              Active
            </span>
            <span className="mt-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-text-muted">
              Idle
            </span>
          </div>
        ))}
      </Row>

      <Row title="Score gauge — quality, NOT the spectrum" hint="Health is a judgement: 30 means bad, not dim. Keeps red/amber/green.">
        {[28, 62, 91].map((s) => <ScoreGauge key={s} score={s} label="Health" size={120} />)}
      </Row>

      <Row title="Badges & state ink" hint="Fills use the state colour; small text uses the -ink variant.">
        <Badge tone="success">Success</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="danger">Danger</Badge>
        <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success-ink">
          Free
        </span>
        <span className="text-sm text-success-ink">success-ink</span>
        <span className="text-sm text-warning-ink">warning-ink</span>
        <span className="text-sm text-danger-ink">danger-ink</span>
      </Row>
    </div>
  );
}
