import fs from "fs";
import path from "path";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inTable = false;
  let inCode = false;

  for (const raw of lines) {
    const line = raw;
    if (line.startsWith("```")) {
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        out.push('<pre class="overflow-x-auto rounded-md border border-border bg-card p-3 text-[12px] font-mono"><code>');
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(
        line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;") + "\n"
      );
      continue;
    }
    if (line.startsWith("|")) {
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) continue;
      if (!inTable) {
        out.push('<div class="overflow-x-auto"><table class="w-full text-[13px] border border-border rounded-md overflow-hidden"><tbody>');
        inTable = true;
        out.push(
          "<tr>" +
            cells
              .map(
                (c) =>
                  `<th class="border-b border-border bg-muted/60 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">${inline(c)}</th>`
              )
              .join("") +
            "</tr>"
        );
      } else {
        out.push(
          "<tr>" +
            cells
              .map(
                (c) =>
                  `<td class="border-b border-border px-3 py-2">${inline(c)}</td>`
              )
              .join("") +
            "</tr>"
        );
      }
      continue;
    }
    if (inTable) {
      out.push("</tbody></table></div>");
      inTable = false;
    }
    if (line.startsWith("# ")) {
      out.push(`<h1 class="text-[28px] font-semibold tracking-tight">${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      out.push(`<h2 class="mt-6 text-[18px] font-semibold tracking-tight">${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      out.push(`<h3 class="mt-4 text-[15px] font-semibold">${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("- ")) {
      out.push(`<li class="ml-5 list-disc text-[14px] text-foreground/90">${inline(line.slice(2))}</li>`);
    } else if (/^\d+\. /.test(line)) {
      out.push(`<li class="ml-5 list-decimal text-[14px] text-foreground/90">${inline(line.replace(/^\d+\. /, ""))}</li>`);
    } else if (line.trim() === "") {
      out.push("");
    } else {
      out.push(`<p class="text-[14px] text-foreground/90">${inline(line)}</p>`);
    }
  }
  if (inTable) out.push("</tbody></table></div>");
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}

function inline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">$1</code>')
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a class="text-primary hover:underline" href="$2">$1</a>'
    );
}

export default function MethodPage() {
  const mdPath = path.join(process.cwd(), "src/data/methode-et-limites.md");
  const md = fs.readFileSync(mdPath, "utf8");
  const html = mdToHtml(md);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[720px] space-y-4 px-4 pb-16 pt-7">
        <Link
          href="/"
          className="inline-block text-[13px] text-muted-foreground hover:text-foreground"
        >
          ← Ranking
        </Link>
        <article
          className="space-y-2"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>
    </>
  );
}
