import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle2, XCircle } from 'lucide-react';
import { completenessApi, MappingCoverage, statusColor } from '../../lib/api';
import { Headline, Section, LoadingState, ErrorState } from './_shared';

export default function SchemaCompleteness() {
  const [data, setData] = useState<MappingCoverage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    completenessApi.mappingCoverage().then(setData).catch((e) => setError(String(e)));
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

      <Section
        title="Mapping Distribution"
        subtitle="Two parallel donuts so the user can compare class and property coverage with identical encoding (small multiples + parallelism)."
      >
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
        title="Mapping Inventory"
        subtitle="Drill-down into the actual ontology items that are mapped vs unmapped. Supports investigation per Gürdür et al. (2019)."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InventoryList title="Unmapped Classes" items={data.classes.unmapped_list} mapped={false} />
          <InventoryList title="Mapped Classes" items={data.classes.mapped_list} mapped />
          <InventoryList title="Unmapped Properties" items={data.properties.unmapped_list} mapped={false} />
          <InventoryList title="Mapped Properties" items={data.properties.mapped_list} mapped />
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
            <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem' }} />
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

function InventoryList({ title, items, mapped }: { title: string; items: { localName: string; label?: string | null }[]; mapped: boolean }) {
  const Icon = mapped ? CheckCircle2 : XCircle;
  const tone = mapped ? '#1F8A4C' : '#9E2B0A';
  return (
    <div
      className="p-4 border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm" style={{ color: 'var(--text)' }}>{title}</div>
        <span
          className="px-2 py-0.5 text-xs"
          style={{ backgroundColor: `${tone}1A`, color: tone, borderRadius: 'var(--radius-sm)' }}
        >
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>None</div>
      ) : (
        <ul className="space-y-1 max-h-72 overflow-auto pr-2">
          {items.map((it) => (
            <li key={it.localName} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
              <Icon className="w-4 h-4 shrink-0" style={{ color: tone }} />
              <span className="truncate">
                {it.label ? `${it.label} ` : ''}
                <span style={{ color: 'var(--muted-foreground)' }}>({it.localName})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
