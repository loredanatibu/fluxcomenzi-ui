// Matches AuthDtos.LoginRequest / TokenResponse in fluxcomenzi-api.
export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  token: string;
}
