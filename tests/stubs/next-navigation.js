/** Stub de next/navigation para `node --test`. `redirect` lanza como lo hace Next. */

export function redirect(url) {
  const error = new Error("NEXT_REDIRECT");
  error.digest = `NEXT_REDIRECT;replace;${url};307;`;
  throw error;
}

export function permanentRedirect(url) {
  redirect(url);
}

export function notFound() {
  const error = new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  error.digest = "NEXT_HTTP_ERROR_FALLBACK;404";
  throw error;
}

export function usePathname() {
  return "/";
}

export function useRouter() {
  return { push() {}, replace() {}, back() {}, refresh() {} };
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}
