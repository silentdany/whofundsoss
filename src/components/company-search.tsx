import { useNavigate } from "@tanstack/react-router";
import { usePostHog } from "posthog-js/react";
import { useEffect, useId, useRef, useState } from "react";
import { publicTotal } from "@/lib/format";
import { searchCompanies } from "@/lib/queries";

type Hit = { slug: string; name: string; rank: number | null; publicUsd: number };

/** Type a company, jump to its page. Server-backed, keyboard friendly (combobox pattern). */
export function CompanySearch({
  placeholder = "Search a company, e.g. Microsoft",
  autoFocus = false,
  className = "",
}: {
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searched, setSearched] = useState(false);
  const [index, setIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearched(false);
      return;
    }
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const result = await searchCompanies({ data: q });
        if (mine !== seq.current) return;
        setHits(result);
        setSearched(true);
        setIndex(-1);
      } catch {
        if (mine === seq.current) setHits([]);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  function go(hit: Hit) {
    posthog?.capture("company_search_result_selected", {
      company_slug: hit.slug,
      result_rank: hit.rank,
    });
    setOpen(false);
    void navigate({ to: "/company/$slug", params: { slug: hit.slug } });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setIndex((value) => Math.min(value + 1, hits.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      const hit = hits[index] ?? hits[0];
      if (hit) {
        event.preventDefault();
        go(hit);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && query.trim().length >= 2 && searched;

  return (
    <div className={`relative ${className}`}>
      <label className="flex min-h-14 items-center gap-3 rounded-full border border-line bg-paper px-5 shadow-sm transition-colors focus-within:border-sage">
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" aria-hidden="true">
          <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="sr-only">Search a company</span>
        <input
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={index >= 0 ? `${listId}-${index}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted focus-visible:outline-none"
        />
      </label>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_18px_40px_-18px_rgba(0,0,0,0.25)]"
        >
          {hits.length ? (
            hits.map((hit, i) => (
              <li
                key={hit.slug}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === index}
                onMouseDown={(event) => {
                  event.preventDefault();
                  go(hit);
                }}
                onMouseEnter={() => setIndex(i)}
                className={`flex min-h-12 cursor-pointer items-center justify-between gap-4 px-5 py-3 ${
                  i === index ? "bg-sand" : ""
                }`}
              >
                <span className="font-medium">{hit.name}</span>
                <span className="text-sm text-secondary tabular-nums">
                  {hit.rank ? `#${hit.rank} · ` : ""}
                  {publicTotal(hit.publicUsd)}
                </span>
              </li>
            ))
          ) : (
            <li className="px-5 py-4 text-sm text-secondary">
              No company by that name in this file. It may simply not publish a figure.
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
