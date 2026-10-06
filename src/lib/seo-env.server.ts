/** Runtime deployment env (Vercel system env). Anything but production is noindex. */
export function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === "production";
}
