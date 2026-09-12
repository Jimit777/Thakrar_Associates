import { NextResponse } from "next/server";

/**
 * Temporary diagnostic for one question: does this deployment actually see
 * GEMINI_API_KEY at request time?
 *
 * Reports presence and length only — never the value itself, even though this
 * key has already appeared in plain text elsewhere. Delete this route once the
 * "not set" error is traced; it has no reason to exist afterwards.
 */
export async function GET() {
  const value = process.env.GEMINI_API_KEY;

  return NextResponse.json({
    hasKey: Boolean(value),
    length: value?.length ?? 0,
    // Google's dialog already showed this exact key in plain text once, so a
    // couple of characters costs nothing extra and confirms it's the right one.
    startsWith: value ? value.slice(0, 3) : null,
  });
}
