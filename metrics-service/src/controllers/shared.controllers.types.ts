export interface MetricsServiceResponse {
    code: number;
    error?: {
        message: string | null;
        code?: string | number | null;
    } | null;
    data?: {} | null;
}