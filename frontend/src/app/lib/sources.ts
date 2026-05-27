import { useEffect, useState } from 'react';
import { metadataApi, SourceMeta } from './api';

// Cached at module scope so the synchronous helpers below can resolve a source
// once it has been fetched, and so every component shares one request.
let cache: SourceMeta[] = [];
let inflight: Promise<SourceMeta[]> | null = null;

function load(): Promise<SourceMeta[]> {
  if (!inflight) {
    inflight = metadataApi.sources().then((data) => (cache = data.sources));
  }
  return inflight;
}

export function useSources(): SourceMeta[] {
  const [sources, setSources] = useState<SourceMeta[]>(cache);
  useEffect(() => {
    let active = true;
    load().then((next) => active && setSources(next)).catch(() => {});
    return () => { active = false; };
  }, []);
  return sources;
}

export function sourceLabel(source: string): string {
  const found = cache.find((s) => source === s.uri || source.startsWith(s.uri));
  return found ? found.localName : source;
}

export function getEntitySource(uri: string): string {
  return cache.find((s) => uri.startsWith(s.uri))?.uri || 'unknown';
}

export function sortSources(values: string[]): string[] {
  const order = new Map(cache.map((s, i) => [s.uri, i]));
  return [...values].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}
