// ===========================================================================
// Widget Templates — Pre-configured widget templates for common use cases
// ===========================================================================

window.WidgetTemplates = (function () {
  'use strict';

  const TEMPLATES = {
    // ===== Metric Display Templates =====
    'cpu-usage-gauge': {
      name: 'CPU Usage Gauge',
      category: 'System Metrics',
      icon: '⏲️',
      description: 'CPU utilization percentage gauge',
      config: {
        type: 'gauge',
        title: 'CPU Usage',
        source: 'gcp',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
        min: 0,
        max: 100,
        unit: '%'
      }
    },

    'memory-usage-gauge': {
      name: 'Memory Usage Gauge',
      category: 'System Metrics',
      icon: '⏲️',
      description: 'Memory utilization gauge',
      config: {
        type: 'gauge',
        title: 'Memory Usage',
        source: 'gcp',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
        min: 0,
        max: 100,
        unit: '%'
      }
    },

    'request-rate': {
      name: 'Request Rate',
      category: 'Traffic Metrics',
      icon: '📊',
      description: 'Requests per second counter',
      config: {
        type: 'big-number',
        title: 'Request Rate',
        source: 'gcp',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 },
        unit: 'req/s'
      }
    },

    'error-rate': {
      name: 'Error Rate',
      category: 'Traffic Metrics',
      icon: '⚠️',
      description: 'Error rate percentage',
      config: {
        type: 'gauge',
        title: 'Error Rate',
        source: 'gcp',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
        min: 0,
        max: 5,
        unit: '%'
      }
    },

    'latency-p50': {
      name: 'Latency P50',
      category: 'Performance',
      icon: '⚡',
      description: '50th percentile latency',
      config: {
        type: 'stat-card',
        title: 'Latency P50',
        source: 'gcp',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 },
        unit: 'ms'
      }
    },

    'latency-p99': {
      name: 'Latency P99',
      category: 'Performance',
      icon: '⚡',
      description: '99th percentile latency',
      config: {
        type: 'stat-card',
        title: 'Latency P99',
        source: 'gcp',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 },
        unit: 'ms'
      }
    },

    // ===== Business Metrics =====
    'total-users': {
      name: 'Total Users',
      category: 'Business Metrics',
      icon: '👥',
      description: 'Total user count',
      config: {
        type: 'big-number',
        title: 'Total Users',
        source: 'salesforce',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 }
      }
    },

    'revenue-today': {
      name: 'Revenue Today',
      category: 'Business Metrics',
      icon: '💰',
      description: 'Daily revenue counter',
      config: {
        type: 'big-number',
        title: 'Revenue Today',
        source: 'salesforce',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 },
        unit: '$'
      }
    },

    'conversion-rate': {
      name: 'Conversion Rate',
      category: 'Business Metrics',
      icon: '🎯',
      description: 'Conversion rate percentage',
      config: {
        type: 'gauge',
        title: 'Conversion Rate',
        source: 'salesforce',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
        min: 0,
        max: 100,
        unit: '%'
      }
    },

    // ===== Cloud Infrastructure =====
    'cloud-run-services': {
      name: 'Cloud Run Services',
      category: 'Infrastructure',
      icon: '🔲',
      description: 'Cloud Run service status grid',
      config: {
        type: 'status-grid',
        title: 'Cloud Run Services',
        source: 'gcp',
        position: { col: 1, row: 1, colSpan: 4, rowSpan: 3 }
      }
    },

    'bigquery-slots': {
      name: 'BigQuery Slots',
      category: 'Infrastructure',
      icon: '📊',
      description: 'BigQuery slot usage',
      config: {
        type: 'gauge',
        title: 'BigQuery Slots',
        source: 'gcp',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
        min: 0,
        max: 2000
      }
    },

    'pubsub-backlog': {
      name: 'Pub/Sub Backlog',
      category: 'Infrastructure',
      icon: '📈',
      description: 'Undelivered message count',
      config: {
        type: 'big-number',
        title: 'Pub/Sub Backlog',
        source: 'gcp',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 }
      }
    },

    // ===== Security & Compliance =====
    'security-score': {
      name: 'Security Score',
      category: 'Security',
      icon: '🛡️',
      description: 'Overall security posture score',
      config: {
        type: 'security-scorecard',
        title: 'Security Posture',
        source: 'vulntrack',
        position: { col: 1, row: 1, colSpan: 6, rowSpan: 4 }
      }
    },

    'critical-vulnerabilities': {
      name: 'Critical Vulnerabilities',
      category: 'Security',
      icon: '🔴',
      description: 'Count of critical severity issues',
      config: {
        type: 'big-number',
        title: 'Critical Vulnerabilities',
        source: 'vulntrack',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 }
      }
    },

    'vulnerabilities-by-severity': {
      name: 'Vulnerabilities by Severity',
      category: 'Security',
      icon: '📊',
      description: 'Vulnerability breakdown chart',
      config: {
        type: 'bar-chart',
        title: 'Vulnerabilities by Severity',
        source: 'vulntrack',
        position: { col: 1, row: 1, colSpan: 3, rowSpan: 2 }
      }
    },

    // ===== User Experience =====
    'active-sessions': {
      name: 'Active Sessions',
      category: 'User Experience',
      icon: '👤',
      description: 'Current active user sessions',
      config: {
        type: 'big-number',
        title: 'Active Sessions',
        source: 'fullstory',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 }
      }
    },

    'page-load-time': {
      name: 'Page Load Time',
      category: 'User Experience',
      icon: '⚡',
      description: 'Average page load time',
      config: {
        type: 'stat-card',
        title: 'Page Load Time',
        source: 'hotjar',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 },
        unit: 'ms'
      }
    },

    'rage-clicks': {
      name: 'Rage Clicks',
      category: 'User Experience',
      icon: '😡',
      description: 'Frustrated user interactions',
      config: {
        type: 'big-number',
        title: 'Rage Clicks',
        source: 'fullstory',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 }
      }
    },

    // ===== Support & Tickets =====
    'open-tickets': {
      name: 'Open Tickets',
      category: 'Support',
      icon: '🎫',
      description: 'Current open support tickets',
      config: {
        type: 'big-number',
        title: 'Open Tickets',
        source: 'zendesk',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 }
      }
    },

    'avg-response-time': {
      name: 'Avg Response Time',
      category: 'Support',
      icon: '⏱️',
      description: 'Average ticket response time',
      config: {
        type: 'stat-card',
        title: 'Avg Response Time',
        source: 'zendesk',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 },
        unit: 'hrs'
      }
    },

    'customer-satisfaction': {
      name: 'Customer Satisfaction',
      category: 'Support',
      icon: '😊',
      description: 'Customer satisfaction score',
      config: {
        type: 'gauge',
        title: 'Customer Satisfaction',
        source: 'zendesk',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
        min: 0,
        max: 100,
        unit: '%'
      }
    },

    // ===== Data & Analytics =====
    'data-pipeline-flow': {
      name: 'Data Pipeline',
      category: 'Data & Analytics',
      icon: '⚙️',
      description: 'Data pipeline stages visualization',
      config: {
        type: 'pipeline-flow',
        title: 'Data Pipeline',
        source: 'gcp',
        position: { col: 1, row: 1, colSpan: 6, rowSpan: 2 }
      }
    },

    'elasticsearch-docs': {
      name: 'Elasticsearch Documents',
      category: 'Data & Analytics',
      icon: '📄',
      description: 'Total document count',
      config: {
        type: 'big-number',
        title: 'Total Documents',
        source: 'elasticsearch',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 }
      }
    },

    'index-size': {
      name: 'Index Size',
      category: 'Data & Analytics',
      icon: '💾',
      description: 'Elasticsearch index size',
      config: {
        type: 'stat-card',
        title: 'Index Size',
        source: 'elasticsearch',
        position: { col: 1, row: 1, colSpan: 2, rowSpan: 1 },
        unit: 'GB'
      }
    },

    // ===== Geographic =====
    'usa-traffic-map': {
      name: 'USA Traffic Map',
      category: 'Geographic',
      icon: '🗺️',
      description: 'US traffic distribution map',
      config: {
        type: 'usa-map',
        title: 'Geographic Distribution',
        source: 'gcp',
        position: { col: 1, row: 1, colSpan: 6, rowSpan: 4 }
      }
    }
  };

  /**
   * Get all templates
   */
  function getAllTemplates() {
    return Object.entries(TEMPLATES).map(([id, template]) => ({
      id,
      ...template
    }));
  }

  /**
   * Get templates by category
   */
  function getTemplatesByCategory() {
    const byCategory = {};

    Object.entries(TEMPLATES).forEach(([id, template]) => {
      const category = template.category || 'Other';
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push({ id, ...template });
    });

    return byCategory;
  }

  /**
   * Get template by ID
   */
  function getTemplate(id) {
    return TEMPLATES[id] ? { id, ...TEMPLATES[id] } : null;
  }

  /**
   * Get template categories
   */
  function getCategories() {
    const categories = new Set();
    Object.values(TEMPLATES).forEach(template => {
      categories.add(template.category || 'Other');
    });
    return Array.from(categories).sort();
  }

  // Export public API
  return {
    getAllTemplates,
    getTemplatesByCategory,
    getTemplate,
    getCategories,
    TEMPLATES
  };
})();
