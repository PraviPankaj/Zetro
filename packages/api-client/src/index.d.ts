export class ZetroApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, detail: unknown, body: unknown);
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  must_change_password: boolean;
}

export interface CreateClientOptions {
  baseUrl?: string;
  getToken?: () => string | null;
}

export function createClient(options?: CreateClientOptions): any;
export default createClient;
