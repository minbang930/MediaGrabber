// MSE Hook — runs in the MAIN world via manifest.json content_scripts world: "MAIN".
// Cannot use any extension APIs (chrome.*), only window.postMessage to communicate
// with the isolated-world content script.

(function() {
  if ((window as any).__MediaGrabberMSEHooked) return;
  (window as any).__MediaGrabberMSEHooked = true;

  const MSE_STATE: any = {
    blobUrl: null,
    mimeType: null,
    codecs: null,
    totalBytes: 0,
    segmentCount: 0,
    segmentUrls: [] as string[],
    initSegmentUrl: null,
    duration: 0
  };

  let pageGeneration = 0;
  const mediaSourceGenerations = new WeakMap<MediaSource, number>();
  let mediaSourceBlobUrls = new WeakMap<MediaSource, string>();
  let blobUrlMediaSources = new Map<string, MediaSource>();
  let sourceBufferGenerations = new WeakMap<SourceBuffer, number>();
  let sourceBufferMimes = new WeakMap<SourceBuffer, string>();
  let sourceBufferMediaSources = new WeakMap<SourceBuffer, MediaSource>();
  let sourceBufferInitScanned = new WeakSet<SourceBuffer>();
  let capturedMediaSources = new WeakSet<MediaSource>();
  let capturedBlobUrls = new Set<string>();
  let captureTrackIds = new WeakMap<SourceBuffer, number>();
  const captureFragmentIndexes = new Map<number, number>();
  const CAPTURE_CHUNK_BYTES = 192 * 1024;
  const CAPTURE_PLAYBACK_RATE = 8;
  let nextCaptureTrackId = 1;
  let activeCaptureSession: string | null = null;
  let captureFinished = false;
  let captureBytes = 0;
  let captureFragments = 0;
  let protectedMediaObserved = false;
  let acceleratedMediaElement: HTMLMediaElement | null = null;
  let originalPlaybackRate = 1;
  let originalDefaultPlaybackRate = 1;
  let accelerationRetryTimer: number | undefined;
  let accelerationRetryAttempts = 0;
  let accelerationTargetMode: 'blob' | 'playing-video' | 'playing-media' | null = null;
  let capturePipElement: HTMLVideoElement | null = null;
  let capturePipOwned = false;
  let capturePipRequestInFlight = false;
  let capturePipPermanentFailure = false;

  function postToContentScript(payload: any, generation = pageGeneration): void {
    if (generation !== pageGeneration) return;
    window.postMessage(Object.assign({
      source: 'MediaGrabber-MSE',
      pageUrl: window.location.href,
      generation
    }, payload), '*');
  }

  function resetMSEState(): void {
    MSE_STATE.blobUrl = null;
    MSE_STATE.mimeType = null;
    MSE_STATE.codecs = null;
    MSE_STATE.totalBytes = 0;
    MSE_STATE.segmentCount = 0;
    MSE_STATE.segmentUrls = [];
    MSE_STATE.initSegmentUrl = null;
    MSE_STATE.duration = 0;
    mediaSourceBlobUrls = new WeakMap<MediaSource, string>();
    blobUrlMediaSources = new Map<string, MediaSource>();
    sourceBufferGenerations = new WeakMap<SourceBuffer, number>();
    sourceBufferMimes = new WeakMap<SourceBuffer, string>();
    sourceBufferMediaSources = new WeakMap<SourceBuffer, MediaSource>();
    sourceBufferInitScanned = new WeakSet<SourceBuffer>();
    capturedMediaSources = new WeakSet<MediaSource>();
    capturedBlobUrls = new Set<string>();
    captureTrackIds = new WeakMap<SourceBuffer, number>();
    captureFragmentIndexes.clear();
    nextCaptureTrackId = 1;
    captureBytes = 0;
    captureFragments = 0;
    protectedMediaObserved = false;
    restoreCapturePictureInPicture();
    restoreCaptureAcceleration();
  }

  function postCapturePipState(
    state: 'waiting-user' | 'active' | 'existing' | 'left' | 'unsupported' | 'failed',
    detail?: string
  ): void {
    if (!activeCaptureSession || captureFinished) return;
    postToContentScript({
      type: 'mse-capture-pip',
      sessionId: activeCaptureSession,
      state,
      detail: detail || ''
    });
  }

  function findCapturePipTarget(): HTMLVideoElement | undefined {
    if (acceleratedMediaElement instanceof HTMLVideoElement) {
      return acceleratedMediaElement;
    }

    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'))
      .filter((video) =>
        video.readyState > 0 &&
        !video.disablePictureInPicture
      );

    const captured = videos.find((video) => isCapturedMediaElement(video));
    if (captured) return captured;

    const playing = videos.filter((video) => !video.paused && !video.ended);
    if (playing.length === 1) return playing[0];

    return videos.length === 1 ? videos[0] : undefined;
  }

  function restoreCapturePictureInPicture(): void {
    capturePipRequestInFlight = false;
    capturePipPermanentFailure = false;
    const element = capturePipElement;
    const owned = capturePipOwned;
    capturePipElement = null;
    capturePipOwned = false;

    if (
      owned &&
      element &&
      document.pictureInPictureElement === element
    ) {
      try {
        void document.exitPictureInPicture().catch(() => {});
      } catch {}
    }
  }

  function requestCapturePictureInPictureFromUserGesture(): void {
    if (
      !activeCaptureSession ||
      captureFinished ||
      protectedMediaObserved ||
      capturePipRequestInFlight ||
      capturePipPermanentFailure
    ) return;

    if (document.pictureInPictureElement) {
      capturePipElement = document.pictureInPictureElement instanceof HTMLVideoElement
        ? document.pictureInPictureElement
        : null;
      capturePipOwned = false;
      postCapturePipState('existing');
      return;
    }

    if (!document.pictureInPictureEnabled) {
      capturePipPermanentFailure = true;
      postCapturePipState('unsupported', 'document-disabled');
      return;
    }

    if (!navigator.userActivation?.isActive) return;

    const video = findCapturePipTarget();
    if (!video) return;

    if (video.disablePictureInPicture) {
      capturePipPermanentFailure = true;
      postCapturePipState('unsupported', 'video-disabled');
      return;
    }

    const request = (video as HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<any>;
    }).requestPictureInPicture;
    if (typeof request !== 'function') {
      capturePipPermanentFailure = true;
      postCapturePipState('unsupported', 'api-unavailable');
      return;
    }

    capturePipRequestInFlight = true;
    try {
      const promise = request.call(video);
      void promise.then(() => {
        capturePipRequestInFlight = false;
        if (!activeCaptureSession || captureFinished) {
          try {
            if (document.pictureInPictureElement === video) {
              void document.exitPictureInPicture().catch(() => {});
            }
          } catch {}
          return;
        }

        capturePipElement = video;
        capturePipOwned = true;
        postCapturePipState('active');

        video.addEventListener('leavepictureinpicture', () => {
          if (capturePipElement === video) {
            capturePipElement = null;
            capturePipOwned = false;
            if (activeCaptureSession && !captureFinished) {
              postCapturePipState('left');
            }
          }
        }, { once: true });
      }).catch((error: any) => {
        capturePipRequestInFlight = false;
        const name = String(error?.name || 'Error');
        if (name === 'NotSupportedError' || name === 'SecurityError') {
          capturePipPermanentFailure = true;
        }
        postCapturePipState('failed', name);
      });
    } catch (error: any) {
      capturePipRequestInFlight = false;
      const name = String(error?.name || 'Error');
      if (name === 'NotSupportedError' || name === 'SecurityError') {
        capturePipPermanentFailure = true;
      }
      postCapturePipState('failed', name);
    }
  }

  function clearAccelerationRetry(): void {
    if (accelerationRetryTimer !== undefined) {
      clearTimeout(accelerationRetryTimer);
      accelerationRetryTimer = undefined;
    }
    accelerationRetryAttempts = 0;
  }

  function isCapturedMediaElement(element: HTMLMediaElement): boolean {
    const current = element.currentSrc || element.src;
    if (!current) return false;
    if (capturedBlobUrls.has(current)) return true;
    const mediaSource = blobUrlMediaSources.get(current);
    return Boolean(mediaSource && capturedMediaSources.has(mediaSource));
  }

  function postAccelerationState(element: HTMLMediaElement): void {
    if (!activeCaptureSession || captureFinished) return;
    postToContentScript({
      type: 'mse-capture-acceleration',
      sessionId: activeCaptureSession,
      requestedRate: CAPTURE_PLAYBACK_RATE,
      effectiveRate: Number(element.playbackRate) || 1,
      targetMode: accelerationTargetMode || 'unknown'
    });
  }

  function restoreCaptureAcceleration(): void {
    clearAccelerationRetry();
    const element = acceleratedMediaElement;
    acceleratedMediaElement = null;
    accelerationTargetMode = null;
    if (!element) return;
    try {
      element.defaultPlaybackRate = originalDefaultPlaybackRate;
      element.playbackRate = originalPlaybackRate;
    } catch {}
  }

  function tryApplyCaptureAcceleration(): boolean {
    if (!activeCaptureSession || captureFinished || protectedMediaObserved) return false;

    const existing = acceleratedMediaElement;
    if (existing && isCapturedMediaElement(existing)) {
      try {
        existing.defaultPlaybackRate = CAPTURE_PLAYBACK_RATE;
        existing.playbackRate = CAPTURE_PLAYBACK_RATE;
        postAccelerationState(existing);
        return true;
      } catch {
        return false;
      }
    }

    const allMedia = Array.from(document.querySelectorAll<HTMLMediaElement>('video, audio'));
    let media = allMedia.find((element) => isCapturedMediaElement(element));
    let targetMode: 'blob' | 'playing-video' | 'playing-media' | null = media ? 'blob' : null;

    if (!media && captureFragments > 0) {
      const playingVideos = allMedia.filter((element) =>
        element instanceof HTMLVideoElement &&
        !element.paused &&
        !element.ended &&
        element.readyState >= 2
      );
      if (playingVideos.length === 1) {
        media = playingVideos[0];
        targetMode = 'playing-video';
      }
    }

    if (!media && captureFragments > 0) {
      const playingMedia = allMedia.filter((element) =>
        !element.paused &&
        !element.ended &&
        element.readyState >= 2
      );
      if (playingMedia.length === 1) {
        media = playingMedia[0];
        targetMode = 'playing-media';
      }
    }

    if (!media || !targetMode) return false;

    acceleratedMediaElement = media;
    accelerationTargetMode = targetMode;
    originalPlaybackRate = media.playbackRate;
    originalDefaultPlaybackRate = media.defaultPlaybackRate;
    try {
      media.defaultPlaybackRate = CAPTURE_PLAYBACK_RATE;
      media.playbackRate = CAPTURE_PLAYBACK_RATE;
      postAccelerationState(media);
      clearAccelerationRetry();
      return true;
    } catch {
      acceleratedMediaElement = null;
      accelerationTargetMode = null;
      return false;
    }
  }

  function scheduleCaptureAcceleration(): void {
    if (tryApplyCaptureAcceleration()) return;
    if (!activeCaptureSession || captureFinished || accelerationRetryAttempts >= 20) return;

    accelerationRetryAttempts++;
    if (accelerationRetryTimer !== undefined) clearTimeout(accelerationRetryTimer);
    accelerationRetryTimer = window.setTimeout(() => {
      accelerationRetryTimer = undefined;
      scheduleCaptureAcceleration();
    }, 250);
  }

  function getAppendView(data: any): Uint8Array | undefined {
    try {
      if (data instanceof ArrayBuffer) return new Uint8Array(data);
      if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
      }
    } catch {}
    return undefined;
  }

  function containsAsciiMarker(view: Uint8Array, marker: string): boolean {
    const markerBytes = Array.from(marker).map((char) => char.charCodeAt(0));
    const limit = Math.min(view.byteLength, 512 * 1024);
    outer: for (let i = 0; i <= limit - markerBytes.length; i++) {
      for (let j = 0; j < markerBytes.length; j++) {
        if (view[i + j] !== markerBytes[j]) continue outer;
      }
      return true;
    }
    return false;
  }

  function hasProtectedMediaMarker(view: Uint8Array | undefined): boolean {
    if (!view) return false;
    return ['pssh', 'sinf', 'schm', 'tenc', 'encv', 'enca', 'cenc', 'cbcs']
      .some((marker) => containsAsciiMarker(view, marker));
  }

  function stopCapture(error?: string): void {
    const sessionId = activeCaptureSession;
    restoreCapturePictureInPicture();
    restoreCaptureAcceleration();
    activeCaptureSession = null;
    captureFinished = true;
    if (sessionId && error) {
      postToContentScript({
        type: 'mse-capture-error',
        sessionId,
        error
      });
    }
  }

  function finishCapture(): void {
    if (!activeCaptureSession || captureFinished) return;
    const sessionId = activeCaptureSession;
    restoreCapturePictureInPicture();
    restoreCaptureAcceleration();
    captureFinished = true;
    activeCaptureSession = null;
    postToContentScript({
      type: 'mse-capture-complete',
      sessionId,
      bytes: captureBytes,
      fragments: captureFragments
    });
  }

  function ensureCaptureTrack(sourceBuffer: SourceBuffer): { id: number; mime: string } | undefined {
    const mime = sourceBufferMimes.get(sourceBuffer);
    if (!mime || !isVideoMime(mime)) return undefined;

    let id = captureTrackIds.get(sourceBuffer);
    if (!id) {
      id = nextCaptureTrackId++;
      captureTrackIds.set(sourceBuffer, id);
      captureFragmentIndexes.set(id, 0);

      const mediaSource = sourceBufferMediaSources.get(sourceBuffer);
      if (mediaSource) {
        capturedMediaSources.add(mediaSource);
        const blobUrl = mediaSourceBlobUrls.get(mediaSource);
        if (blobUrl) capturedBlobUrls.add(blobUrl);
      }
      scheduleCaptureAcceleration();
    }
    return { id, mime };
  }

  function postCaptureFragment(
    sessionId: string,
    trackId: number,
    mime: string,
    fragmentIndex: number,
    chunks: Uint8Array[]
  ): void {
    const chunkCount = chunks.length;
    chunks.forEach((bytes, chunkIndex) => {
      postToContentScript({
        type: 'mse-capture-chunk',
        sessionId,
        trackId,
        mime,
        fragmentIndex,
        chunkIndex,
        chunkCount,
        bytes
      });
    });
  }

  window.addEventListener('message', (event) => {
    if (
      event.source !== window ||
      !event.data ||
      event.data.source !== 'MediaGrabber-Content'
    ) return;

    if (event.data.type === 'mse-capture-start') {
      const sessionId = String(event.data.sessionId || '');
      if (!sessionId) return;

      if (activeCaptureSession === sessionId && !captureFinished) {
        postToContentScript({ type: 'mse-capture-started', sessionId });
        return;
      }

      if (protectedMediaObserved) {
        postToContentScript({
          type: 'mse-capture-error',
          sessionId,
          error: 'Protected EME/CENC media is not supported.'
        });
        return;
      }

      restoreCapturePictureInPicture();
      restoreCaptureAcceleration();
      activeCaptureSession = sessionId;
      captureFinished = false;
      capturedMediaSources = new WeakSet<MediaSource>();
      capturedBlobUrls = new Set<string>();
      captureTrackIds = new WeakMap<SourceBuffer, number>();
      captureFragmentIndexes.clear();
      nextCaptureTrackId = 1;
      captureBytes = 0;
      captureFragments = 0;
      accelerationRetryAttempts = 0;
      capturePipRequestInFlight = false;
      capturePipPermanentFailure = false;
      postToContentScript({ type: 'mse-capture-started', sessionId });
      postCapturePipState('waiting-user');
      scheduleCaptureAcceleration();
      return;
    }

    if (
      event.data.type === 'mse-capture-stop' &&
      activeCaptureSession &&
      event.data.sessionId === activeCaptureSession
    ) {
      stopCapture();
    }
  });

  document.addEventListener('encrypted', () => {
    protectedMediaObserved = true;
    if (activeCaptureSession) {
      stopCapture('Protected EME/CENC media is not supported.');
    }
  }, true);

  function notifyNavigation(): void {
    if (activeCaptureSession) {
      stopCapture('Page navigation interrupted the MSE capture.');
    }
    pageGeneration++;
    resetMSEState();
    postToContentScript({ type: 'navigation' });
  }

  const origPushState = history.pushState;
  history.pushState = function(): void {
    origPushState.apply(this, arguments as any);
    notifyNavigation();
  };

  const origReplaceState = history.replaceState;
  history.replaceState = function(): void {
    origReplaceState.apply(this, arguments as any);
    notifyNavigation();
  };

  window.addEventListener('popstate', notifyNavigation);
  window.addEventListener('hashchange', notifyNavigation);

  function extractCodecs(mime: string): string | null {
    const m = mime.match(/codecs="([^"]+)"/);
    return m ? m[1] : null;
  }

  function isVideoMime(mime: string): boolean {
    return mime && (mime.indexOf('video/mp4') === 0 || mime.indexOf('video/webm') === 0 || mime.indexOf('audio/mp4') === 0);
  }

  function looksLikeSegment(url: string): boolean {
    if (!url || url.indexOf('http') !== 0) return false;
    const path = url.split('?')[0].toLowerCase();
    if (path.indexOf('.m4s') >= 0) return true;
    if (path.indexOf('.mp4') >= 0) return true;
    if (path.indexOf('.webm') >= 0) return true;
    if (path.indexOf('.ts') >= 0 && path.indexOf('.ts/') < 0) return true;
    if (path.indexOf('segment') >= 0 || path.indexOf('seg-') >= 0) return true;
    if (path.indexOf('chunk') >= 0 || path.indexOf('fragment') >= 0) return true;
    if (path.indexOf('init') >= 0 && path.indexOf('.mp4') >= 0) return true;
    return false;
  }

  function isLikelyMediaRequest(url: string): boolean {
    try {
      const path = new URL(url, window.location.href).pathname.toLowerCase();
      return /\.(m3u8|mpd|ts|m4s|mp4|webm)$/.test(path);
    } catch {
      return false;
    }
  }

  function findRelayUrl(originalUrl: string, startTime: number, responseUrl?: string): string | undefined {
    try {
      const original = new URL(originalUrl, window.location.href);
      if (responseUrl) {
        const response = new URL(responseUrl, window.location.href);
        if (response.href !== original.href && response.origin === original.origin && response.pathname !== original.pathname) {
          return response.href;
        }
      }

      const now = performance.now();
      const entry = performance.getEntriesByType('resource')
        .filter((item): item is PerformanceResourceTiming => {
          if (item.startTime < startTime - 50 || item.startTime > now + 50) return false;
          try {
            const resource = new URL(item.name, window.location.href);
            return resource.origin === original.origin && resource.pathname !== original.pathname;
          } catch {
            return false;
          }
        })
        .sort((a, b) => Math.abs(a.startTime - startTime) - Math.abs(b.startTime - startTime))[0];

      return entry?.name;
    } catch {
      return undefined;
    }
  }

  function reportMediaUrlMapping(originalUrl: string, startTime: number, responseUrl?: string, generation = pageGeneration): void {
    if (generation !== pageGeneration || !isLikelyMediaRequest(originalUrl)) return;
    const relayUrl = findRelayUrl(originalUrl, startTime, responseUrl);
    if (!relayUrl || relayUrl === originalUrl) return;
    postToContentScript({ type: 'media-url-map', originalUrl, relayUrl }, generation);
  }

  const origCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = function(obj: any): string {
    const url = origCreateObjectURL.call(this, obj);
    if (obj instanceof MediaSource) {
      const generation = pageGeneration;
      mediaSourceGenerations.set(obj, generation);
      mediaSourceBlobUrls.set(obj, url);
      blobUrlMediaSources.set(url, obj);
      MSE_STATE.blobUrl = url;
      try {
        obj.addEventListener('sourceended', () => {
          if (
            generation === pageGeneration &&
            capturedMediaSources.has(obj)
          ) {
            finishCapture();
          }
        }, { once: true });
      } catch {}
      postToContentScript({ type: 'mse-detected', blobUrl: url });
    }
    return url;
  };

  const origAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
  MediaSource.prototype.addSourceBuffer = function(mimeType: string): SourceBuffer {
    const generation = mediaSourceGenerations.get(this) ?? pageGeneration;
    if (isVideoMime(mimeType) && generation === pageGeneration) {
      MSE_STATE.mimeType = mimeType;
      MSE_STATE.codecs = extractCodecs(mimeType);
      postToContentScript({
        type: 'source-buffer',
        blobUrl: MSE_STATE.blobUrl,
        mimeType,
        codecs: MSE_STATE.codecs
      });
    }
    const sourceBuffer = origAddSourceBuffer.call(this, mimeType);
    sourceBufferGenerations.set(sourceBuffer, generation);
    sourceBufferMimes.set(sourceBuffer, mimeType);
    sourceBufferMediaSources.set(sourceBuffer, this);
    return sourceBuffer;
  };

  const origAppendBuffer = SourceBuffer.prototype.appendBuffer;
  SourceBuffer.prototype.appendBuffer = function(data: any): void {
    let capturePayload: {
      sessionId: string;
      trackId: number;
      mime: string;
      fragmentIndex: number;
      view: Uint8Array;
      bytes: number;
    } | undefined;

    try {
      const generation = sourceBufferGenerations.get(this);
      if (generation === pageGeneration) {
        const view = getAppendView(data);

        if (!sourceBufferInitScanned.has(this)) {
          sourceBufferInitScanned.add(this);
          if (hasProtectedMediaMarker(view)) {
            protectedMediaObserved = true;
            if (activeCaptureSession) {
              stopCapture('Protected EME/CENC media is not supported.');
            }
          }
        }

        if (data instanceof ArrayBuffer) {
          MSE_STATE.totalBytes += data.byteLength;
        } else if (data && data.buffer) {
          MSE_STATE.totalBytes += data.byteLength || data.buffer.byteLength;
        }

        MSE_STATE.segmentCount++;

        if (
          activeCaptureSession &&
          !captureFinished &&
          !protectedMediaObserved &&
          view &&
          view.byteLength > 0
        ) {
          const track = ensureCaptureTrack(this);
          if (track) {
            const fragmentIndex = captureFragmentIndexes.get(track.id) || 0;
            captureFragmentIndexes.set(track.id, fragmentIndex + 1);

            capturePayload = {
              sessionId: activeCaptureSession,
              trackId: track.id,
              mime: track.mime,
              fragmentIndex,
              view,
              bytes: view.byteLength
            };
          }
        }

        if (MSE_STATE.segmentCount === 1) {
          postToContentScript({
            type: 'first-segment',
            blobUrl: MSE_STATE.blobUrl,
            mimeType: MSE_STATE.mimeType,
            codecs: MSE_STATE.codecs,
            totalBytes: MSE_STATE.totalBytes,
            segmentCount: MSE_STATE.segmentCount
          });
        }

        if (MSE_STATE.segmentCount % 50 === 0) {
          postToContentScript({
            type: 'progress',
            blobUrl: MSE_STATE.blobUrl,
            totalBytes: MSE_STATE.totalBytes,
            segmentCount: MSE_STATE.segmentCount
          });
        }
      }
    } catch {}

    origAppendBuffer.call(this, data);

    if (
      capturePayload &&
      activeCaptureSession === capturePayload.sessionId &&
      !captureFinished
    ) {
      const chunks: Uint8Array[] = [];
      for (let offset = 0; offset < capturePayload.view.byteLength; offset += CAPTURE_CHUNK_BYTES) {
        chunks.push(
          capturePayload.view.slice(
            offset,
            Math.min(capturePayload.view.byteLength, offset + CAPTURE_CHUNK_BYTES)
          )
        );
      }

      captureBytes += capturePayload.bytes;
      captureFragments++;
      if (captureFragments === 1) {
        accelerationRetryAttempts = 0;
        scheduleCaptureAcceleration();
      }
      postCaptureFragment(
        capturePayload.sessionId,
        capturePayload.trackId,
        capturePayload.mime,
        capturePayload.fragmentIndex,
        chunks
      );

      if (captureFragments === 1 || captureFragments % 10 === 0) {
        postToContentScript({
          type: 'mse-capture-progress',
          sessionId: capturePayload.sessionId,
          bytes: captureBytes,
          fragments: captureFragments
        });
      }
    }
  };

  document.addEventListener('ended', (event) => {
    if (!(event.target instanceof HTMLMediaElement)) return;
    const current = event.target.currentSrc || event.target.src;
    if (!current) return;

    const mediaSource = blobUrlMediaSources.get(current);
    if (
      capturedBlobUrls.has(current) ||
      (mediaSource && capturedMediaSources.has(mediaSource))
    ) {
      finishCapture();
    }
  }, true);

  window.addEventListener('click', () => {
    requestCapturePictureInPictureFromUserGesture();
  }, false);

  document.addEventListener('play', (event) => {
    if (
      event.target instanceof HTMLMediaElement &&
      activeCaptureSession &&
      isCapturedMediaElement(event.target)
    ) {
      requestCapturePictureInPictureFromUserGesture();
      scheduleCaptureAcceleration();
    }
  }, true);

  document.addEventListener('ratechange', (event) => {
    if (
      event.target instanceof HTMLMediaElement &&
      event.target === acceleratedMediaElement &&
      activeCaptureSession &&
      !captureFinished
    ) {
      postAccelerationState(event.target);
    }
  }, true);

  const origDurationDesc = Object.getOwnPropertyDescriptor(MediaSource.prototype, 'duration');
  if (origDurationDesc && origDurationDesc.set) {
    const origDurationSet = origDurationDesc.set;
    Object.defineProperty(MediaSource.prototype, 'duration', {
      get: origDurationDesc.get,
      set: function(val: number) {
        const generation = mediaSourceGenerations.get(this);
        if (generation !== undefined && generation !== pageGeneration) {
          return origDurationSet.call(this, val);
        }
        MSE_STATE.duration = val;
        postToContentScript({ type: 'duration', blobUrl: MSE_STATE.blobUrl, duration: val });
        return origDurationSet.call(this, val);
      },
      configurable: true
    });
  }

  const origFetch = window.fetch;
  window.fetch = function(input: any, init?: any): Promise<Response> {
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    const generation = pageGeneration;
    if (looksLikeSegment(url) && generation === pageGeneration && MSE_STATE.segmentUrls.length < 500) {
      MSE_STATE.segmentUrls.push(url);
      if (url.indexOf('init') >= 0 || MSE_STATE.segmentUrls.length === 1) {
        MSE_STATE.initSegmentUrl = MSE_STATE.initSegmentUrl || url;
      }
      postToContentScript({
        type: 'segment-url',
        url,
        isInit: url.indexOf('init') >= 0,
        totalUrls: MSE_STATE.segmentUrls.length
      }, generation);
    }
    return origFetch.apply(this, arguments as any);
  };

  const origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method: string, url: string): void {
    const originalUrl = String(url || '');
    const generation = pageGeneration;
    const startTime = performance.now();

    // Preserve the native XMLHttpRequest constructor and event-handler properties.
    // Observe completion through a normal EventTarget listener instead of wrapping
    // each XHR instance or redefining onload/onreadystatechange/onloadend.
    const result = origXHROpen.apply(this, arguments as any);

    if (looksLikeSegment(originalUrl) && generation === pageGeneration && MSE_STATE.segmentUrls.length < 500) {
      MSE_STATE.segmentUrls.push(originalUrl);
      if (originalUrl.indexOf('init') >= 0 || MSE_STATE.segmentUrls.length === 1) {
        MSE_STATE.initSegmentUrl = MSE_STATE.initSegmentUrl || originalUrl;
      }
      postToContentScript({
        type: 'segment-url',
        url: originalUrl,
        isInit: originalUrl.indexOf('init') >= 0,
        totalUrls: MSE_STATE.segmentUrls.length
      }, generation);
    }

    if (isLikelyMediaRequest(originalUrl)) {
      try {
        this.addEventListener('loadend', () => {
          reportMediaUrlMapping(originalUrl, startTime, this.responseURL, generation);
        }, { once: true });
      } catch {}
    }

    return result;
  };

  postToContentScript({ type: 'mse-hook-ready' });
})();
