import { z } from 'zod'

// ============================================================
// AI Provider Abstraction
// Supports OpenAI-compatible APIs. Configure via AI_PROVIDER_API_KEY and AI_MODEL.
// If unconfigured, returns errors — never fabricates results.
// ============================================================

const API_KEY = process.env.AI_PROVIDER_API_KEY
const MODEL = process.env.AI_MODEL ?? 'gpt-4o'
const API_BASE = process.env.AI_API_BASE ?? 'https://api.openai.com/v1'

export class AIProviderError extends Error {
  constructor(
    message: string,
    public code: 'UNCONFIGURED' | 'TIMEOUT' | 'RATE_LIMIT' | 'INVALID_RESPONSE' | 'API_ERROR'
  ) {
    super(message)
    this.name = 'AIProviderError'
  }
}

function isConfigured(): boolean {
  return !!API_KEY
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface CompletionOptions {
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  retries?: number
}

async function chatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<string> {
  if (!isConfigured()) {
    throw new AIProviderError(
      'AI provider is not configured. Set AI_PROVIDER_API_KEY in environment variables.',
      'UNCONFIGURED'
    )
  }

  const { temperature = 0.1, maxTokens = 2048, timeoutMs = 45000, retries = 2 } = options
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (response.status === 429) {
        // Rate limit — wait before retry
        const retryAfter = parseInt(response.headers.get('retry-after') ?? '5') * 1000
        await new Promise(r => setTimeout(r, retryAfter))
        throw new AIProviderError('Rate limited', 'RATE_LIMIT')
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new AIProviderError(
          `API returned ${response.status}: ${errorBody.error?.message ?? 'Unknown error'}`,
          'API_ERROR'
        )
      }

      const result = await response.json()
      const content = result.choices?.[0]?.message?.content
      if (!content) {
        throw new AIProviderError('Empty response from AI provider', 'INVALID_RESPONSE')
      }

      return content
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new AIProviderError('AI request timed out', 'TIMEOUT')
      } else if (err instanceof AIProviderError) {
        if (err.code === 'RATE_LIMIT' && attempt < retries) {
          lastError = err
          continue
        }
        throw err
      } else {
        lastError = err instanceof Error ? err : new Error(String(err))
      }
    }
  }

  throw lastError ?? new AIProviderError('AI request failed after retries', 'API_ERROR')
}

// ============================================================
// Structured extraction with Zod validation
// ============================================================

export async function extractStructured<T>(
  systemPrompt: string,
  userContent: string,
  schema: z.ZodSchema<T>,
  options?: CompletionOptions
): Promise<T> {
  const rawResponse = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ], options)

  let parsed: unknown
  try {
    parsed = JSON.parse(rawResponse)
  } catch {
    throw new AIProviderError(
      'AI returned malformed JSON — cannot safely process',
      'INVALID_RESPONSE'
    )
  }

  const validated = schema.safeParse(parsed)
  if (!validated.success) {
    throw new AIProviderError(
      `AI response failed schema validation: ${validated.error.message}`,
      'INVALID_RESPONSE'
    )
  }

  return validated.data
}

// ============================================================
// Clinical extraction prompts
// ============================================================

export const SYSTEM_PROMPTS = {
  documentClassifier: `You are a clinical document classifier. Classify the document type and extract basic metadata.
Never invent information not present in the document. If information is missing, indicate unknown.
Return valid JSON only.`,

  statementExtractor: `You are a clinical statement extractor. Extract atomic factual claims from medical text.
For each claim, assess evidence status: verified/supported/uncertain/conflicting/missing_evidence/superseded.
Link every claim to its exact source text and page. Never invent facts.
Return valid JSON only.`,

  timelineReconstructor: `You are a clinical timeline agent. Extract and reconstruct chronological events.
Distinguish between clinical event time and documentation time.
Flag backdated entries, gaps, and date uncertainties. Never invent dates.
Return valid JSON only.`,

  medicationReconciler: `You are a medication reconciliation agent. Extract medication information and track lifecycle.
Never assume the most recent document is correct. Flag conflicts and undocumented changes.
Medication states: prescribed/started/continued/modified/discontinued/uncertain/conflicting.
Return valid JSON only.`,

  contradictionDetector: `You are a clinical contradiction detector. Identify statements that conflict across documents.
Assess severity: low/medium/high/critical. Never silently resolve — flag all conflicts.
Return valid JSON only.`,

  safetyGate: `You are a clinical safety assessor. Evaluate evidence completeness and identify blocking issues.
Safety gate states: GREEN (proceed), YELLOW (qualify), RED (escalate/block).
Never override RED based on assumption. The safety gate protects patients.
Return valid JSON only.`,
}

export { isConfigured, chatCompletion }
