// ===========================================================================
// Admin API Client — Dashboard Management API Wrapper
// ===========================================================================

export class AdminAPI {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generic request handler with error handling
   */
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('[AdminAPI] Request failed:', error);
      throw error;
    }
  }

  // =========================================================================
  // Dashboard CRUD Operations
  // =========================================================================

  /**
   * List all dashboards
   * @returns {Promise<Array>} Array of dashboard summaries
   */
  async listDashboards() {
    return this.request('/api/dashboards');
  }

  /**
   * Get a single dashboard by ID
   * @param {string} id - Dashboard ID
   * @returns {Promise<Object>} Dashboard object
   */
  async getDashboard(id) {
    return this.request(`/api/dashboards/${id}`);
  }

  /**
   * Create a new dashboard
   * @param {Object} data - Dashboard data
   * @returns {Promise<Object>} Created dashboard
   */
  async createDashboard(data) {
    return this.request('/api/dashboards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing dashboard
   * @param {string} id - Dashboard ID
   * @param {Object} data - Updated dashboard data
   * @returns {Promise<Object>} Updated dashboard
   */
  async updateDashboard(id, data) {
    return this.request(`/api/dashboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a dashboard
   * @param {string} id - Dashboard ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteDashboard(id) {
    return this.request(`/api/dashboards/${id}`, {
      method: 'DELETE',
    });
  }

  // =========================================================================
  // Advanced Operations (to be implemented)
  // =========================================================================

  /**
   * Duplicate a dashboard
   * @param {string} id - Dashboard ID to duplicate
   * @returns {Promise<Object>} Duplicated dashboard
   */
  async duplicateDashboard(id) {
    return this.request(`/api/dashboards/${id}/duplicate`, {
      method: 'POST',
    });
  }

  /**
   * Reorder dashboards
   * @param {Array<string>} order - Array of dashboard IDs in new order
   * @returns {Promise<Array>} Updated dashboard list
   */
  async reorderDashboards(order) {
    return this.request('/api/dashboards/reorder', {
      method: 'POST',
      body: JSON.stringify({ order }),
    });
  }

  /**
   * Bulk delete dashboards
   * @param {Array<string>} ids - Array of dashboard IDs to delete
   * @returns {Promise<Object>} Deletion result
   */
  async bulkDelete(ids) {
    return this.request('/api/dashboards/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  /**
   * Get dashboard version history
   * @param {string} id - Dashboard ID
   * @returns {Promise<Array>} Version history
   */
  async getDashboardHistory(id) {
    return this.request(`/api/dashboards/${id}/history`);
  }

  /**
   * Restore a dashboard to a previous version
   * @param {string} id - Dashboard ID
   * @param {string} timestamp - Version timestamp to restore
   * @returns {Promise<Object>} Restored dashboard
   */
  async restoreDashboardVersion(id, timestamp) {
    return this.request(`/api/dashboards/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({ timestamp }),
    });
  }
}

// Default export for convenience
export default AdminAPI;
