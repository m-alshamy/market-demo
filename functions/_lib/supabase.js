// يعادل supabase_get_user و supabase_service_request في server.py

const TIMEOUT_MS = 10_000;

export async function getUser(env, accessToken) {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// طلب بصلاحية service_role (من الخادم فقط، لا يصل للمتصفح أبداً)
export async function serviceRequest(env, method, path, body) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${env.SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const raw = await res.text();
  if (!res.ok) {
    const err = new Error(`Supabase ${res.status}: ${raw}`);
    err.status = res.status;
    throw err;
  }
  return raw ? JSON.parse(raw) : null;
}

export async function getBalance(env, userId) {
  try {
    const rows = await serviceRequest(
      env,
      "GET",
      `/rest/v1/wallet?user_id=eq.${encodeURIComponent(userId)}&select=balance`
    );
    return rows && rows.length ? rows[0].balance : 0;
  } catch {
    return null;
  }
}
