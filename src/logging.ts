export function redactQueryString(requestUrl: string | undefined): string | undefined {
  return requestUrl?.split('?', 1)[0];
}
