export async function cookies(): Promise<never> {
  throw new Error("cookies() is not available in unit tests");
}
