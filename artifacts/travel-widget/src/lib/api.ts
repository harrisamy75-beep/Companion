export type GetToken = () => Promise<string | null>;

let tokenGetter: GetToken | null = null;

export function setApiTokenGetter(getter: GetToken | null) {
  tokenGetter = getter;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = tokenGetter ? await tokenGetter() : null;
  const headers = new Headers(options.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (
    options.body !== undefined &&
    !headers.has("Content-Type") &&
    typeof options.body === "string"
  ) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });
}
