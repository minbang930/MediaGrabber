# Project

## Purpose

MediaGrabber is an open-source Chromium browser video downloader composed of a Manifest V3 extension and a local native companion application. Its goal is to detect downloadable media presented through several common web delivery mechanisms, expose useful quality choices, and hand native download or conversion work to FFmpeg or yt-dlp when browser APIs alone are insufficient.

This repository is the working fork of miroshArtem/MediaGrabber and is the source of truth for this long-term project.

## Problem being solved

Modern sites deliver media through a mixture of direct files, HLS manifests, DASH manifests, Media Source Extensions, blob URLs, short-lived signed URLs, and authenticated requests. Simple URL-sniffing extensions therefore miss many playable streams or download only fragments.

MediaGrabber aims to provide a practical, inspectable implementation that handles as many non-DRM delivery patterns as possible without breaking normal playback.

## Core users and use cases

- A user sees media playing in Chrome or Edge and wants to save an available non-DRM copy.
- A user wants to choose among HLS/DASH quality variants, audio tracks, or subtitles.
- A developer needs to diagnose why a site is detected but not downloadable.
- A developer wants a transparent alternative to opaque downloader extensions and installers.

## In scope

- Chrome/Edge Manifest V3 extension behavior.
- Network, DOM, HLS, DASH, and MSE/blob-oriented media detection.
- Quality and track presentation in the popup.
- Native messaging between the extension and CoApp.
- Direct HTTP downloads through the CoApp.
- FFmpeg/ffprobe probing, remuxing, and stream handling.
- yt-dlp integration for supported sites, including the current YouTube-specific route.
- User-local installation and native messaging registration.
- Compatibility engineering for signed, referred, or otherwise request-context-sensitive non-DRM streams.

## Explicitly out of scope

- DRM circumvention, including Widevine, PlayReady, or FairPlay key/decryption bypass.
- Guaranteeing support for every website.
- Credential theft, persistence outside the documented native-host install, or collection of unrelated browser data.
- Treating temporary diagnostic workarounds as permanent architecture without validation.

## Core concepts

- Detection is not downloadability. A URL can be observed but still require browser request context, token freshness, or a manifest/segment relationship.
- Player compatibility is a first-class requirement. MAIN-world instrumentation is useful only if it preserves page behavior.
- The browser and CoApp have different capabilities. The extension sees page/network context; the CoApp can write files and launch FFmpeg/yt-dlp.
- MSE is a stream-reconstruction problem, not merely a blob-URL problem. Individual fragments are not necessarily standalone videos.

## Success criteria

For supported non-DRM sites:

- normal playback remains functional with the extension enabled;
- related stream resources are grouped into understandable media choices rather than fragment noise;
- selected HLS/DASH/MSE/direct media downloads produce the complete intended media;
- necessary request context is preserved without exposing credentials;
- failures are diagnosable from clear, non-misleading errors;
- important deterministic behavior gains repeatable verification over time.

## Current stage

Stabilization and compatibility engineering. The fork currently starts from upstream version 1.1.1 behavior, with immediate work focused on a reproducible MAIN-world MSE/XHR compatibility regression, fragment aggregation, and direct-download request-context failures. See CURRENT_STATE.md, EXPERIMENTS.md, and ROADMAP.md.
