// ---------------------------------------------------------------------------
// Drizzle Kit Configuration — CLI tooling for schema management
// ---------------------------------------------------------------------------

/** @type {import('drizzle-kit').Config} */
export default {
  schema:    './server/db/schema.js',
  out:       './migrations',
  dialect:   'sqlite',
  dbCredentials: {
    url: './data/tv-dashboards.db',
  },
  verbose: true,
  strict:  true,
};
