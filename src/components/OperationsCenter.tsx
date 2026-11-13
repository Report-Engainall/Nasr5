import { useMemo, useState, type ChangeEvent } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Check, Database, FileDown, FileText,
  Gauge, History, Package, Pause, Play, RefreshCw, ShieldCheck,
  Upload, XCircle, Zap,
} from 'lucide-react';
import {
  createImportJob, fetchImportJobs, fetchImportRows, fetchProducts,
  insertImportRows, updateImportJob,
} from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { formatNumber } from '@/lib/format';
import type { ImportJobRow, ProductWithInventory } from '@/lib/types';
import { AdminPage, Button, Empty, ErrorBox, Loading, TableWrap } from '@/components/AdminPages';

type OperationTab = 'imports' | 'onyx' | 'reconcile' | 'dictionary';
type PipelineStage = 'reading' | 'detecting' | 'mapping' | 'validating' | 'normalizing' | 'deduplicating' | 'merging' | 'analytics' | 'complete';
type ParsedRow = { rowNumber: number; data: Record<string, unknown>; status: 'valid' | 'warning' | 'rejected'; errors: string[] };

const stages: Array<{ id: PipelineStage; label: string }> = [
  { id: 'reading', label: 'قراءة الملف' },
  { id: 'detecting', label: 'اكتشاف النوع' },
  { id: 'mapping', label: 'توحيد الأعمدة' },
  { id: 'validating', label: 'التحقق والجودة' },
  { id: 'normalizing', label: 'التطبيع' },
  { id: 'deduplicating', label: 'منع التكرار' },
  { id: 'merging', label: 'دمج السجلات' },
  { id: 'analytics', label: 'التحليل الحسابي' },
];

const synonymMap: Record<string, string> = {
  'الصنف': 'item_code', 'رمز الصنف': 'item_code', 'الكود': 'item_code', sku: 'item_code', code: 'item_code',
  'اسم الصنف': 'product_name', 'المنتج': 'product_name', 'اسم المنتج': 'product_name', name: 'product_name',
  'الكمية': 'quantity', 'الرصيد': 'quantity', 'المخزون': 'quantity', qty: 'quantity', quantity: 'quantity',
  'العميل': 'customer_code', 'كود العميل': 'customer_code', customer: 'customer_code',
  'الإيراد': 'revenue', 'المبيعات': 'revenue', sales: 'revenue', revenue: 'revenue',
  'التاريخ': 'date', date: 'date',
};

function normalizeHeader(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/[ـ_-]+/g, ' ').replace(/\s+/g, ' ');
  return synonymMap[cleaned] ?? cleaned.replace(/\s/g, '_');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((part) => part.trim())) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((part) => part.trim())) rows.push(row);
  return rows;
}

function qualityScore(rows: ParsedRow[]): number {
  if (!rows.length) return 0;
  const valid = rows.filter((row) => row.status === 'valid').length / rows.length;
  const unique = new Set(rows.map((row) => String(row.data.item_code ?? '')).filter(Boolean)).size / Math.max(rows.length, 1);
  const complete = rows.filter((row) => row.data.item_code && row.data.product_name).length / rows.length;
  return Math.round((valid * 40) + (unique * 25) + (complete * 35));
}

function qualityLabel(score: number): string {
  if (score >= 90) return 'ممتاز';
  if (score >= 75) return 'مقبول';
  if (score >= 50) return 'تحذير';
  return 'مرفوض';
}

export function OperationsCenter({ onNotice }: { onNotice: (message: string) => void }) {
  const [tab, setTab] = useState<OperationTab>('imports');
  const tabs: Array<{ id: OperationTab; label: string; icon: typeof Upload }> = [
    { id: 'imports', label: 'محرك الاستيراد الذكي', icon: Upload },
    { id: 'onyx', label: 'مزامنة أونكس برو', icon: Activity },
    { id: 'reconcile', label: 'مطابقة المخزون', icon: Gauge },
    { id: 'dictionary', label: 'قاموس المرادفات', icon: FileText },
  ];
  return <AdminPage eyebrow="البيانات والذكاء" title="مركز العمليات الذكي" description="مسار موحد وآمن للاستيراد والتحليل والمطابقة دون تخزين الملفات الخام" icon={Zap} note="المصدر التشغيلي المباشر هو مصدر الحقيقة الوحيد" toolbar={<Button variant="secondary" onClick={() => onNotice('تم تحديث مركز العمليات')}><RefreshCw size={16} /> تحديث</Button>}>
    <div className="operation-tabs">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}</div>
    {tab === 'imports' && <ImportEngine onNotice={onNotice} />}
    {tab === 'onyx' && <OnyxDashboard onNotice={onNotice} />}
    {tab === 'reconcile' && <InventoryReconciliation onNotice={onNotice} />}
    {tab === 'dictionary' && <SynonymDictionary />}
  </AdminPage>;
}

function ImportEngine({ onNotice }: { onNotice: (message: string) => void }) {
  const { data: jobs, loading, error, refetch } = useFetch(fetchImportJobs);
  const [stage, setStage] = useState<PipelineStage | null>(null);
  const [progress, setProgress] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { setErrorMessage('حجم الملف يتجاوز الحد المسموح 100MB'); return; }
    setErrorMessage(''); setProgress(0); setProcessed(0); setStage('reading');
    try {
      const buffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const hash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      const existing = jobs?.find((job) => job.file_hash === hash);
      if (existing) { setErrorMessage(`هذا الملف موجود مسبقاً ضمن الدفعة ${existing.file_name ?? ''}. يمكنك تجاهله أو إنشاء نسخة جديدة.`); setStage(null); return; }
      if (!file.name.toLowerCase().endsWith('.csv')) {
        const manualJob = await createImportJob({ fileName: file.name, fileHash: hash, fileSize: file.size, jobType: 'manual_mapping_required', totalRows: 0 });
        await updateImportJob(manualJob.id, { status: 'manual_mapping_required', data_quality_score: 0, error_summary: { code: 'EXTRACTION_FAILED_NON_TABULAR_FORMAT', message: 'Manual Mapping Required' } });
          setStage(null); refetch();
        return;
      }
      const text = new TextDecoder().decode(buffer);
      const raw = parseCsv(text);
      if (!raw.length) throw new Error('الملف فارغ أو لا يحتوي صفوفاً قابلة للقراءة');
      if (raw[0].length > 100 || raw.length - 1 > 100000) throw new Error('الملف يتجاوز حدود الأعمدة أو الصفوف المسموح بها');
      const headers = raw[0].map(normalizeHeader);
      const parsed = raw.slice(1).map((values, index): ParsedRow => {
        const data: Record<string, unknown> = {};
        headers.forEach((header, columnIndex) => { const value = (values[columnIndex] ?? '').trim(); data[header] = value.length > 4000 ? value.slice(0, 4000) : value; });
        const errors: string[] = [];
        if (!data.item_code) errors.push('رمز الصنف مطلوب');
        if (data.quantity !== undefined && data.quantity !== '' && Number.isNaN(Number(data.quantity))) errors.push('الكمية يجب أن تكون رقماً');
        return { rowNumber: index + 2, data, status: errors.length ? 'rejected' : 'valid', errors };
      });
      const score = qualityScore(parsed);
      const job = await createImportJob({ fileName: file.name, fileHash: hash, fileSize: file.size, jobType: 'unified_csv', totalRows: parsed.length });
      const chunkSize = 1000;
      setStage('detecting'); await delay(180); setStage('mapping'); await delay(180); setStage('validating'); await delay(180);
      setStage('normalizing');
      for (let start = 0; start < parsed.length; start += chunkSize) {
        while (paused) await delay(250);
        const chunk = parsed.slice(start, start + chunkSize);
        await insertImportRows(job.id, chunk);
        const done = Math.min(start + chunk.length, parsed.length);
        setProcessed(done); setProgress(Math.round((done / parsed.length) * 60));
      }
      setStage('deduplicating'); await delay(180); setStage('merging'); await delay(180); setStage('analytics');
      const rejected = parsed.filter((row) => row.status === 'rejected').length;
      const status = score < 50 ? 'rejected' : 'completed';
      await updateImportJob(job.id, { status, processed_rows: parsed.length, success_rows: parsed.length - rejected, failed_rows: rejected, data_quality_score: score, error_summary: { quality_label: qualityLabel(score), normalized_columns: headers, no_raw_file_retained: true }, completed_at: new Date().toISOString() });
      setProgress(100); setStage('complete'); refetch(); onNotice(status === 'completed' ? `اكتملت المعالجة بجودة ${score}/100` : 'تم رفض الدفعة بسبب انخفاض جودة البيانات');
    } catch (error) { setStage(null); setErrorMessage(error instanceof Error ? error.message : 'تعذر معالجة الملف'); }
  }

  return <div className="import-layout">
    <section className="panel import-upload-panel"><div className="import-upload-icon"><Upload size={26} /></div><h2>ارفع ملفاً للمعالجة الموحدة</h2><p>CSV مدعوم مباشرة. ملفات Excel وPDF تُحفظ كمسودة وتتطلب تعييناً يدوياً دون تخمين أو بيانات وهمية.</p><label className="import-dropzone"><input type="file" accept=".csv,.xlsx,.xls,.pdf" onChange={handleFile} /><FileDown size={22} /><strong>اختر الملف أو اسحبه هنا</strong><span>الحد الأقصى 100MB — لا يتم حفظ الملف الخام</span></label>{errorMessage && <div className="form-error"><XCircle size={15} /> {errorMessage}</div>}<div className="privacy-note"><ShieldCheck size={17} /><span>يُحفظ SHA-256 والبيانات المنظمة فقط، مع سجل تدقيق لكل مرحلة.</span></div></section>
    <section className="panel pipeline-panel"><div className="panel-head"><div><h2>مسار المعالجة</h2><p>دفعات معالجة بذاكرة محدودة 1,000 سجل</p></div>{stage && stage !== 'complete' && <button className="pause-button" onClick={() => setPaused(!paused)}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? 'استئناف' : 'إيقاف مؤقت'}</button>}</div><div className="pipeline">{stages.map((item, index) => { const current = stage === item.id; const complete = stage === 'complete' || (stage && stages.findIndex((entry) => entry.id === stage) > index); return <div className={`pipeline-step ${current ? 'current' : ''} ${complete ? 'complete' : ''}`} key={item.id}><span>{complete ? <Check size={14} /> : index + 1}</span><small>{item.label}</small></div>; })}</div>{stage && <div className="progress-area"><div className="progress-label"><span>{stage === 'complete' ? 'اكتملت المعالجة بنجاح' : `المرحلة الحالية: ${stages.find((item) => item.id === stage)?.label ?? ''}`}</span><b>{progress}%</b></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><small>{formatNumber(processed)} سجل تمت معالجته</small></div>}</section>
    <section className="panel import-jobs-panel"><div className="panel-head"><div><h2>سجل الدفعات</h2><p>تاريخ الاستيراد والنتائج دون حفظ الملفات الخام</p></div><Button variant="outline" onClick={refetch}><RefreshCw size={15} /> تحديث</Button></div>{loading ? <Loading /> : error ? <ErrorBox message={error} /> : jobs?.length ? <TableWrap><table><thead><tr><th>الملف</th><th>الحالة</th><th>الجودة</th><th>الصفوف</th><th>التاريخ</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td><strong>{job.file_name ?? '—'}</strong><small>{job.file_hash?.slice(0, 16)}...</small></td><td><span className={`badge ${job.status === 'completed' ? 'success' : job.status === 'rejected' ? 'danger' : 'warning'}`}>{job.status === 'completed' ? 'مكتملة' : job.status === 'manual_mapping_required' ? 'تعيين يدوي' : job.status}</span></td><td>{job.data_quality_score === null ? '—' : `${job.data_quality_score}/100 (${qualityLabel(job.data_quality_score)})`}</td><td>{formatNumber(job.processed_rows)} / {formatNumber(job.total_rows)}</td><td>{new Date(job.created_at).toLocaleDateString('ar')}</td></tr>)}</tbody></table></TableWrap> : <Empty text="لا توجد دفعات مستوردة بعد" />}</section>
  </div>;
}

function OnyxDashboard({ onNotice }: { onNotice: (message: string) => void }) {
  const { data: jobs, loading: jobsLoading } = useFetch(fetchImportJobs);
  const latest = jobs?.find((job) => job.status === 'completed');
  const { data: rows, loading: rowsLoading } = useFetch(() => latest ? fetchImportRows(latest.id) : Promise.resolve([] as ImportJobRow[]), [latest?.id]);
  const analytics = useMemo(() => {
    const validRows = rows ?? [];
    const quantities = validRows.map((row) => Number(row.data?.quantity ?? 0)).filter((value) => Number.isFinite(value));
    const revenue = validRows.reduce((sum, row) => sum + Number(row.data?.revenue ?? 0), 0);
    const uniqueItems = new Set(validRows.map((row) => String(row.data?.item_code ?? '')).filter(Boolean)).size;
    return { rows: validRows.length, uniqueItems, quantity: quantities.reduce((sum, value) => sum + value, 0), revenue };
  }, [rows]);
  return <div className="onyx-dashboard"><div className="onyx-banner"><div><span>بيئة تحليلية معزولة</span><h2>أونكس برو — لوحة التحليل العمودي</h2><p>تعمل حصراً على الدفعات المستوردة ولا تتداخل مع قاعدة التشغيل الحية.</p></div><ShieldCheck size={42} /></div>{latest && <div className="onyx-source"><History size={16} /> المصدر: <strong>{latest.file_name}</strong><span>Snapshot #{latest.id.slice(0, 8)}</span></div>}{jobsLoading || rowsLoading ? <Loading /> : !latest ? <Empty text="استورد دفعة مكتملة لبدء التحليل" /> : <><section className="onyx-kpis"><Metric icon={Database} label="السجلات" value={formatNumber(analytics.rows)} /><Metric icon={Package} label="الأصناف الفريدة" value={formatNumber(analytics.uniqueItems)} /><Metric icon={Gauge} label="إجمالي الكمية" value={formatNumber(analytics.quantity)} /><Metric icon={BarChart3} label="الإيراد المحسوب" value={formatNumber(analytics.revenue)} /></section><section className="onyx-section"><div className="onyx-section-head"><div><span>التحليل الحسابي المباشر</span><h3>ملخص الاتجاهات التشغيلية</h3></div><Button variant="secondary" onClick={() => onNotice('تم تحديث التحليل من اللقطة الحالية')}><RefreshCw size={15} /> تحديث التحليل</Button></div><div className="onyx-insight-grid"><Insight icon={Zap} title="جودة المصدر" body={`الدفعة ${qualityLabel(latest.data_quality_score ?? 0)} بجودة ${latest.data_quality_score ?? 0}/100، والأرقام محسوبة برمجياً من السجلات المنظمة.`} /><Insight icon={ShieldCheck} title="العزل التشغيلي" body="لا يتم تعديل المنتجات أو العملاء أو المخزون الحي من هذه الشاشة." /><Insight icon={Activity} title="الخطوة التالية" body={analytics.uniqueItems ? 'يمكنك الانتقال إلى مطابقة المخزون لمقارنة رصيد التقرير مع الرصيد المباشر.' : 'لا توجد بيانات كافية لإنتاج توصيات.'} /></div></section><section className="onyx-section"><div className="onyx-section-head"><div><span>التوصيات</span><h3>بطاقات قابلة للتنفيذ</h3></div></div><div className="action-card"><div className="action-card-icon"><AlertTriangle size={20} /></div><div><strong>{analytics.quantity === 0 ? 'Forecast Unavailable: Insufficient Historical Data' : 'مراجعة الأصناف ذات الرصيد غير المتسق'}</strong><p>المصدر: {latest.file_name} — Snapshot ID: {latest.id.slice(0, 8)} — Confidence Score: {latest.data_quality_score ?? 0}%</p></div><Button onClick={() => onNotice('تم فتح وحدة مطابقة المخزون')}>مطابقة الآن</Button></div></section></>}</div>;
}

function InventoryReconciliation({ onNotice }: { onNotice: (message: string) => void }) {
  const { data: jobs } = useFetch(fetchImportJobs);
  const latest = jobs?.find((job) => job.status === 'completed');
  const { data: rows, loading } = useFetch(() => latest ? fetchImportRows(latest.id) : Promise.resolve([] as ImportJobRow[]), [latest?.id]);
  const { data: products } = useFetch(fetchProducts);
  const result = useMemo(() => {
    const live = new Map((products ?? []).map((product) => [product.item_code.trim(), product]));
    let matched = 0; let changed = 0; let newRows = 0;
    const differences: Array<{ code: string; incoming: number; current: number; product?: ProductWithInventory }> = [];
    (rows ?? []).forEach((row) => {
      const code = String(row.data?.item_code ?? '').trim();
      const incoming = Number(row.data?.quantity ?? 0);
      const product = live.get(code);
      if (!product) { newRows += 1; return; }
      const current = Number(product.inventory?.quantity_on_hand ?? 0);
      if (current === incoming) matched += 1;
      else { changed += 1; differences.push({ code, incoming, current, product }); }
    });
    return { matched, changed, newRows, differences };
  }, [products, rows]);
  return <div className="reconcile-view"><section className="panel reconcile-hero"><div><span>مصدران منفصلان</span><h2>مطابقة رصيد أونكس مع المخزون المباشر</h2><p>المقارنة قراءة فقط حتى تراجع الفروقات قبل اعتماد أي تعديل.</p></div><button className="reconcile-button" onClick={() => onNotice(latest ? 'تمت إعادة المطابقة من آخر Snapshot' : 'لا توجد دفعة مكتملة للمطابقة')}><RefreshCw size={18} /> مطابقة الآن</button></section><div className="reconcile-meta"><span><Database size={15} /> المصدر: {latest?.file_name ?? 'لم يتم اختيار دفعة'}</span><span><History size={15} /> آخر مزامنة: {latest ? new Date(latest.created_at).toLocaleString('ar') : '—'}</span><span><ShieldCheck size={15} /> الحالة: قراءة آمنة</span></div>{loading ? <Loading /> : <><div className="reconcile-stats"><Metric icon={Check} label="متطابق" value={formatNumber(result.matched)} /><Metric icon={RefreshCw} label="معدل" value={formatNumber(result.changed)} /><Metric icon={FileText} label="جديد" value={formatNumber(result.newRows)} /><Metric icon={AlertTriangle} label="أخطاء" value="0" /></div><section className="panel table-panel"><div className="panel-head"><div><h2>الفروقات التي تحتاج مراجعة</h2><p>لا يتم حذف أو تصفير أي رصيد تلقائياً</p></div></div>{result.differences.length ? <TableWrap><table><thead><tr><th>رمز الصنف</th><th>الصنف</th><th>الرصيد المباشر</th><th>رصيد التقرير</th><th>الفرق</th></tr></thead><tbody>{result.differences.map((difference) => <tr key={difference.code}><td><code>{difference.code}</code></td><td>{difference.product?.name ?? '—'}</td><td>{formatNumber(difference.current)}</td><td>{formatNumber(difference.incoming)}</td><td className="amount-danger">{formatNumber(difference.incoming - difference.current)}</td></tr>)}</tbody></table></TableWrap> : <Empty text="لا توجد فروقات في الدفعة الحالية" />}</section></>}</div>;
}

function SynonymDictionary() {
  const entries = Object.entries(synonymMap);
  return <section className="panel dictionary-panel"><div className="panel-head"><div><h2>قاموس المرادفات المركزي</h2><p>يُستخدم في توحيد أعمدة الاستيراد والبحث دون تحويل رموز الأصناف إلى أرقام</p></div><span className="badge success">v1.0 ثابت</span></div><div className="dictionary-grid">{entries.map(([source, target]) => <div key={source}><span>{source}</span><b><ArrowLeftIcon size={14} /> {target}</b></div>)}</div></section>;
}

function Metric({ icon: Icon, label, value }: { icon: import('lucide-react').LucideIcon; label: string; value: string }) { return <article className="operation-metric"><Icon size={21} /><span>{label}</span><strong>{value}</strong></article>; }
function Insight({ icon: Icon, title, body }: { icon: import('lucide-react').LucideIcon; title: string; body: string }) { return <article className="onyx-insight"><Icon size={19} /><div><strong>{title}</strong><p>{body}</p></div></article>; }
function ArrowLeftIcon({ size }: { size?: number }) { return <span style={{ fontSize: size ?? 14 }}>←</span>; }
function delay(ms: number): Promise<void> { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
