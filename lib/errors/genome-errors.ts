export class GenomeStaleError extends Error {
  constructor(expectedRevision: number, actualRevision: number) {
    super(`Genome revision mismatch: expected ${expectedRevision}, found ${actualRevision}`);
    this.name = 'GenomeStaleError';
  }
}
