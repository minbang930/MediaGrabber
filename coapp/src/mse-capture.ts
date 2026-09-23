// MSE append capture — receives explicit user-triggered fMP4 chunks from the extension.
// Chunks are written to temporary per-track files and never logged.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import rpc from './rpc';
import {
  OrderedFragmentWriter,
  assertCaptureSessionId
} from './mse-capture-core';

interface CaptureTrack {
  id: number;
  mime: string;
  filePath: string;
  writer: OrderedFragmentWriter;
}

interface CaptureSession {
  id: string;
  dir: string;
  tracks: Map<number, CaptureTrack>;
}

const sessions = new Map<string, CaptureSession>();
const MAX_TRACKS = 4;
const MAX_BASE64_CHUNK_LENGTH = 1024 * 1024;

function getSession(sessionId: string): CaptureSession {
  assertCaptureSessionId(sessionId);
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
    const filePath = path.join(session.dir, `track-${trackId}.${extension}`);
    track = {
      id: trackId,
      mime: safeMime,
      filePath,
      writer: new OrderedFragmentWriter((chunk) => {
        fs.appendFileSync(filePath, chunk);
      })
    };
    session.tracks.set(trackId, track);
  }

  return track;
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
    assertCaptureSessionId(sessionId);
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
    if (typeof base64 !== 'string' || base64.length > MAX_BASE64_CHUNK_LENGTH) {
      throw new Error('Invalid MSE capture chunk');
    }

    const track = getTrack(session, trackId, mime);
    const result = track.writer.append(
      fragmentIndex,
      chunkIndex,
      chunkCount,
      Buffer.from(base64, 'base64')
    );

    return {
      success: true,
      duplicate: result.duplicate || undefined,
      bytes: result.bytes
    };
  },

  'mseCapture.finish': (sessionId: string) => {
    const session = getSession(sessionId);
    const tracks = Array.from(session.tracks.values())
      .sort((a, b) => a.id - b.id);

    if (tracks.length === 0) {
      throw new Error('No MSE tracks were captured');
    }

    for (const track of tracks) {
      track.writer.finish();
      if (!fs.existsSync(track.filePath) || track.writer.bytes === 0) {
        throw new Error('MSE capture produced an empty track');
      }
    }

    return {
      tracks: tracks.map((track) => ({
        id: track.id,
        mime: track.mime,
        path: track.filePath,
        bytes: track.writer.bytes
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
