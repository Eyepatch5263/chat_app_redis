import "server-only"

export interface FirebaseServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

export type FirebaseServiceAccountResult =
  | { ok: true; serviceAccount: FirebaseServiceAccount }
  | { ok: false; reason: "missing" | "invalid-json" | "invalid-fields" }

function parseCandidate(value: string): unknown {
  let parsed: unknown = JSON.parse(value)
  // Some secret managers store the JSON document itself as a JSON string.
  if (typeof parsed === "string") parsed = JSON.parse(parsed)
  return parsed
}

function normalizeServiceAccount(value: unknown): FirebaseServiceAccount | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null

  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.project_id !== "string" ||
    typeof candidate.client_email !== "string" ||
    typeof candidate.private_key !== "string" ||
    !candidate.private_key.includes("-----BEGIN PRIVATE KEY-----")
  ) {
    return null
  }

  return {
    project_id: candidate.project_id,
    client_email: candidate.client_email,
    private_key: candidate.private_key.replace(/\\n/g, "\n"),
  }
}

export function readFirebaseServiceAccount(): FirebaseServiceAccountResult {
  const json = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim()
  const base64 = process.env.FCM_SERVICE_ACCOUNT_JSON_BASE64?.trim()
  if (!json && !base64) return { ok: false, reason: "missing" }

  let sawValidJson = false
  const candidates: string[] = []
  if (json) candidates.push(json)
  if (base64) {
    try {
      candidates.push(Buffer.from(base64, "base64").toString("utf8"))
    } catch {
      // The standard JSON path can still succeed if an unused base64 value is invalid.
    }
  }

  for (const candidate of candidates) {
    try {
      const parsed = parseCandidate(candidate)
      sawValidJson = true
      const serviceAccount = normalizeServiceAccount(parsed)
      if (serviceAccount) return { ok: true, serviceAccount }
    } catch {
      // Try the next supported representation without logging secret data.
    }
  }

  return {
    ok: false,
    reason: sawValidJson ? "invalid-fields" : "invalid-json",
  }
}

export function expectedFirebaseProjectId() {
  return process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
}
