// Loads apps/worker/.env explicitly (unlike apps/web, this is a plain Node
// process with no framework-level .env loading). Import this before
// anything that reads process.env. Safe to skip in production, where env
// vars are injected by the platform instead of a .env file.
try {
  process.loadEnvFile();
} catch {
  // no .env file present — fine, env vars are expected to be set externally.
}
