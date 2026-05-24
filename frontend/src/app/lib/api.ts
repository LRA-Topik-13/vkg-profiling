const BASE = import.meta.env.VITE_API_BASE || '/api';

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
  sources: () => get<{ sources: string[] }>('/metadata/sources'),
  mappedClasses: () => get<{ classes: ClassMeta[] }>('/metadata/mapped-classes'),
  mappedProperties: (classUri?: string) =>
    get<{ properties: PropertyMeta[]; class?: string }>('/metadata/mapped-properties', { class_uri: classUri }),
  allProperties: () => get<{ properties: PropertyMeta[] }>('/metadata/all-properties'),
  facets: (classUri: string, propertyUri: string) =>
    get<{ values: string[] }>('/metadata/facets', { class_uri: classUri, property_uri: propertyUri }),
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


export interface AccuracyViolation {
  criterion?: string;
  message: string;
}

export interface AccuracyRelationshipEntity {
  uri: string;
  count: number;
  is_outlier: boolean;
  status: 'ok' | 'warning' | string;
  violations: AccuracyViolation[];
}

export interface AccuracyPresencePropertyStat {
  property: string;
  fill_count: number;
  fill_rate: number;
  threshold: number;
  is_majority: boolean;
}

export interface AccuracyPresenceEntity {
  uri: string;
  filled_count: number;
  total_props: number;
  prop_status: Record<string, boolean>;
  outlier_properties: Array<{ property: string; fill_rate: number; fill_pct: number; has_value: boolean; is_majority: boolean }>;
  is_outlier: boolean;
  status: 'ok' | 'warning' | string;
  violations: AccuracyViolation[];
}

export interface AccuracyOutlierResult {
  uri: string;
  class: string;
  property?: string;
  type: 'relationship_count' | 'property_presence_anomaly' | string;
  statistics: Partial<{ q1: number; q3: number; iqr: number; lower_fence: number; upper_fence: number; insufficient_data: boolean }>;
  properties_checked?: string[];
  property_stats?: AccuracyPresencePropertyStat[];
  outlier_count: number;
  total: number;
  entities: Array<AccuracyRelationshipEntity | AccuracyPresenceEntity>;
}

export interface AccuracyPairEndpointEntity {
  uri: string;
  source: string;
  values: string[];
  value: string;
}

export interface AccuracyPairRow {
  identity_values: Record<string, string>;
  e1: AccuracyPairEndpointEntity;
  e2: AccuracyPairEndpointEntity;
}

export interface AccuracyWithinSourceSummaryEntry {
  source: string;
  source_label: string;
  total_matched: number;
  conflicting_pairs: number;
  conflict_rate: number | null;
  sa2_score: number | null;
}

export interface AccuracyCrossSourceSummaryEntry {
  source_a: string;
  source_b: string;
  source_a_label: string;
  source_b_label: string;
  total_matched: number;
  conflicting_pairs: number;
  conflict_rate: number | null;
  sa2_cross_score: number | null;
}

export interface AccuracyValueConflictSummary {
  uri: string;
  class: string;
  target_property: string;
  target_prop_uri: string;
  identity_props: string[];
  identity_prop_uris: string[];
  sources: string[];
  counting_unit: string;
  total_matched: number;
  conflicting_pairs: number;
  conflict_rate: number | null;
  sa2_score?: number | null;
  sa2_cross_score?: number | null;
  source_summary?: AccuracyWithinSourceSummaryEntry[];
  source_pair_summary?: AccuracyCrossSourceSummaryEntry[];
}

export interface AccuracyValueConflictRows {
  limit: number;
  offset: number;
  returned_count: number;
  sample_size: number;
  pairs: AccuracyPairRow[];
  sample?: AccuracyPairRow[];
}

export interface AccuracyPropertyMisuseClass {
  uri: string;
  class: string;
  expected: boolean;
  count: number;
  entity_uris: string[];
  entities_truncated: boolean;
}

export interface AccuracyPropertyMisuseResult {
  property: string;
  uri: string;
  expected_for_classes: string[];
  total_expected_count: number;
  total_misuse_count: number;
  total_property_uses: number;
  sa4_score: number;
  classes: AccuracyPropertyMisuseClass[];
}

export const accuracyApi = {
  outliers: (params: { class_uri: string; type: string; property_uri?: string }) =>
    get<AccuracyOutlierResult>('/accuracy/outliers', params),
  valueConflictSummary: (params: { class_uri: string; identity_props: string; target_prop: string; sources?: string }) =>
    get<AccuracyValueConflictSummary>('/accuracy/value-conflict/summary', params),
  valueConflictRows: (params: { class_uri: string; identity_props: string; target_prop: string; sources?: string; limit?: number; offset?: number }) =>
    get<AccuracyValueConflictRows>('/accuracy/value-conflict/rows', params),
  valueConflictCrossSourceSummary: (params: { class_uri: string; identity_props: string; target_prop: string; sources?: string }) =>
    get<AccuracyValueConflictSummary>('/accuracy/value-conflict/cross-source/summary', params),
  valueConflictCrossSourceRows: (params: { class_uri: string; identity_props: string; target_prop: string; sources?: string; limit?: number; offset?: number; sample_limit?: number }) =>
    get<AccuracyValueConflictRows>('/accuracy/value-conflict/cross-source/rows', params),
  propertyMisuseByProperty: (property_uri: string) =>
    get<AccuracyPropertyMisuseResult>('/accuracy/property-misuse/by-property', { property_uri }),
};

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
  intraSource: (params: { class_uri: string; identity_props: string; source_prefix: string; filter_facets?: string }) =>
    get<IntraSourceResult>('/conciseness/intra-source', params),
  crossSource: (params: { class_uri: string; identity_props: string; sources: string; filter_facets?: string }) =>
    get<CrossSourceResult>('/conciseness/cross-source', params),
  intraSourceDuplicates: (params: { class_uri: string; identity_props: string; source_prefix: string; filter_facets?: string; limit?: number; offset?: number; include_total?: boolean }) =>
    get<PaginatedIntraDuplicates>('/conciseness/intra-source/duplicates', params),
  crossSourceDuplicates: (params: { class_uri: string; identity_props: string; sources: string; filter_facets?: string; limit?: number; offset?: number; include_total?: boolean }) =>
    get<PaginatedCrossDuplicates>('/conciseness/cross-source/duplicates', params),
};

export const completenessApi = {
  mappingCoverage: () => get<MappingCoverage>('/completeness/mapping-coverage'),
  matrix: (params: { class_uri: string; properties: string; filter_facets?: string; limit?: number; offset?: number }) =>
    get<CompletenessMatrix>('/completeness/matrix', params),
  classSummary: () => get<ClassSummary>('/completeness/class-summary'),
  interlinking: () => get<Interlinking>('/completeness/interlinking'),
  interlinkingEntities: (params: { class_uri: string; status: 'linked' | 'not_linked'; limit?: number; offset?: number }) =>
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
