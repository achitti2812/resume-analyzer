/** @returns {{ port: number; corsOrigins: string[] }} */
export function getServerConfig() {
  const port = Number(process.env.PORT) || 9555;
  const corsOrigins = (
    process.env.CORS_ORIGIN ||
    "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { port, corsOrigins };
}
