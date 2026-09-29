// [LAW:parse-dont-validate] the one place a thrown `unknown` becomes a string a person can read.
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
