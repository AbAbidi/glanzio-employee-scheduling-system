export type SessionUser = {
  id: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  status: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    isStudent: boolean;
    active: boolean;
  } | null;
};

export type AuthenticationResult = {
  accessToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresAt: string;
  user: SessionUser;
};

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";

let sessionRequest: Promise<AuthenticationResult | null> | null = null;

export function restoreSession(): Promise<AuthenticationResult | null> {
  sessionRequest ??= fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  }).then(async (response) =>
    response.ok ? ((await response.json()) as AuthenticationResult) : null,
  );

  return sessionRequest;
}

export function cacheSession(session: AuthenticationResult | null) {
  sessionRequest = Promise.resolve(session);
}

export function clearSessionCache() {
  sessionRequest = null;
}

export async function signOut(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } finally {
    cacheSession(null);
  }
}

export async function responseMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as
    | { message?: string | string[] }
    | null;
  const message = body?.message;

  if (Array.isArray(message)) {
    return message.join(" ");
  }

  return message ?? "Something went wrong. Please try again.";
}
