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

export interface MappingCoverage {
  classes: { total: number; mapped: number; unmapped: number; coverage: number; mapped_list: MetaItem[]; unmapped_list: MetaItem[] };
  properties: { total: number; mapped: number; unmapped: number; coverage: number; mapped_list: MetaItem[]; unmapped_list: MetaItem[] };
  overall_coverage: number;
}

export interface PropertyResult { property: string; label?: string; filled: number; missing: number; completeness: number }
export interface EntityRow { uri: string; scores: Record<string, boolean>; completeness: number }
export interface MatrixPropertyInfo { uri: string; localName?: string; label?: string | null }
export interface CompletenessMatrix {
  class_uri: string;
  class: string;
  properties: string[];
  property_info: MatrixPropertyInfo[];
  summary: { total_entities: number; by_property: PropertyResult[]; overall_completeness: number };
  pagination?: { limit: number; offset: number; count: number; total: number | null };
  entities: EntityRow[];
}

export interface ClassSummaryEntry {
  class: string;
  label?: string | null;
  uri: string;
  total_entities: number;
  properties_count: number;
  completeness: number;
  by_property: PropertyResult[];
}
export interface ClassSummary {
  classes: ClassSummaryEntry[];
  total_entities: number;
  overall_completeness: number;
}

export interface LinkDetail {
  direction: 'outgoing' | 'incoming';
  property: string;
  propertyLabel?: string | null;
  targetClass?: string | null;
  sourceClass?: string | null;
  count: number;
}
export interface InterlinkingClass {
  class: string;
  label?: string | null;
  total_entities: number;
  linked: number;
  not_linked: number;
  outgoing: number;
  incoming: number;
  ratio: number;
  links: LinkDetail[];
  entity_drilldown: string;
}
export interface Interlinking {
  classes: InterlinkingClass[];
  overall_ratio: number;
}
export interface InterlinkingEntities {
  class: string;
  status: 'linked' | 'not_linked';
  entities: { uri: string; label?: string | null }[];
  pagination: { limit: number; offset: number; count: number; total: number | null };
}

export interface IntraSourceResult {
  total_representations: number;
  unique_instances: number;
  violating_instances: number;
  score_f1: number;
  score_f2: number;
  passed: boolean;
}

export interface CrossSourceResult {
  total_entities: number;
  ambiguous_instances: number;
  cn3_score: number;
  sources: string[];
  note?: string;
}

export interface PaginationInfo {
  limit: number;
  offset: number;
  count: number;
  total: number | null;
}

export interface IntraDuplicateGroup {
  identity_values: Record<string, string>;
  uris: string[];
  count: number;
}

export interface CrossDuplicateGroup {
  identity_values: Record<string, string>;
  entities: { source: string; uri: string }[];
  count: number;
}

export interface PaginatedIntraDuplicates {
  pagination: PaginationInfo;
  items: IntraDuplicateGroup[];
}

export interface PaginatedCrossDuplicates {
  pagination: PaginationInfo;
  items: CrossDuplicateGroup[];
}

export const concisenessApi = {
  intraSource: (params: { class_uri: string; identity_props: string; source_prefix: string }) =>
    get<IntraSourceResult>('/conciseness/intra-source', params),
  crossSource: (params: { class_uri: string; identity_props: string; sources: string }) =>
    get<CrossSourceResult>('/conciseness/cross-source', params),
  intraSourceDuplicates: (params: { class_uri: string; identity_props: string; source_prefix: string; limit?: number; offset?: number; include_total?: boolean }) =>
    get<PaginatedIntraDuplicates>('/conciseness/intra-source/duplicates', params),
  crossSourceDuplicates: (params: { class_uri: string; identity_props: string; sources: string; limit?: number; offset?: number; include_total?: boolean }) =>
    get<PaginatedCrossDuplicates>('/conciseness/cross-source/duplicates', params),
};

export const completenessApi = {
  mappingCoverage: () => get<MappingCoverage>('/completeness/mapping-coverage'),
  matrix: (params: { class_uri: string; properties: string; filter_facets?: string; limit?: number; offset?: number }) =>
    get<CompletenessMatrix>('/completeness/matrix', params),
  classSummary: () => get<ClassSummary>('/completeness/class-summary'),
  interlinking: () => get<Interlinking>('/completeness/interlinking'),
  interlinkingEntities: (params: { class_name: string; status: 'linked' | 'not_linked'; limit?: number; offset?: number }) =>
    get<InterlinkingEntities>('/completeness/interlinking/entities', params),
};

export function statusFor(percent: number): 'good' | 'warn' | 'bad' {
  if (percent >= 90) return 'good';
  if (percent >= 70) return 'warn';
  return 'bad';
}

export function statusColor(percent: number): string {
  const s = statusFor(percent);
  if (s === 'good') return '#1F8A4C';
  if (s === 'warn') return '#E08B1A';
  return '#9E2B0A';
}
