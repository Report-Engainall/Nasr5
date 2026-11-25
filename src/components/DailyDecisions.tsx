import { useState } from 'react';
import {
  AlertTriangle, ArrowUpRight, BrainCircuit, Check, Info, RefreshCw,
} from 'lucide-react';
import { fetchDailyDecisions, type DailyDecision } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { formatCurrency } from '@/lib/format';
import { AdminPage, Button, Empty, ErrorBox, Loading } from '@/components/AdminPages';

type DecisionTarget = 'finance' | 'orders' | null;

export function DailyDecisions({ onNotice, onNavigate }: { onNotice: (m: string) => void; onNavigate: (target: DecisionTarget) => void }) {
  const { data: decisions, loading, error, refetch } = useFetch(fetchDailyDecisions);
  const [handled, setHandled] = useState<Set<string>>(new Set());

  function markHandled(id: string, target: DecisionTarget) {
    setHandled((prev) => new Set(prev).add(id));
    if (target) onNavigate(target);
    onNotice('تم تسجيل إجراء القرار');
  }

  const criticalCount = decisions?.filter((d) => d.severity === 'critical' && !handled.has(d.id)).length ?? 0;

  return <AdminPage
    eyebrow="الذكاء والأتمتة" title="محرك القرارات اليومية" description="أهم 10 قرارات مرتبة حسب المخاطر والأثر المالي — كل قرار بمصدر وسبب وإجراء"
    icon={BrainCircuit} note={`${decisions?.filter((d) => !handled.has(d.id)).length ?? 0} قرار مفتوح — ${criticalCount} حرج`}
    toolbar={<Button variant="secondary" onClick={refetch}><RefreshCw size={16} /> إعادة التقييم</Button>}>
    {loading ? <Loading /> : error ? <ErrorBox message={error} /> : decisions?.length ? <div className="rule-grid">
      {decisions.slice(0, 10).map((d: DailyDecision) => <article className={`rule-card decision-card ${handled.has(d.id) ? 'handled' : ''}`} key={d.id}>
        <div>
          <div><span className={`decision-icon ${d.severity}`}>{d.severity === 'critical' ? <AlertTriangle size={15} /> : d.severity === 'warning' ? <AlertTriangle size={15} /> : <Info size={15} />}</span><h2>{d.title}</h2></div>
          <span className="decision-impact">{formatCurrency(d.impactValue)}</span>
        </div>
        <div className="decision-facts">
          <div><strong>المشكلة</strong><span>{d.problem}</span></div>
          <div><strong>السبب</strong><span>{d.cause}</span></div>
          <div><strong>المصدر</strong><span>{d.source}</span></div>
          <div><strong>الأثر</strong><span>{d.impact}</span></div>
        </div>
        <p className="decision-action"><strong>الإجراء:</strong> {d.action}</p>
        <div className="decision-actions">
          <Button variant="outline" onClick={() => markHandled(d.id, null)}><Check size={14} /> تم المعالجة</Button>
          {(d.id.startsWith('debtor') || d.id.startsWith('payable') || d.id.startsWith('oos') || d.id.startsWith('low')) && <Button onClick={() => markHandled(d.id, 'finance')}><ArrowUpRight size={14} /> تنفيذ من المالية</Button>}
          {d.id.startsWith('stalled') && <Button onClick={() => markHandled(d.id, 'orders')}><ArrowUpRight size={14} /> فتح الطلبات</Button>}
        </div>
      </article>)}
    </div> : <div className="sf-empty" style={{ padding: '40px 0' }}><Check size={30} /><span>لا توجد قرارات عاجلة الآن</span><small>كل المؤشرات ضمن الحدود الآمنة</small></div>}
  </AdminPage>;
}
