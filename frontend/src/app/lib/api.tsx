const BASE = '/api';

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface MetaItem { localName: string; label?: string | null }

export interface ClassMeta { localName: string; uri: string; label?: string | null }
export interface PropertyMeta { localName: string; uri: string; type: 'data' | 'object'; label?: string | null; range?: string | null; rangeClass?: string | null }

export const metadataApi = {
  mappedClasses: () => get<{ classes: ClassMeta[] }>('/metadata/mapped-classes'),
  mappedProperties: (className?: string) =>
    get<{ properties: PropertyMeta[]; class?: string }>('/metadata/mapped-properties', { class_name: className }),
  facets: (className: string, property: string) =>
    get<{ values: string[] }>('/metadata/facets', { class_name: className, property }),
};

// Conciseness

export interface IntraSourceResult {
  total_representations: number;
  unique_instances: number;
  violating_instances: number;
  score_f1: number;
  score_f2: number;
  passed: boolean;
  duplicate_groups: {
    identity_values: Record<string, string>;
    uris: string[];
    count: number;
  }[];
}

export interface CrossSourceResult {
  total_entities: number;
  ambiguous_instances: number;
  cn3_score: number;
  sample_size: number;
  sources: string[];
  note?: string;
  ambiguous_groups: {
    identity_values: Record<string, string>;
    entities: { source: string; uri: string }[];
  }[];
}

export const concisenessApi = {
  intraSource: (params: { class_uri: string; identity_props: string; source_prefix: string; sample_limit?: number }) =>
    get<IntraSourceResult>('/conciseness/intra-source', params),
  crossSource: (params: { class_uri: string; identity_props: string; sources: string; sample_limit?: number }) =>
    get<CrossSourceResult>('/conciseness/cross-source', params),
};

export function statusFor(percent: number): 'good' | 'warn' | 'bad' {
  if (percent >= 90) return 'good';
  if (percent >= 70) return 'warn';
  return 'bad';
}

export function statusColor(percent: number): string {
  const s = statusFor(percent);
  if (s === 'good') return '#1F8A4C'; // green
  if (s === 'warn') return '#E08B1A'; // amber
  return '#9E2B0A'; // accent red (matches theme)
}
