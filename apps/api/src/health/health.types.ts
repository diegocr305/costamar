export type HealthStatus = 'ok' | 'degraded';

export interface ComponentHealth {
  status: 'up' | 'down';
  detail?: string;
}

export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  components: Record<string, ComponentHealth>;
}
