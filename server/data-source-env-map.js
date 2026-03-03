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
    ELASTICSEARCH_URL:     { secure: false },
    ELASTICSEARCH_API_KEY: { secure: true  },
  },
  salesforce: {
    SALESFORCE_INSTANCE_URL:  { secure: false },
    SALESFORCE_CLIENT_ID:     { secure: false },
    SALESFORCE_CLIENT_SECRET: { secure: true  },
    SALESFORCE_USERNAME:      { secure: false },
    SALESFORCE_PASSWORD:      { secure: true  },
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
    ROLLBAR_ACCESS_TOKEN:  { secure: true },
    ROLLBAR_ACCOUNT_TOKEN: { secure: true },
  },
  rootly: {
    ROOTLY_API_KEY: { secure: true },
  },
  segment: {
    SEGMENT_WRITE_KEY:    { secure: true  },
    SEGMENT_WORKSPACE_ID: { secure: false },
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
