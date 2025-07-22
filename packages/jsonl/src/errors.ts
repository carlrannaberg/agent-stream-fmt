// Parse error types
// Placeholder implementation

export class ParseError extends Error {
  constructor(
    message: string,
    public line?: string,
    public vendor?: string,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}
