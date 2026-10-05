import { createServerFn } from "@tanstack/react-start";

export const loadHome = createServerFn({ method: "GET" }).handler(async () => {
  const { homePayload } = await import("./catalog.server");
  return homePayload();
});

export const loadClassement = createServerFn({ method: "GET" }).handler(async () => {
  const { classementPayload } = await import("./catalog.server");
  return classementPayload();
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
