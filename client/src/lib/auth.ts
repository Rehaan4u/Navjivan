const GOOGLE_TOKEN_KEY = "nj_google_token";
const ACCESS_CODE_KEY = "nj_access_code";

// TODO: replace with your live endpoint —
// aws apigatewayv2 get-apis --region ap-south-1 --query "Items[?Name=='navjivan-api'].ApiEndpoint" --output text
const API_BASE = "https://qlprgt28b3.execute-api.ap-south-1.amazonaws.com";

export function saveAuth(googleToken: string, accessCode: string) {
  localStorage.setItem(GOOGLE_TOKEN_KEY, googleToken);
  localStorage.setItem(ACCESS_CODE_KEY, accessCode);
}

export function getGoogleToken() {
  return localStorage.getItem(GOOGLE_TOKEN_KEY);
}

export function getAccessCode() {
  return localStorage.getItem(ACCESS_CODE_KEY);
}

export function clearAuth() {
  localStorage.removeItem(GOOGLE_TOKEN_KEY);
  localStorage.removeItem(ACCESS_CODE_KEY);
}

export function hasStoredAuth() {
  return !!getGoogleToken() && !!getAccessCode();
}

// Wraps every protected API call — attaches both headers automatically,
// and boots the user back to login if the token/code get rejected.
export async function authFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${getGoogleToken()}`,
      "x-access-code": getAccessCode() || "",
    },
  });

  if (res.status === 401) {
    clearAuth();
    window.location.reload();
    throw new Error("Session expired — please log in again");
  }
  return res;
}