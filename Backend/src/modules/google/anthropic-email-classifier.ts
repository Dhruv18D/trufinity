import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';
import {
  EmailClassification,
  EmailClassifier,
  EmailClassifierInput,
  EmailClassificationValidationError,
  parseEmailClassification,
} from './email-classifier';

export const EMAIL_CLASSIFIER_SYSTEM_PROMPT = `Classify the supplied email using exactly one of these labels: complaint, billing_dispute, cancellation_intent, legal_or_regulatory_threat, damage_claim, escalation_request, none.
Return only valid JSON with exactly these fields: label, confidence, reason.
Confidence must be a number from 0 to 1. Reason must be one concise single-line explanation.
Do not add fields, recommendations, calculations, identifiers, routing, ownership, SLA, or customer data.`;

export interface AnthropicMessagesClient {
  messages: {
    create(request: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: 'user'; content: string }[];
    }): Promise<{ content: { type: string; text?: string }[] }>;
  };
}

export interface AnthropicEmailClassifierConfig {
  model: string;
  timeoutMs: number;
  maxRetries: number;
  promptVersion: string;
}

export class EmailClassifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailClassifierError';
  }
}

const RETRYABLE_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN']);

function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  const status = candidate.response?.status ?? candidate.status;
  return (typeof status === 'number' && (status === 408 || status === 429 || status >= 500))
    || (typeof candidate.code === 'string' && RETRYABLE_CODES.has(candidate.code));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function buildPrompt(input: EmailClassifierInput): string {
  return `Classify this email. Subject and body are transient input and must not be repeated outside the JSON result.\nSubject: ${JSON.stringify(input.subject)}\nBody: ${JSON.stringify(input.bodyText)}`;
}

export class AnthropicEmailClassifier implements EmailClassifier {
  constructor(
    private readonly client: AnthropicMessagesClient,
    private readonly config: AnthropicEmailClassifierConfig,
    private readonly waitFn: (milliseconds: number) => Promise<void> = wait,
  ) {
    if (!config.model || !Number.isFinite(config.timeoutMs) || config.timeoutMs <= 0 || !Number.isInteger(config.maxRetries) || config.maxRetries < 0 || config.maxRetries > 3 || !config.promptVersion) {
      throw new EmailClassifierError('Email classifier configuration is invalid.');
    }
  }

  async classify(input: EmailClassifierInput): Promise<EmailClassification> {
    if (!input || typeof input.subject !== 'string' || typeof input.bodyText !== 'string') {
      throw new EmailClassifierError('Email classifier input is invalid.');
    }
    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: 200,
          system: EMAIL_CLASSIFIER_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildPrompt(input) }],
        });
        const text = response.content.find((block) => block.type === 'text')?.text;
        if (!text) throw new EmailClassifierError('Email classifier returned invalid structured output.');
        let parsed: unknown;
        try { parsed = JSON.parse(text); } catch { throw new EmailClassifierError('Email classifier returned invalid structured output.'); }
        try { return parseEmailClassification(parsed); }
        catch (error) {
          if (error instanceof EmailClassificationValidationError) throw new EmailClassifierError('Email classifier returned invalid structured output.');
          throw error;
        }
      } catch (error) {
        if (error instanceof EmailClassifierError && error.message === 'Email classifier returned invalid structured output.') throw error;
        if (attempt < this.config.maxRetries && isRetryable(error)) {
          await this.waitFn(100 * 2 ** attempt);
          continue;
        }
        throw new EmailClassifierError('Email classifier provider request failed.');
      }
    }
  }
}

export class DisabledEmailClassifier implements EmailClassifier {
  classify(): Promise<never> {
    return Promise.reject(new EmailClassifierError('Email classifier is disabled or incomplete.'));
  }
}

export function createConfiguredEmailClassifier(): EmailClassifier {
  if (!env.GMAIL_CLASSIFIER_ENABLED || env.GMAIL_CLASSIFIER_PROVIDER !== 'anthropic' || !env.GMAIL_CLASSIFIER_MODEL || !env.ANTHROPIC_API_KEY || env.GMAIL_CLASSIFIER_CONFIDENCE_THRESHOLD === undefined) {
    return new DisabledEmailClassifier();
  }
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: env.GMAIL_CLASSIFIER_TIMEOUT_MS }) as unknown as AnthropicMessagesClient;
  return new AnthropicEmailClassifier(client, {
    model: env.GMAIL_CLASSIFIER_MODEL,
    timeoutMs: env.GMAIL_CLASSIFIER_TIMEOUT_MS,
    maxRetries: env.GMAIL_CLASSIFIER_MAX_RETRIES,
    promptVersion: env.GMAIL_CLASSIFIER_PROMPT_VERSION,
  });
}

export const emailClassifier = createConfiguredEmailClassifier();
