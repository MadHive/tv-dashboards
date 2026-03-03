// server/data-source-env-map.js
export const ENV_MAP = {
  datadog: {
    DATADOG_API_KEY: { secure: true  },
    DATADOG_APP_KEY: { secure: true  },
    DD_SITE:         { secure: false },
  },
  aws: {
    AWS_ACCESS_KEY_ID:     { secure: true  },
    AWS_SECRET_ACCESS_KEY: { secure: true  },
    AWS_REGION:            { secure: false },
  },
  vulntrack: {
    VULNTRACK_API_URL: { secure: false },
    VULNTRACK_API_KEY: { secure: true  },
  },
  elasticsearch: {
    // Aligned to getConfigSchema() in server/data-sources/elasticsearch.js
    ELASTICSEARCH_HOST:     { secure: false }, // was ELASTICSEARCH_URL (wrong name)
    ELASTICSEARCH_API_KEY:  { secure: true  },
    ELASTICSEARCH_USERNAME: { secure: false }, // added — schema field
    ELASTICSEARCH_PASSWORD: { secure: true  }, // added — schema field
  },
  salesforce: {
    // Aligned to getConfigSchema() in server/data-sources/salesforce.js
    SALESFORCE_INSTANCE_URL:  { secure: false },
    SALESFORCE_SANDBOX:       { secure: false }, // added — schema field (isSandbox)
    SALESFORCE_ACCESS_TOKEN:  { secure: true  }, // added — schema field
    SALESFORCE_CLIENT_ID:     { secure: true  }, // corrected secure flag (was false)
    SALESFORCE_CLIENT_SECRET: { secure: true  },
    SALESFORCE_USERNAME:      { secure: false },
    SALESFORCE_PASSWORD:      { secure: true  },
    SALESFORCE_SECURITY_TOKEN: { secure: true }, // added — schema field
  },
  bigquery: {
    // Aligned to getConfigSchema() in server/data-sources/bigquery.js
    GOOGLE_APPLICATION_CREDENTIALS: { secure: true }, // added — only envVar in schema
  },
  checkly: {
    CHECKLY_API_KEY:    { secure: true  },
    CHECKLY_ACCOUNT_ID: { secure: false },
  },
  hotjar: {
    HOTJAR_SITE_ID: { secure: false },
    HOTJAR_API_KEY: { secure: true  },
  },
  fullstory: {
    FULLSTORY_API_KEY: { secure: true  },
    FULLSTORY_ORG_ID:  { secure: false },
  },
  zendesk: {
    ZENDESK_SUBDOMAIN: { secure: false },
    ZENDESK_EMAIL:     { secure: false },
    ZENDESK_API_TOKEN: { secure: true  },
  },
  looker: {
    LOOKER_BASE_URL:      { secure: false },
    LOOKER_CLIENT_ID:     { secure: false },
    LOOKER_CLIENT_SECRET: { secure: true  },
  },
  rollbar: {
    // Aligned to getConfigSchema() in server/data-sources/rollbar.js
    ROLLBAR_ACCESS_TOKEN: { secure: true  }, // kept
    ROLLBAR_PROJECT_ID:   { secure: false }, // was ROLLBAR_ACCOUNT_TOKEN (wrong name)
  },
  rootly: {
    ROOTLY_API_KEY: { secure: true },
  },
  segment: {
    // Aligned to getConfigSchema() in server/data-sources/segment.js
    SEGMENT_ACCESS_TOKEN: { secure: true  }, // was SEGMENT_WRITE_KEY (wrong name)
    SEGMENT_WORKSPACE_ID: { secure: false }, // kept
  },
  chromatic: {
    CHROMATIC_PROJECT_TOKEN: { secure: true  },
    CHROMATIC_APP_ID:        { secure: false },
  },
};

export function getAllowedKeys(sourceName) {
  const entry = ENV_MAP[sourceName];
  return entry ? Object.keys(entry) : null;
}

export function isSecure(sourceName, key) {
  return Boolean(ENV_MAP[sourceName]?.[key]?.secure);
}
