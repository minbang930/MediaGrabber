type KeepAliveEntry = {
  stream: MediaStream;
  video: HTMLVideoElement;
};

const keepAliveByTab = new Map<number, KeepAliveEntry>();

function stopKeepAlive(tabId: number): void {
  const entry = keepAliveByTab.get(tabId);
  if (!entry) return;

  keepAliveByTab.delete(tabId);
  try {
    entry.stream.getTracks().forEach((track) => track.stop());
  } catch {}
  try {
    entry.video.pause();
    entry.video.srcObject = null;
    entry.video.remove();
  } catch {}
}

async function startKeepAlive(tabId: number, streamId: string): Promise<void> {
  stopKeepAlive(tabId);

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    } as any
  });

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.width = 1;
  video.height = 1;
  video.srcObject = stream;
  document.body.appendChild(video);

  keepAliveByTab.set(tabId, { stream, video });

  for (const track of stream.getTracks()) {
    track.addEventListener('ended', () => {
      if (keepAliveByTab.get(tabId)?.stream === stream) {
        stopKeepAlive(tabId);
      }
    }, { once: true });
  }

  try {
    await video.play();
  } catch {
    // Holding the live MediaStream track is the keep-alive mechanism.
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'mediagrabber-offscreen') return false;

  if (message.type === 'MSE_TAB_CAPTURE_START') {
    void startKeepAlive(Number(message.tabId), String(message.streamId || ''))
      .then(() => sendResponse({ success: true, activeCount: keepAliveByTab.size }))
      .catch((error: any) => {
        sendResponse({
          success: false,
          activeCount: keepAliveByTab.size,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    return true;
  }

  if (message.type === 'MSE_TAB_CAPTURE_STOP') {
    stopKeepAlive(Number(message.tabId));
    sendResponse({ success: true, activeCount: keepAliveByTab.size });
    return false;
  }

  return false;
});
