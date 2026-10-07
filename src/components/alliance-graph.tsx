import { Link } from "@tanstack/react-router";
import { usePostHog } from "posthog-js/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { money } from "@/lib/format";

type Node = { id: string; name: string; publicUsd: number; rank: number | null };
type Link = { a: string; b: string; shared: number; projects: string[] };

export function AllianceGraph({ nodes, links }: { nodes: Node[]; links: Link[] }) {
  const posthog = usePostHog();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positions = useRef<Map<string, { x: number; y: number }>>(new Map());

  const degree = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of links) {
      counts.set(link.a, (counts.get(link.a) ?? 0) + link.shared);
      counts.set(link.b, (counts.get(link.b) ?? 0) + link.shared);
    }
    return counts;
  }, [links]);

  const ordered = useMemo(
    () => [...nodes].sort((a, b) => a.name.localeCompare(b.name)),
    [nodes],
  );

  const initial = useMemo(() => {
    return [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0]?.id ?? null;
  }, [nodes, degree]);

  const [active, setActive] = useState<string | null>(initial);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const width = wrap.clientWidth;
      if (!width) return;
      const height = Math.max(380, Math.min(560, Math.round(width * 0.95)));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const styles = getComputedStyle(wrap);
      const sand = styles.getPropertyValue("--color-sand").trim() || "#f3f1ee";
      const ink = styles.getPropertyValue("--color-ink").trim() || "#1a1a1a";
      const sage = styles.getPropertyValue("--color-sage").trim() || "#3d7a6a";
      const muted = styles.getPropertyValue("--color-muted").trim() || "#9a9a9a";
      const line = styles.getPropertyValue("--color-line").trim() || "#e8e6e3";
      const paper = styles.getPropertyValue("--color-paper").trim() || "#ffffff";

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = sand;
      ctx.beginPath();
      ctx.roundRect(0, 0, width, height, 20);
      ctx.fill();

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width * 0.28, height * 0.36);
      const placed = new Map<string, { x: number; y: number }>();
      ordered.forEach((node, index) => {
        const angle = -Math.PI / 2 + (index / Math.max(ordered.length, 1)) * Math.PI * 2;
        placed.set(node.id, {
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        });
      });
      positions.current = placed;

      const neighbor = new Set<string>();
      if (active) {
        neighbor.add(active);
        for (const link of links) {
          if (link.a === active) neighbor.add(link.b);
          if (link.b === active) neighbor.add(link.a);
        }
      }

      for (const link of links) {
        const a = placed.get(link.a);
        const b = placed.get(link.b);
        if (!a || !b) continue;
        const hot = Boolean(active && (link.a === active || link.b === active));
        ctx.strokeStyle = hot ? sage : line;
        ctx.globalAlpha = hot ? 1 : active ? 0.55 : 0.9;
        ctx.lineWidth = hot ? 1.75 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const labeled = new Set(nodes.length <= 24 ? nodes.map((node) => node.id) : []);
      if (nodes.length > 24) {
        for (const node of [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0)).slice(0, 8)) {
          labeled.add(node.id);
        }
      }
      if (active) labeled.add(active);

      for (const node of ordered) {
        const point = placed.get(node.id);
        if (!point) continue;
        const hot = node.id === active;
        ctx.beginPath();
        ctx.fillStyle = hot ? sage : neighbor.has(node.id) ? ink : "#b9b6b1";
        ctx.arc(point.x, point.y, hot ? 8 : neighbor.has(node.id) ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = "13px Manrope, sans-serif";
      ctx.textBaseline = "middle";
      for (const id of labeled) {
        const point = placed.get(id);
        const node = nodes.find((item) => item.id === id);
        if (!point || !node) continue;
        const outwardX = point.x - cx;
        const outwardY = point.y - cy;
        const len = Math.hypot(outwardX, outwardY) || 1;
        const lx = point.x + (outwardX / len) * 16;
        const ly = point.y + (outwardY / len) * 14;
        const label = node.name.length > 18 ? `${node.name.slice(0, 17)}…` : node.name;
        const widthText = ctx.measureText(label).width;
        const left = outwardX < -8;
        const boxX = left ? lx - widthText - 8 : lx - (Math.abs(outwardX) < 8 ? widthText / 2 : 0);
        ctx.fillStyle = paper;
        ctx.beginPath();
        ctx.roundRect(boxX - 4, ly - 9, widthText + 8, 18, 8);
        ctx.fill();
        ctx.fillStyle = id === active || neighbor.has(id) ? ink : muted;
        ctx.textAlign = "left";
        ctx.fillText(label, boxX, ly);
      }
    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [ordered, links, nodes, active, degree]);

  const selected = nodes.find((node) => node.id === active) ?? null;
  const related = selected
    ? links
        .filter((link) => link.a === selected.id || link.b === selected.id)
        .sort((a, b) => b.shared - a.shared)
    : [];

  function selectCompany(companySlug: string, selectionMethod: "canvas" | "list" | "related") {
    posthog?.capture("graph_company_selected", {
      company_slug: companySlug,
      selection_method: selectionMethod,
    });
    setActive(companySlug);
  }

  function pick(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best: string | null = null;
    let bestDist = 26;
    for (const [id, point] of positions.current) {
      const dist = Math.hypot(point.x - x, point.y - y);
      if (dist < bestDist) {
        best = id;
        bestDist = dist;
      }
    }
    if (best) selectCompany(best, "canvas");
  }

  return (
    <div className="mx-auto grid max-w-[1120px] gap-6 px-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div>
        <div ref={wrapRef}>
          <canvas
            ref={canvasRef}
            className="w-full touch-manipulation rounded-card"
            onPointerDown={pick}
            role="img"
            aria-label="Circle diagram: companies linked when they sponsor the same distinctive projects. A text version follows below."
          />
        </div>
        <p className="mt-3 text-sm text-secondary">
          Each dot is a company. A line means the two sponsor the same projects. Tap a dot, or pick a
          company below, to see who it is linked to.
        </p>
        <div role="group" aria-label="Pick a company" className="mt-3 flex flex-wrap gap-2">
          {ordered.map((node) => (
            <button
              key={node.id}
              type="button"
              aria-pressed={node.id === active}
              onClick={() => selectCompany(node.id, "list")}
              className={`min-h-11 rounded-full px-4 text-sm transition-colors ${
                node.id === active ? "bg-ink text-paper" : "bg-sand hover:bg-line"
              }`}
            >
              {node.name}
            </button>
          ))}
        </div>
      </div>
      {selected ? (
        <aside className="h-fit rounded-card bg-sand px-6 py-6 lg:sticky lg:top-24" aria-live="polite">
          <p className="eyebrow">Selected</p>
          <h2 className="mt-1 font-serif text-3xl">{selected.name}</h2>
          <p className="mt-1 text-sm text-secondary tabular-nums">
            {selected.publicUsd > 0 ? `${money(selected.publicUsd)} public` : "No public dollar amount"}
            {selected.rank ? ` · rank ${selected.rank}` : ""}
          </p>
          <Link
            to="/company/$slug"
            params={{ slug: selected.id }}
            className="mt-3 inline-block text-sm font-medium text-sage"
          >
            Open the company page <span aria-hidden="true">›</span>
          </Link>
          <h3 className="mt-6 text-sm font-semibold">Shares projects with</h3>
          <ul className="mt-3 space-y-3 text-sm text-secondary">
            {related.slice(0, 6).map((link) => {
              const otherId = link.a === selected.id ? link.b : link.a;
              const other = nodes.find((node) => node.id === otherId);
              return (
                <li key={`${link.a}-${link.b}`}>
                  <button type="button" className="min-h-8 text-left hover:text-ink" onClick={() => selectCompany(otherId, "related")}>
                    <span className="font-medium text-ink underline decoration-line underline-offset-4">
                      {other?.name ?? otherId}
                    </span>{" "}
                    · {link.shared} in common
                    <span className="block text-xs text-muted">{link.projects.slice(0, 3).join(", ")}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}
