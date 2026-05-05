export class DeepCheckOptedOutError extends Error {
  constructor() {
    super('Deep Check is disabled');
    this.name = 'DeepCheckOptedOutError';
  }
}

export class DeepCheckRateLimitedError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`Deep Check rate limited. Retry in ${retryAfterMs}ms`);
    this.name = 'DeepCheckRateLimitedError';
  }
}

export class DeepCheckAuthError extends Error {
  constructor(message = 'Deep Check authorization failed') {
    super(message);
    this.name = 'DeepCheckAuthError';
  }
}
