import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  completenessApi,
  MappingCoverage,
  MappingItemsResponse,
  MappingItemKind,
  MappingItemStatus,
  statusColor,
} from '../../lib/api';
import { Headline, Section, LoadingState, ErrorState, PaginatedTable, SearchInput } from './_shared';

const PAGE = 10;

export default function SchemaCompleteness() {
  const [data, setData] = useState<MappingCoverage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    completenessApi.schema().then(setData).catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  const classColor = statusColor(data.classes.coverage);
  const propColor = statusColor(data.properties.coverage);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Headline value={data.overall_coverage} label="Overall Schema Coverage" sub="Mapped classes + properties / total" />
        <Headline value={data.classes.coverage} label="Class Coverage" sub={`${data.classes.mapped} / ${data.classes.total} classes mapped`} />
        <Headline value={data.properties.coverage} label="Property Coverage" sub={`${data.properties.mapped} / ${data.properties.total} properties mapped`} />
      </div>

      <Section title="Mapping Distribution">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DonutCard
            title="Classes"
            mapped={data.classes.mapped}
            unmapped={data.classes.unmapped}
            color={classColor}
          />
          <DonutCard
            title="Properties"
            mapped={data.properties.mapped}
            unmapped={data.properties.unmapped}
            color={propColor}
          />
        </div>
      </Section>

      <Section
        title="Class Mapping"
        subtitle="Which ontology classes are backed by an OBDA mapping vs left unmapped."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <PaginatedInventory kind="class" status="mapped" title="Mapped Classes" />
          <PaginatedInventory kind="class" status="unmapped" title="Unmapped Classes" />
        </div>
      </Section>

      <Section
        title="Property Mapping"
        subtitle="Which ontology properties are backed by an OBDA mapping vs left unmapped."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <PaginatedInventory kind="property" status="mapped" title="Mapped Properties" />
          <PaginatedInventory kind="property" status="unmapped" title="Unmapped Properties" />
        </div>
      </Section>
    </div>
  );
}

function DonutCard({ title, mapped, unmapped, color }: { title: string; mapped: number; unmapped: number; color: string }) {
  const total = mapped + unmapped;
  const pct = total > 0 ? (mapped / total) * 100 : 0;
  const chart = [
    { name: 'Mapped', value: mapped, color },
    { name: 'Unmapped', value: unmapped, color: 'var(--muted)' },
  ];
  return (
    <div
      className="p-4 border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
    >
      <div className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>{title}</div>
      <div className="relative" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chart} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={2}>
              {chart.map((c, i) => (
                <Cell key={i} fill={c.color} />
              ))}
            </Pie>
            <Tooltip
              wrapperStyle={{ zIndex: 50 }}
              contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-3xl" style={{ color }}>{pct.toFixed(1)}%</div>
          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{mapped} / {total}</div>
        </div>
      </div>
    </div>
  );
}

function PaginatedInventory({ kind, status, title }: { kind: MappingItemKind; status: MappingItemStatus; title: string }) {
  const mapped = status === 'mapped';
  const Icon = mapped ? CheckCircle2 : XCircle;
  const tone = mapped ? '#1F8A4C' : '#9E2B0A';

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE);
  const [data, setData] = useState<MappingItemsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setOffset(0);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    completenessApi
      .schemaItems({ kind, status, q: debouncedQuery || undefined, limit: pageSize, offset })
      .then((r) => {
        if (cancelled) return;
        setData(r);
        setError(null);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [kind, status, debouncedQuery, pageSize, offset]);

  const total = data?.pagination.total ?? null;

  return (
    <div
      className="p-4 border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--text)' }}>{title}</span>
          {total != null && (
            <span
              className="px-2 py-0.5 text-xs"
              style={{ backgroundColor: `${tone}1A`, color: tone, borderRadius: 'var(--radius-sm)' }}
            >
              {total}
            </span>
          )}
        </div>
        <SearchInput value={query} onChange={setQuery} width="w-44" compact />
      </div>

      {error ? (
        <div className="text-sm py-2" style={{ color: '#9E2B0A' }}>{error}</div>
      ) : (
        <PaginatedTable
          colSpan={1}
          pagination={data?.pagination ?? null}
          pageSize={pageSize}
          loading={loading}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setOffset(0);
          }}
          onPrev={() => setOffset(Math.max(0, offset - pageSize))}
          onNext={() => setOffset(offset + pageSize)}
          emptyState={
            <div className="text-sm py-3" style={{ color: 'var(--muted-foreground)' }}>
              {debouncedQuery.trim() ? `No items match “${debouncedQuery.trim()}”.` : 'None'}
            </div>
          }
          head={
            <th className="text-left px-4 py-3" style={{ color: 'var(--text-on-dark)' }}>
              {kind === 'class' ? 'Class' : 'Property'}
            </th>
          }
        >
          {data?.items.map((it) => (
            <tr key={it.uri} style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
              <td className="px-4 py-2 text-sm" style={{ color: 'var(--text)' }} title={it.uri}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" style={{ color: tone }} />
                  <span className="truncate">
                    {it.label ? `${it.label} ` : ''}
                    <span style={{ color: 'var(--muted-foreground)' }}>({it.localName})</span>
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </PaginatedTable>
      )}
    </div>
  );
}
