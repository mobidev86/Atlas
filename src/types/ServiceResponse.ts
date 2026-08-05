export interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
}

export interface ServiceStatus {
  success: boolean;
  error: string | null;
}
