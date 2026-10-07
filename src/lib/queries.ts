import { createServerFn } from "@tanstack/react-start";

export const loadHome = createServerFn({ method: "GET" }).handler(async () => {
  const { homePayload } = await import("./catalog.server");
  return homePayload();
});

export const loadRanking = createServerFn({ method: "GET" }).handler(async () => {
  const { rankingPayload } = await import("./catalog.server");
  return rankingPayload();
});

export const loadCompany = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data }) => {
    const { companyPayload } = await import("./catalog.server");
    return companyPayload(data);
  });

export const loadMovements = createServerFn({ method: "GET" }).handler(async () => {
  const { movementsPayload } = await import("./catalog.server");
  return movementsPayload();
});

export const loadMysteries = createServerFn({ method: "GET" }).handler(async () => {
  const { mysteriesPayload } = await import("./catalog.server");
  return mysteriesPayload();
});

export const loadGraph = createServerFn({ method: "GET" }).handler(async () => {
  const { graphPayload } = await import("./catalog.server");
  return graphPayload();
});

export const loadWatchlist = createServerFn({ method: "GET" }).handler(async () => {
  const { watchlistPayload } = await import("./catalog.server");
  return watchlistPayload();
});

export const loadMethod = createServerFn({ method: "GET" }).handler(async () => {
  const { getMeta } = await import("./catalog.server");
  return getMeta();
});

export const loadProject = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data }) => {
    const { projectPayload } = await import("./catalog.server");
    return projectPayload(data);
  });

export const searchCompanies = createServerFn({ method: "GET" })
  .validator((query: string) => query)
  .handler(async ({ data }) => {
    const { searchCompanies: run } = await import("./catalog.server");
    return run(data.slice(0, 60));
  });
