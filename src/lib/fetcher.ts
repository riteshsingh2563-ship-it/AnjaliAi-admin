export class ApiError extends Error {
  status: number;
  info: unknown;
  constructor(message: string, status: number, info: unknown) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const info = await res.json().catch(() => ({}));
    throw new ApiError((info as { error?: string })?.error ?? "Request failed", res.status, info);
  }
  return res.json();
}

export async function postJson<T = unknown>(url: string, body: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const info = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((info as { error?: string })?.error ?? "Request failed", res.status, info);
  }
  return info;
}
