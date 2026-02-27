import type {
  DashboardConfig,
  WidgetData,
  Query,
  Schema,
  QueryResult,
} from '@/types/dashboard';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseUrl = '/api';

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ApiError(
        text || response.statusText,
        response.status,
        response.statusText
      );
    }

    return response.json();
  }

  // Dashboard methods
  async getDashboardConfig(id?: string): Promise<DashboardConfig> {
    const endpoint = id ? `/dashboards/${id}` : '/config';
    return this.request<DashboardConfig>(endpoint);
  }

  async updateDashboard(
    id: string,
    config: DashboardConfig
  ): Promise<void> {
    return this.request<void>(`/dashboards/${id}`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async saveDraft(config: DashboardConfig): Promise<void> {
    return this.request<void>('/dashboards/draft', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // Widget methods
  async getWidgetData(widgetId: string): Promise<WidgetData> {
    return this.request<WidgetData>(`/widgets/${widgetId}/data`);
  }

  // Query methods
  async getQueries(dataSource?: string): Promise<Query[]> {
    const endpoint = dataSource ? `/queries/${dataSource}` : '/queries';
    return this.request<Query[]>(endpoint);
  }

  async getQuery(dataSource: string, id: string): Promise<Query> {
    return this.request<Query>(`/queries/${dataSource}/${id}`);
  }

  async createQuery(dataSource: string, query: Omit<Query, 'id' | 'createdAt' | 'updatedAt'>): Promise<Query> {
    return this.request<Query>(`/queries/${dataSource}`, {
      method: 'POST',
      body: JSON.stringify(query),
    });
  }

  async updateQuery(dataSource: string, id: string, query: Partial<Query>): Promise<Query> {
    return this.request<Query>(`/queries/${dataSource}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(query),
    });
  }

  async deleteQuery(dataSource: string, id: string): Promise<void> {
    return this.request<void>(`/queries/${dataSource}/${id}`, {
      method: 'DELETE',
    });
  }

  // Data source methods
  async getSchema(dataSource: string): Promise<Schema> {
    return this.request<Schema>(`/${dataSource}/schema`);
  }

  async executeQuery(
    dataSource: string,
    sql: string,
    options?: { signal?: AbortSignal }
  ): Promise<QueryResult> {
    return this.request<QueryResult>(`/${dataSource}/execute`, {
      method: 'POST',
      body: JSON.stringify({ sql }),
      signal: options?.signal,
    });
  }
}

export const api = new ApiClient();
export { ApiError };
