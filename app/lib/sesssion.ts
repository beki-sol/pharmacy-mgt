import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

export async function getSessionId(): Promise<string> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get('session_id')?.value;
  if (!sessionId) {
    sessionId = randomUUID();
    // Cookie will be set in the API response, not here
  }
  return sessionId;
}

export function setSessionCookie(response: Response, sessionId: string): void {
  response.headers.append('Set-Cookie', `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`); // 1 week
}