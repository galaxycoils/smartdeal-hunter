import { GENOME_DIMENSIONS, type Genome, GENOME_VERSION_CURRENT } from './types';
import { getEncryptedItem, setEncryptedItem, deleteItem } from './storage';
import { GenomeStaleError } from './errors/genome-errors';

export const GENOME_DB_KEY = 'genome:v1';
export const GENOME_STORE = 'genome';
export { GenomeStaleError } from './errors/genome-errors';

function withRevision(g: Genome): Genome {
  if (g.revision === undefined) {
    return { ...g, revision: 1 };
  }
  return g;
}

export function defaultGenome(now = Date.now): Genome {
  const dimensions = {} as Genome['dimensions'];
  const bandit = { pulls: {}, rewards: {} } as Genome['bandit'];
  const weight = 1 / GENOME_DIMENSIONS.length;

  for (const dim of GENOME_DIMENSIONS) {
    dimensions[dim] = { value: 0.5, weight };
    bandit.pulls[dim] = 0;
    bandit.rewards[dim] = 0;
  }

  const ts = now();
  return {
    version: GENOME_VERSION_CURRENT,
    revision: 1,
    isOnboarded: false,
    dimensions,
    bandit,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function validateGenome(g: unknown): g is Genome {
  if (!g || typeof g !== 'object') return false;

  const gen = g as Partial<Genome>;
  if (gen.version !== GENOME_VERSION_CURRENT) return false;
  if (typeof gen.isOnboarded !== 'boolean') return false;
  if (!gen.dimensions || typeof gen.dimensions !== 'object') return false;
  if (!gen.bandit || !gen.bandit.pulls || !gen.bandit.rewards) return false;
  if (typeof gen.createdAt !== 'number') return false;
  if (typeof gen.updatedAt !== 'number') return false;
  if (
    gen.revision !== undefined &&
    (typeof gen.revision !== 'number' || !Number.isInteger(gen.revision) || gen.revision < 1)
  ) {
    return false;
  }

  let weightSum = 0;
  for (const dim of GENOME_DIMENSIONS) {
    const dimState = gen.dimensions[dim];
    if (!dimState) return false;
    if (typeof dimState.value !== 'number' || dimState.value < 0 || dimState.value > 1)
      return false;
    if (typeof dimState.weight !== 'number' || dimState.weight < 0) return false;
    weightSum += dimState.weight;

    if (typeof gen.bandit.pulls[dim] !== 'number') return false;
    if (typeof gen.bandit.rewards[dim] !== 'number') return false;
  }

  if (Math.abs(weightSum - 1.0) > 0.0001) return false;

  return true;
}

export function clipAndRenormalize(g: Genome): Genome {
  const out = JSON.parse(JSON.stringify(g)) as Genome;
  let weightSum = 0;

  for (const dim of GENOME_DIMENSIONS) {
    // clamp values
    out.dimensions[dim].value = Math.max(0, Math.min(1, out.dimensions[dim].value));

    // clamp weights > 0
    out.dimensions[dim].weight = Math.max(0, out.dimensions[dim].weight);
    weightSum += out.dimensions[dim].weight;
  }

  // Renormalize weights
  if (weightSum > 0) {
    for (const dim of GENOME_DIMENSIONS) {
      out.dimensions[dim].weight /= weightSum;
    }
  } else {
    // If all weights are 0, distribute evenly
    const even = 1.0 / GENOME_DIMENSIONS.length;
    for (const dim of GENOME_DIMENSIONS) {
      out.dimensions[dim].weight = even;
    }
  }

  return out;
}

export async function loadGenome(key: CryptoKey, now = Date.now): Promise<Genome> {
  const data = await getEncryptedItem<unknown>(GENOME_STORE, GENOME_DB_KEY, key);

  if (data === undefined) {
    return defaultGenome(now);
  }

  if (!validateGenome(data)) {
    throw new Error('Genome validation failed during load');
  }

  return withRevision(data);
}

export async function saveGenome(
  g: Genome,
  key: CryptoKey,
  opts?: { now?: () => number; expectedRevision?: number },
): Promise<void> {
  const now = opts?.now ?? Date.now;
  const existing = await getEncryptedItem<unknown>(GENOME_STORE, GENOME_DB_KEY, key);

  if (existing !== undefined && !validateGenome(existing)) {
    throw new Error('Genome validation failed during save');
  }

  const current = existing === undefined ? undefined : withRevision(existing);

  if (opts?.expectedRevision !== undefined) {
    const actualRevision = current?.revision ?? 0;
    if (actualRevision !== opts.expectedRevision) {
      throw new GenomeStaleError(opts.expectedRevision, actualRevision);
    }
  }

  const nextRevision = current?.revision === undefined ? 1 : current.revision + 1;
  const nextGenome = {
    ...g,
    revision: nextRevision,
    updatedAt: now(),
  };

  await setEncryptedItem(GENOME_STORE, GENOME_DB_KEY, nextGenome, key);
  await chrome.storage.local.set({ 'sdh:genome-revision': nextRevision });
}

export async function wipeGenome(): Promise<void> {
  await deleteItem(GENOME_STORE, GENOME_DB_KEY);
}

export function onGenomeChange(cb: (revision: number) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local') return;
    const change = changes['sdh:genome-revision'];
    if (typeof change?.newValue === 'number') {
      cb(change.newValue);
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
