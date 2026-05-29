export const WIDGET_SESSION_STORAGE_KEY = 'graft:session-id' as const;

export const MIN_MESSAGE_SEQUENCE = 1 as const;

export const SWITCH_TO_HUMAN_COPY = 'You are now talking to a human agent.' as const;
export const SWITCH_TO_AI_COPY = 'You are now talking to an AI agent.' as const;

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
