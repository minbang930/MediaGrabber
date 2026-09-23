export const DEFAULT_MAX_CHUNKS_PER_FRAGMENT = 256;
export const DEFAULT_MAX_PENDING_FRAGMENTS = 64;
export const CAPTURE_SESSION_RE = /^[A-Za-z0-9_-]{1,96}$/;

export function assertCaptureSessionId(sessionId: string): void {
  if (!CAPTURE_SESSION_RE.test(sessionId)) {
    throw new Error('Invalid MSE capture session id');
  }
}

export interface OrderedFragmentWriterOptions {
  maxChunksPerFragment?: number;
  maxPendingFragments?: number;
}

interface PendingFragment {
  chunkCount: number;
  receivedCount: number;
  chunks: Array<Buffer | undefined>;
}

export class OrderedFragmentWriter {
  private nextFragment = 0;
  private readonly pending = new Map<number, PendingFragment>();
  private readonly maxChunksPerFragment: number;
  private readonly maxPendingFragments: number;
  private writtenBytes = 0;

  constructor(
    private readonly writeChunk: (chunk: Buffer) => void,
    options: OrderedFragmentWriterOptions = {}
  ) {
    this.maxChunksPerFragment =
      options.maxChunksPerFragment ?? DEFAULT_MAX_CHUNKS_PER_FRAGMENT;
    this.maxPendingFragments =
      options.maxPendingFragments ?? DEFAULT_MAX_PENDING_FRAGMENTS;
  }

  get bytes(): number {
    return this.writtenBytes;
  }

  get pendingFragmentCount(): number {
    return this.pending.size;
  }

  append(
    fragmentIndex: number,
    chunkIndex: number,
    chunkCount: number,
    chunk: Buffer
  ): { duplicate: boolean; bytes: number } {
    if (!Number.isInteger(fragmentIndex) || fragmentIndex < 0) {
      throw new Error('Invalid MSE fragment index');
    }
    if (
      !Number.isInteger(chunkCount) ||
      chunkCount < 1 ||
      chunkCount > this.maxChunksPerFragment ||
      !Number.isInteger(chunkIndex) ||
      chunkIndex < 0 ||
      chunkIndex >= chunkCount
    ) {
      throw new Error('Invalid MSE capture chunk index');
    }

    if (fragmentIndex < this.nextFragment) {
      return { duplicate: true, bytes: this.writtenBytes };
    }

    let fragment = this.pending.get(fragmentIndex);
    if (!fragment) {
      if (this.pending.size >= this.maxPendingFragments) {
        throw new Error('Too many pending MSE capture fragments');
      }
      fragment = {
        chunkCount,
        receivedCount: 0,
        chunks: new Array(chunkCount).fill(undefined)
      };
      this.pending.set(fragmentIndex, fragment);
    }

    if (fragment.chunkCount !== chunkCount) {
      throw new Error('MSE capture chunk count changed within fragment');
    }

    if (fragment.chunks[chunkIndex]) {
      return { duplicate: true, bytes: this.writtenBytes };
    }

    fragment.chunks[chunkIndex] = chunk;
    fragment.receivedCount++;
    this.flushReadyFragments();

    return { duplicate: false, bytes: this.writtenBytes };
  }

  finish(): void {
    this.flushReadyFragments();
    if (this.pending.size > 0) {
      throw new Error('MSE capture ended with incomplete fragments');
    }
  }

  private flushReadyFragments(): void {
    while (true) {
      const fragment = this.pending.get(this.nextFragment);
      if (!fragment || fragment.receivedCount !== fragment.chunkCount) return;

      for (let index = 0; index < fragment.chunkCount; index++) {
        const chunk = fragment.chunks[index];
        if (!chunk) {
          throw new Error('MSE capture fragment completeness invariant failed');
        }
        this.writeChunk(chunk);
        this.writtenBytes += chunk.length;
      }

      this.pending.delete(this.nextFragment);
      this.nextFragment++;
    }
  }
}
