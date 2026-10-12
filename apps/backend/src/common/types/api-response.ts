export interface ApiResponse<T = Record<string, unknown>> {
  success: boolean;
  message: string;
  data: T;
}
