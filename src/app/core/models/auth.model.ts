// Matches AuthDtos.LoginRequest / TokenResponse in fluxcomenzi-api.
export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  token: string;
}
