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
  const sourceBufferGenerations = new WeakMap<SourceBuffer, number>();
  const xhrArrayBufferResponses = new WeakSet<ArrayBuffer>();
  const sourceBufferDiagnosticIds = new WeakMap<SourceBuffer, number>();
  const sourceBufferDiagnostics = new Map<number, {
    id: number;
    mime: string;
    appends: number;
    boxes: Record<string, number>;
    identityMatches: number;
    viewBufferMatches: number;
  }>();
  let nextSourceBufferDiagnosticId = 1;
  let xhrArrayBufferResponseCount = 0;

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
    sourceBufferDiagnostics.clear();
    nextSourceBufferDiagnosticId = 1;
    xhrArrayBufferResponseCount = 0;
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

  function classifyAppendSignature(view: Uint8Array | undefined): string {
    if (!view || view.byteLength < 4) return 'short';
    if (view[0] === 0x1a && view[1] === 0x45 && view[2] === 0xdf && view[3] === 0xa3) return 'ebml';
    if (view[0] === 0x1f && view[1] === 0x43 && view[2] === 0xb6 && view[3] === 0x75) return 'cluster';
    if (view.byteLength >= 8) {
      const box = String.fromCharCode(view[4], view[5], view[6], view[7]).toLowerCase();
      if (/^(ftyp|moov|moof|mdat|styp|sidx|free)$/.test(box)) return box;
    }
    return 'other';
  }

  function postIdentityDiagnostic(generation = pageGeneration): void {
    postToContentScript({
      type: 'xhr-identity-diagnostic',
      buffers: Array.from(sourceBufferDiagnostics.values()).map((state) => ({
        id: state.id,
        mime: state.mime,
        appends: state.appends,
        boxes: state.boxes,
        identityMatches: state.identityMatches,
        viewBufferMatches: state.viewBufferMatches,
        xhrArrayBufferResponseCount
      }))
    }, generation);
  }

  function notifyNavigation(): void {
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
      mediaSourceGenerations.set(obj, pageGeneration);
      MSE_STATE.blobUrl = url;
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

    if (isVideoMime(mimeType) && generation === pageGeneration) {
      const id = nextSourceBufferDiagnosticId++;
      sourceBufferDiagnosticIds.set(sourceBuffer, id);
      sourceBufferDiagnostics.set(id, {
        id,
        mime: mimeType.split(';', 1)[0].trim().toLowerCase(),
        appends: 0,
        boxes: {},
        identityMatches: 0,
        viewBufferMatches: 0
      });
      postIdentityDiagnostic(generation);
    }

    return sourceBuffer;
  };

  const origAppendBuffer = SourceBuffer.prototype.appendBuffer;
  SourceBuffer.prototype.appendBuffer = function(data: any): void {
    try {
      const generation = sourceBufferGenerations.get(this);
      if (generation !== pageGeneration) return;

      if (generation === pageGeneration && data instanceof ArrayBuffer) {
        MSE_STATE.totalBytes += data.byteLength;
      } else if (generation === pageGeneration && data && data.buffer) {
        MSE_STATE.totalBytes += data.buffer.byteLength;
      }

      MSE_STATE.segmentCount++;

      const diagnosticId = sourceBufferDiagnosticIds.get(this);
      const diagnostic = diagnosticId ? sourceBufferDiagnostics.get(diagnosticId) : undefined;
      if (diagnostic) {
        const view = getAppendView(data);
        const signature = classifyAppendSignature(view);
        const directMatch = data instanceof ArrayBuffer && xhrArrayBufferResponses.has(data);
        const bufferMatch = ArrayBuffer.isView(data) && xhrArrayBufferResponses.has(data.buffer as ArrayBuffer);

        diagnostic.appends++;
        diagnostic.boxes[signature] = (diagnostic.boxes[signature] || 0) + 1;
        if (directMatch) diagnostic.identityMatches++;
        if (bufferMatch) diagnostic.viewBufferMatches++;

        if (diagnostic.appends === 1 || diagnostic.appends % 10 === 0) {
          postIdentityDiagnostic(generation);
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
    } catch {}
    finally {
      origAppendBuffer.call(this, data);
    }
  };

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

    try {
      this.addEventListener('load', () => {
        if (generation !== pageGeneration) return;
        try {
          const response = this.response;
          if (response instanceof ArrayBuffer) {
            xhrArrayBufferResponses.add(response);
            xhrArrayBufferResponseCount++;
          }
        } catch {}
      });
    } catch {}

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
})();
