export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CartPilot': '1' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal,
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      'The server returned an unexpected response. Please retry.',
    );
  }
  if (!response.ok)
    throw new Error(
      typeof result?.error === 'string'
        ? result.error
        : 'The request could not be completed. Please retry.',
    );
  return result as T;
}
