import { useEffect, useMemo, useRef, useState } from "react";
import { money } from "@/lib/format";

type Node = { id: string; name: string; publicUsd: number; rank: number | null };
type Link = { a: string; b: string; shared: number; projects: string[] };

export function AllianceGraph({ nodes, links }: { nodes: Node[]; links: Link[] }) {
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
      const height = Math.max(420, Math.min(520, Math.round(width * 1.05)));
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
      const radius = Math.min(width, height) * 0.32;
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
        ctx.globalAlpha = hot ? 1 : 0.9;
        ctx.lineWidth = hot ? 1.75 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const labeled = new Set(
        [...nodes]
          .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
          .slice(0, 5)
          .map((node) => node.id),
      );
      if (active) labeled.add(active);

      for (const node of ordered) {
        const point = placed.get(node.id);
        if (!point) continue;
        const hot = node.id === active;
        ctx.beginPath();
        ctx.fillStyle = hot ? sage : neighbor.has(node.id) ? ink : muted;
        ctx.arc(point.x, point.y, hot ? 7 : 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = "12px Manrope, sans-serif";
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
        const label = node.name.length > 16 ? `${node.name.slice(0, 15)}…` : node.name;
        const widthText = ctx.measureText(label).width;
        const left = outwardX < -8;
        const boxX = left ? lx - widthText - 8 : lx - (Math.abs(outwardX) < 8 ? widthText / 2 : 0);
        ctx.fillStyle = paper;
        ctx.beginPath();
        ctx.roundRect(boxX - 4, ly - 9, widthText + 8, 18, 8);
        ctx.fill();
        ctx.fillStyle = id === active ? ink : muted;
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
    if (best) setActive(best);
  }

  return (
    <div>
      <div ref={wrapRef} className="px-5">
        <canvas
          ref={canvasRef}
          className="w-full touch-manipulation rounded-card"
          onPointerDown={pick}
          role="img"
          aria-label="Companies linked when they fund the same distinctive projects"
        />
      </div>
      <p className="mx-5 mt-3 text-sm text-muted">Tap a point. The five busiest names stay labeled.</p>
      {selected ? (
        <div className="mx-5 mt-4 rounded-card bg-sand px-5 py-4">
          <p className="font-medium">{selected.name}</p>
          <p className="mt-1 text-sm text-secondary tabular-nums">
            {money(selected.publicUsd)} public
            {selected.rank ? ` · rank ${selected.rank}` : ""}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-secondary">
            {related.slice(0, 6).map((link) => {
              const otherId = link.a === selected.id ? link.b : link.a;
              const other = nodes.find((node) => node.id === otherId);
              return (
                <li key={`${link.a}-${link.b}`}>
                  <button type="button" className="text-left hover:text-ink" onClick={() => setActive(otherId)}>
                    <span className="text-ink">{other?.name ?? otherId}</span>
                    {" · "}
                    {link.shared} shared · {link.projects.slice(0, 3).join(", ")}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
