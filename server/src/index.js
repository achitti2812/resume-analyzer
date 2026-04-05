import { app } from "./app.js";
import { getServerConfig } from "./config.js";

const { port } = getServerConfig();

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

server.on("error", (err) => {
  const code = /** @type {NodeJS.ErrnoException} */ (err).code;
  if (code === "EADDRINUSE") {
    const tryPort = port + 1;
    console.error(
      `Port ${port} is already in use.\n\n` +
        `Free it:\n` +
        `  lsof -nP -iTCP:${port} -sTCP:LISTEN\n` +
        `  kill <PID>\n\n` +
        `Or use another port:\n` +
        `  PORT=${tryPort} npm run dev`
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});
