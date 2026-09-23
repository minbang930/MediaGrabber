// MSE append capture — receives explicit user-triggered fMP4 chunks from the extension.
// Chunks are written to temporary per-track files and never logged.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import rpc from './rpc';

interface PendingFragment {
  chunkCount: number;
  receivedCount: number;
  chunks: Array<Buffer | undefined>;
}

interface CaptureTrack {
  id: number;
  mime: string;
  filePath: string;
  bytes: number;
  nextFragment: number;
  pending: Map<number, PendingFragment>;
}

interface CaptureSession {
  id: string;
  dir: string;
  tracks: Map<number, CaptureTrack>;
}

const sessions = new Map<string, CaptureSession>();
const SESSION_RE = /^[A-Za-z0-9_-]{1,96}$/;
const MAX_TRACKS = 4;
const MAX_CHUNKS_PER_FRAGMENT = 256;
const MAX_PENDING_FRAGMENTS = 64;
const MAX_BASE64_CHUNK_LENGTH = 1024 * 1024;

function assertSessionId(sessionId: string): void {
  if (!SESSION_RE.test(sessionId)) {
    throw new Error('Invalid MSE capture session id');
  }
}

function getSession(sessionId: string): CaptureSession {
  assertSessionId(sessionId);
  const session = sessions.get(sessionId);
  if (!session) throw new Error('MSE capture session not found');
  return session;
}

function getTrack(session: CaptureSession, trackId: number, mime: string): CaptureTrack {
  if (!Number.isInteger(trackId) || trackId < 1 || trackId > MAX_TRACKS) {
    throw new Error('Invalid MSE capture track id');
  }

  let track = session.tracks.get(trackId);
  if (!track) {
    const safeMime = String(mime || '').toLowerCase();
    const extension = safeMime.includes('webm') ? 'webm' : 'mp4';
    track = {
      id: trackId,
      mime: safeMime,
      filePath: path.join(session.dir, `track-${trackId}.${extension}`),
      bytes: 0,
      nextFragment: 0,
      pending: new Map()
    };
    session.tracks.set(trackId, track);
  }

  return track;
}

function flushTrack(track: CaptureTrack): void {
  while (true) {
    const fragment = track.pending.get(track.nextFragment);
    if (!fragment || fragment.receivedCount !== fragment.chunkCount) return;

    for (let index = 0; index < fragment.chunkCount; index++) {
      const chunk = fragment.chunks[index];
      if (!chunk) {
        throw new Error('MSE capture fragment completeness invariant failed');
      }
      fs.appendFileSync(track.filePath, chunk);
      track.bytes += chunk.length;
    }
    track.pending.delete(track.nextFragment);
    track.nextFragment += 1;
  }
}

function cleanupSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  try {
    fs.rmSync(session.dir, { recursive: true, force: true });
  } catch {
    // Best-effort temporary-file cleanup.
  }
}

rpc.listen({
  'mseCapture.start': (sessionId: string) => {
    assertSessionId(sessionId);
    cleanupSession(sessionId);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediagrabber-mse-'));
    sessions.set(sessionId, {
      id: sessionId,
      dir,
      tracks: new Map()
    });
    return { success: true };
  },

  'mseCapture.append': (
    sessionId: string,
    trackId: number,
    mime: string,
    fragmentIndex: number,
    chunkIndex: number,
    chunkCount: number,
    base64: string
  ) => {
    const session = getSession(sessionId);
    if (!Number.isInteger(fragmentIndex) || fragmentIndex < 0) {
      throw new Error('Invalid MSE fragment index');
    }
    if (
      !Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > MAX_CHUNKS_PER_FRAGMENT ||
      !Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= chunkCount
    ) {
      throw new Error('Invalid MSE capture chunk index');
    }
    if (typeof base64 !== 'string' || base64.length > MAX_BASE64_CHUNK_LENGTH) {
      throw new Error('Invalid MSE capture chunk');
    }

    const track = getTrack(session, trackId, mime);
    if (fragmentIndex < track.nextFragment) {
      return { success: true, duplicate: true };
    }

    let fragment = track.pending.get(fragmentIndex);
    if (!fragment) {
      if (track.pending.size >= MAX_PENDING_FRAGMENTS) {
        throw new Error('Too many pending MSE capture fragments');
      }
      fragment = {
        chunkCount,
        receivedCount: 0,
        chunks: new Array(chunkCount).fill(undefined)
      };
      track.pending.set(fragmentIndex, fragment);
    }
    if (fragment.chunkCount !== chunkCount) {
      throw new Error('MSE capture chunk count changed within fragment');
    }

    if (!fragment.chunks[chunkIndex]) {
      fragment.chunks[chunkIndex] = Buffer.from(base64, 'base64');
      fragment.receivedCount++;
    }

    flushTrack(track);
    return { success: true, bytes: track.bytes };
  },

  'mseCapture.finish': (sessionId: string) => {
    const session = getSession(sessionId);
    const tracks = Array.from(session.tracks.values())
      .sort((a, b) => a.id - b.id);

    if (tracks.length === 0) {
      throw new Error('No MSE tracks were captured');
    }

    for (const track of tracks) {
      flushTrack(track);
      if (track.pending.size > 0) {
        throw new Error('MSE capture ended with incomplete fragments');
      }
      if (!fs.existsSync(track.filePath) || track.bytes === 0) {
        throw new Error('MSE capture produced an empty track');
      }
    }

    return {
      tracks: tracks.map((track) => ({
        id: track.id,
        mime: track.mime,
        path: track.filePath,
        bytes: track.bytes
      }))
    };
  },

  'mseCapture.abort': (sessionId: string) => {
    cleanupSession(sessionId);
    return { success: true };
  },

  'mseCapture.cleanup': (sessionId: string) => {
    cleanupSession(sessionId);
    return { success: true };
  }
});

function cleanupAllSessions(): void {
  for (const sessionId of Array.from(sessions.keys())) {
    cleanupSession(sessionId);
  }
}

process.on('SIGINT', cleanupAllSessions);
process.on('SIGTERM', cleanupAllSessions);
process.on('exit', cleanupAllSessions);

console.error('[MediaGrabber CoApp] MSE capture module loaded');
