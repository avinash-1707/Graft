export const WIDGET_SESSION_STORAGE_KEY = 'graft:session-id' as const;

export const MIN_MESSAGE_SEQUENCE = 1 as const;

export const SWITCH_TO_HUMAN_COPY = 'You are now talking to a human agent.' as const;
export const SWITCH_TO_AI_COPY = 'You are now talking to an AI agent.' as const;

/** Widget header status line — persistent label for the active responder. */
export const WIDGET_AI_STATUS_COPY = 'Talking to an AI agent' as const;
export const WIDGET_HUMAN_STATUS_COPY = 'Talking to a human agent' as const;

export const DEFAULT_GROUNDING_THRESHOLD = 0.7 as const;
export const DEFAULT_HUMAN_REQUEST_COUNT_TO_ESCALATE = 3 as const;
/** Min classifier confidence for a NEGATIVE label to fire the sentiment trigger. */
export const DEFAULT_NEGATIVE_SENTIMENT_THRESHOLD = 0.7 as const;
/** Min classifier confidence for a detected human request to count toward escalation. */
export const DEFAULT_HUMAN_REQUEST_CONFIDENCE_THRESHOLD = 0.7 as const;

/** Default widget bot name + greeting shown until the tenant customizes them. */
export const DEFAULT_WIDGET_BOT_NAME = 'Support' as const;
export const DEFAULT_WIDGET_GREETING = 'Hi! How can we help you today?' as const;

export const SSE_EVENT_NAME = 'graft' as const;

/** Header carrying the per-org embed token on public widget requests. */
export const EMBED_TOKEN_HEADER = 'x-graft-embed-token' as const;
/** Header carrying the widget's localStorage session UUID on public widget requests. */
export const SESSION_HEADER = 'x-graft-session-id' as const;

// --- Billing & credits ----------------------------------------------------------
/**
 * Money is stored everywhere as an integer count of micro-USD (1 USD = 1e6 micro-USD)
 * to avoid float drift. Token prices are stored per **million tokens** (also micro-USD)
 * so even sub-cent-per-Mtok models keep integer precision.
 */
export const MICRO_USD_PER_USD = 1_000_000 as const;
export const TOKENS_PER_PRICE_UNIT = 1_000_000 as const;

/** Default platform markup over real OpenRouter cost, in basis points (2500 = 25%). */
export const DEFAULT_MARKUP_BPS = 2500 as const;

/** Below this remaining balance the dashboard surfaces a low-credits banner to the owner. */
export const LOW_BALANCE_THRESHOLD_MICRO_USD = 500_000 as const; // $0.50

/**
 * Rough average metered charge per AI turn, used only to render a friendly
 * "≈ N messages" estimate from a micro-USD balance. Not used for billing.
 */
export const ESTIMATED_CHARGE_PER_MESSAGE_MICRO_USD = 6_000 as const; // ~$0.006
