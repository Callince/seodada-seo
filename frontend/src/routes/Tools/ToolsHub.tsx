import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { TONES } from "@/components/public/landingKit";
import { PageHeader } from "@/components/shared/states";
import { Card, CardBody } from "@/components/ui/card";
import { TOOL_META, type Tool } from "@/routes/Tools/AnalyzeTool";

const ORDER: Tool[] = ["url", "meta", "heading", "keyword", "image", "sitemap"];

/** Analysis Tools hub — a grid of clickable cards, one per free on-page tool. */
export default function ToolsHub() {
  return (
    <div>
      <PageHeader
        title="Analysis Tools"
        subtitle="Free, instant on-page checks — pick a tool to analyze any URL."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ORDER.map((key) => {
          const t = TOOL_META[key];
          const Icon = t.icon;
          const [c1, c2] = TONES[t.tone];
          return (
            <Link
              key={key}
              to={`/tools/${key}`}
              className="group block focus:outline-none"
              style={{ ["--tone" as string]: c1 }}
            >
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-[color:var(--tone)] hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-[color:var(--tone)]">
                <CardBody className="flex h-full flex-col gap-3">
                  <span
                    className="grid h-11 w-11 place-items-center rounded-xl text-white shadow-glow transition-transform group-hover:scale-110"
                    style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                  >
                    <Icon size={20} />
                  </span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-text">{t.title}</h3>
                    <p className="mt-1 text-sm text-text-muted">{t.subtitle}</p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 text-sm font-medium"
                    style={{ color: c1 }}
                  >
                    Open tool
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
