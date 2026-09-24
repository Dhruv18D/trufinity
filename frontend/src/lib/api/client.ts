const BASE_URL = process.env.BACKEND_API_URL ?? "http://localhost:3000";

interface ApiSuccess<T> {
  status: "success";
  data: T;
}

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { cache: "no-store" });
  } catch {
    throw new ApiError(`Backend unreachable at ${BASE_URL}`);
  }
  if (!res.ok) throw new ApiError(`GET ${path} failed with ${res.status}`, res.status);

  const body = (await res.json()) as ApiSuccess<T> | { status: string; message?: string };
  if (body.status !== "success" || !("data" in body)) {
    throw new ApiError(("message" in body && body.message) || `GET ${path} returned an unexpected response`);
  }
  return body.data;
}
