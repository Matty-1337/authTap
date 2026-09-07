export function redirect(url: string): never {
  throw new Error(`UNEXPECTED_REDIRECT:${url}`);
}
