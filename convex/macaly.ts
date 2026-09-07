// NOTE: This file was specific to the Macaly hosting platform.
// It called Macaly's internal AI proxy endpoint using platform-only
// environment variables (MACALY_API_TOKEN, MACALY_BASE_URL, MACALY_CHAT_ID).
// Outside of Macaly, replace callMacalyJson() calls in recipes.ts and
// drinks.ts with direct calls to the Anthropic API (see README.md).

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export async function callMacalyJson(
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  throw new Error(
    "callMacalyJson is a Macaly-platform-only helper. Replace this with a direct Anthropic API call before running outside Macaly."
  )
}
