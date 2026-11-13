import { useMemo, useState } from 'react';
import {
  AlertTriangle, Banknote, Building2, Check, ChevronLeft, CircleDollarSign,
  FileText, Landmark, Package, Plus, RefreshCw, ShoppingCart, TrendingUp, Wallet, X,
} from 'lucide-react';
import {
  createCashAccount, createPurchaseOrder, fetchCashAccounts, fetchCashMovements,
  fetchCustomers, fetchPayments, fetchProducts, fetchPurchaseOrders, fetchReplenishmentSuggestions,
  fetchSuppliers, recordPayment, receivePurchaseOrder,
} from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { formatCurrency, formatDateShort, formatNumber } from '@/lib/format';
import type { CashAccount, Customer, Payment, ProductWithInventory, Supplier } from '@/lib/types';
import { AdminPage, Button, Empty, ErrorBox, Field, Loading, Modal, TableWrap } from '@/components/AdminPages';

type FinanceTab = 'overview' | 'payments' | 'procurement' | 'replenishment';

export function FinanceCenter({ onNotice }: { onNotice: (m: string) => void }) {
  const [tab, setTab] = useState<FinanceTab>('overview');
  const tabs = [
    { id: 'overview' as const, label: 'السيولة والذمم', icon: Wallet },
    { id: 'payments' as const, label: 'المدفوعات والتحصيل', icon: CircleDollarSign },
    { id: 'procurement' as const, label: 'أوامر الشراء', icon: ShoppingCart },
    { id: 'replenishment' as const, label: 'محرك إعادة التوريد', icon: TrendingUp },
  ];
  return <AdminPage
    eyebrow="المالية والمشتريات" title="المركز المالي" description="الصناديق والذمم والمدفوعات والمشتريات بإثبات ومصدر لكل عملية"
    icon={Landmark} note="" toolbar={<Button variant="secondary" onClick={() => onNotice('تم التحديث')}><RefreshCw size={16} /> تحديث</Button>}>
    <div className="operation-tabs">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}</div>
    {tab === 'overview' && <LiquidityView onNotice={onNotice} />}
    {tab === 'payments' && <PaymentsView onNotice={onNotice} />}
    {tab === 'procurement' && <ProcurementView onNotice={onNotice} />}
    {tab === 'replenishment' && <ReplenishmentView onNotice={onNotice} />}
  </AdminPage>;
}

function LiquidityView({ onNotice }: { onNotice: (m: string) => void }) {
  const { data: accounts, loading, error, refetch } = useFetch(fetchCashAccounts);
  const { data: movements } = useFetch(fetchCashMovements);
  const { data: customers } = useFetch(fetchCustomers);
  const { data: suppliers } = useFetch(fetchSuppliers);
  const [modal, setModal] = useState(false);

  const totals = useMemo(() => {
    const cash = (accounts ?? []).reduce((sum, a) => sum + a.opening_balance, 0);
    const movementsIn = (movements ?? []).filter((m) => m.direction === 'in').reduce((s, m) => s + m.amount, 0);
    const movementsOut = (movements ?? []).filter((m) => m.direction === 'out').reduce((s, m) => s + m.amount, 0);
    const receivables = (customers ?? []).reduce((s, c) => s + Math.max(c.current_balance, 0), 0);
    const payables = (suppliers ?? []).reduce((s, sp) => s + Math.max(sp.current_balance, 0), 0);
    return { balance: cash + movementsIn - movementsOut, movementsIn, movementsOut, receivables, payables, workingCapital: cash + movementsIn - movementsOut + receivables - payables };
  }, [accounts, movements, customers, suppliers]);

  const receivableCustomers = (customers ?? []).filter((c) => c.current_balance > 0).sort((a, b) => b.current_balance - a.current_balance).slice(0, 8);
  const payableSuppliers = (suppliers ?? []).filter((s) => s.current_balance > 0).sort((a, b) => b.current_balance - a.current_balance).slice(0, 8);

  return <>
    <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      <article className="stat-card teal"><div className="stat-top"><Wallet size={22} /><span>نقد وتحويلات</span></div><small>رصيد الصناديق والحسابات</small><strong>{formatCurrency(totals.balance)}</strong></article>
      <article className="stat-card blue"><div className="stat-top"><Building2 size={22} /><span>ذمم مدينة</span></div><small>مستحقات لدى العملاء</small><strong>{formatCurrency(totals.receivables)}</strong></article>
      <article className="stat-card orange"><div className="stat-top"><FileText size={22} /><span>ذمم دائنة</span></div><small>التزامات للموردين</small><strong>{formatCurrency(totals.payables)}</strong></article>
      <article className="stat-card green"><div className="stat-top"><TrendingUp size={22} /><span>رأس المال العامل</span></div><small>نقد + ذمم مدينة − ذمم دائنة</small><strong>{formatCurrency(totals.workingCapital)}</strong></article>
    </div>

    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-head"><div><h2>الصناديق والحسابات</h2><p>رصيد افتتاحي موثق لكل حساب</p></div><Button variant="outline" onClick={() => setModal(true)}><Plus size={15} /> حساب جديد</Button></div>
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : <TableWrap><table><thead><tr><th>الحساب</th><th>النوع</th><th>العملة</th><th>الرصيد الافتتاحي</th></tr></thead><tbody>{accounts?.map((a: CashAccount) => <tr key={a.id}><td><strong>{a.name}</strong></td><td>{a.type === 'bank' ? 'حساب بنكي' : 'صندوق نقدي'}</td><td><code>{a.currency}</code></td><td>{formatCurrency(a.opening_balance)}</td></tr>)}</tbody></table>{!accounts?.length && <Empty text="لم يتم إنشاء حسابات نقدية بعد" />}</TableWrap>}
      </section>
      <section className="panel">
        <div className="panel-head"><div><h2>حركات الصناديق</h2><p>كل حركة بمصدر ومستند</p></div></div>
        {movements?.length ? movements.slice(0, 8).map((m) => <div className="alert-row" key={m.id}><span className={`severity ${m.direction === 'in' ? 'info' : 'critical'}`}>{m.direction === 'in' ? <Plus size={16} /> : <X size={16} />}</span><div><strong>{m.reason ?? 'حركة نقدية'}</strong><p>{formatDateShort(m.created_at)}</p></div><b style={{ color: m.direction === 'in' ? '#098c73' : '#c93b4b' }}>{m.direction === 'in' ? '+' : '−'}{formatCurrency(m.amount)}</b></div>) : <Empty text="لا توجد حركات نقدية بعد" />}
      </section>
    </div>

    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-head"><div><h2>أعلى ذمم العملاء المدينة</h2><p>المبالغ المستحقة على العملاء</p></div></div>
        {receivableCustomers.length ? <TableWrap><table><thead><tr><th>العميل</th><th>المستحق</th></tr></thead><tbody>{receivableCustomers.map((c: Customer) => <tr key={c.id}><td><strong>{c.business_name}</strong><small>{c.customer_code}</small></td><td className="amount-danger">{formatCurrency(c.current_balance)}</td></tr>)}</tbody></table></TableWrap> : <Empty text="لا توجد مستحقات على العملاء" />}
      </section>
      <section className="panel">
        <div className="panel-head"><div><h2>أعلى مستحقات الموردين</h2><p>ما يجب سداده للموردين</p></div></div>
        {payableSuppliers.length ? <TableWrap><table><thead><tr><th>المورد</th><th>المستحق</th></tr></thead><tbody>{payableSuppliers.map((s: Supplier) => <tr key={s.id}><td><strong>{s.name}</strong><small>{s.supplier_code}</small></td><td className="amount-danger">{formatCurrency(s.current_balance)}</td></tr>)}</tbody></table></TableWrap> : <Empty text="لا توجد مستحقات للموردين" />}
      </section>
    </div>
    {modal && <CashAccountModal onClose={() => setModal(false)} onSaved={() => { setModal(false); refetch(); onNotice('تم إنشاء الحساب'); }} />}
  </>;
}

function CashAccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(''); const [type, setType] = useState('cash'); const [balance, setBalance] = useState('0'); const [error, setError] = useState('');
  async function save() {
    if (!name.trim()) { setError('اسم الحساب مطلوب'); return; }
    try { await createCashAccount({ name, type, currency: 'YER', opening_balance: Number(balance) || 0 }); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذر الحفظ'); }
  }
  return <Modal title="صندوق أو حساب جديد" onClose={onClose}>
    <Field label="اسم الحساب"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="صندع الرئيسي / حساب الراجحي" /></Field>
    <div className="form-grid">
      <Field label="النوع"><select value={type} onChange={(e) => setType(e.target.value)}><option value="cash">صندوق نقدي</option><option value="bank">حساب بنكي</option></select></Field>
      <Field label="الرصيد الافتتاحي"><input type="number" min="0" value={balance} onChange={(e) => setBalance(e.target.value)} /></Field>
    </div>
    {error && <div className="form-error">{error}</div>}
    <div className="modal-actions"><Button variant="outline" onClick={onClose}>إلغاء</Button><Button onClick={save}>حفظ</Button></div>
  </Modal>;
}

function PaymentsView({ onNotice }: { onNotice: (m: string) => void }) {
  const { data: payments, loading, error, refetch } = useFetch(fetchPayments);
  const { data: customers } = useFetch(fetchCustomers);
  const { data: suppliers } = useFetch(fetchSuppliers);
  const { data: accounts } = useFetch(fetchCashAccounts);
  const [modal, setModal] = useState(false);

  return <>
    <div className="toolbar"><span className="toolbar-note">{payments?.length ?? 0} دفعة مسجلة — كل دفعة برقم ومرجع فريد</span><div className="toolbar-actions"><Button variant="secondary" onClick={refetch}><RefreshCw size={16} /> تحديث</Button><Button onClick={() => setModal(true)}><Plus size={17} /> تسجيل دفعة</Button></div></div>
    <section className="panel table-panel">{loading ? <Loading /> : error ? <ErrorBox message={error} /> : payments?.length ? <TableWrap><table><thead><tr><th>الرقم</th><th>النوع</th><th>الجهة</th><th>الطريقة</th><th>المبلغ</th><th>التاريخ</th></tr></thead><tbody>{payments.map((p: Payment) => <tr key={p.id}><td><code>{p.payment_number}</code></td><td><span className={`badge ${p.direction === 'receipt' ? 'success' : 'warning'}`}>{p.direction === 'receipt' ? 'تحصيل من عميل' : 'سداد لمورد'}</span></td><td>{partyName(p, customers ?? [], suppliers ?? [])}</td><td>{methodLabel(p.method)}</td><td>{formatCurrency(p.amount)}</td><td>{formatDateShort(p.created_at)}</td></tr>)}</tbody></table></TableWrap> : <Empty text="لا توجد دفعات مسجلة بعد" />}</section>
    {modal && <PaymentModal accounts={accounts ?? []} customers={customers ?? []} suppliers={suppliers ?? []} onClose={() => setModal(false)} onSaved={() => { setModal(false); refetch(); onNotice('تم تسجيل الدفعة وتحديث الأرصدة'); }} />}
  </>;
}

function partyName(p: Payment, customers: Customer[], suppliers: Supplier[]): string {
  if (p.party_type === 'customer') return customers.find((c) => c.id === p.party_id)?.business_name ?? '—';
  return suppliers.find((s) => s.id === p.party_id)?.name ?? '—';
}
function methodLabel(method: string): string {
  return ({ cash: 'نقدي', bank_transfer: 'تحويل بنكي', cheque: 'شيك' }[method] ?? method);
}

function PaymentModal({ accounts, customers, suppliers, onClose, onSaved }: { accounts: CashAccount[]; customers: Customer[]; suppliers: Supplier[]; onClose: () => void; onSaved: () => void }) {
  const [direction, setDirection] = useState<'receipt' | 'payment'>('receipt');
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const party = direction === 'receipt' ? customers.find((c) => c.id === partyId) : suppliers.find((s) => s.id === partyId);

  async function save() {
    if (!partyId || !amount || Number(amount) <= 0) { setError('اختر الجهة وأدخل مبلغاً صحيحاً'); return; }
    setSaving(true); setError('');
    try {
      await recordPayment({
        direction, party_type: direction === 'receipt' ? 'customer' : 'supplier',
        party_id: partyId, amount: Number(amount), method,
        cash_account_id: accountId || null, notes,
      });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر التسجيل'); } finally { setSaving(false); }
  }

  return <Modal title={direction === 'receipt' ? 'تحصيل من عميل' : 'سداد لمورد'} onClose={onClose}>
    <div className="form-grid">
      <Field label="نوع العملية"><select value={direction} onChange={(e) => { setDirection(e.target.value as 'receipt' | 'payment'); setPartyId(''); }}><option value="receipt">تحصيل من عميل</option><option value="payment">سداد لمورد</option></select></Field>
      <Field label={direction === 'receipt' ? 'العميل' : 'المورد'}><select value={partyId} onChange={(e) => setPartyId(e.target.value)}><option value="">اختر...</option>{(direction === 'receipt' ? customers : suppliers).map((p: Customer | Supplier) => <option key={p.id} value={p.id}>{direction === 'receipt' ? (p as Customer).business_name : (p as Supplier).name} — مستحق {formatCurrency(p.current_balance)}</option>)}</select></Field>
    </div>
    {party && <div className="payment-party-note">الرصيد المستحق حالياً: <strong>{formatCurrency(party.current_balance)}</strong></div>}
    <div className="form-grid">
      <Field label="المبلغ"><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="طريقة الدفع"><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">نقدي</option><option value="bank_transfer">تحويل بنكي</option><option value="cheque">شيك</option></select></Field>
    </div>
    <Field label="الصندوق أو الحساب"><select value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">بدون حركة نقدية</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.type === 'bank' ? 'بنكي' : 'نقدي'})</option>)}</select></Field>
    <Field label="ملاحظات"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مرجع السداد..." /></Field>
    {error && <div className="form-error">{error}</div>}
    <div className="modal-actions"><Button variant="outline" onClick={onClose}>إلغاء</Button><Button onClick={save} disabled={saving}>{saving ? 'جار التسجيل...' : 'تسجيل الدفعة'}</Button></div>
  </Modal>;
}

function ProcurementView({ onNotice }: { onNotice: (m: string) => void }) {
  const { data: pos, loading, error, refetch } = useFetch(fetchPurchaseOrders);
  const { data: suppliers } = useFetch(fetchSuppliers);
  const [modal, setModal] = useState(false);

  async function receive(poId: string) {
    try { await receivePurchaseOrder(poId); refetch(); onNotice('تم استلام أمر الشراء وترحيل الكميات للمخزون'); }
    catch (e) { onNotice(e instanceof Error ? e.message : 'تعذر الاستلام'); }
  }

  return <>
    <div className="toolbar"><span className="toolbar-note">{pos?.filter((p) => p.status === 'submitted').length ?? 0} أمر مفتوح</span><div className="toolbar-actions"><Button variant="secondary" onClick={refetch}><RefreshCw size={16} /> تحديث</Button><Button onClick={() => setModal(true)}><Plus size={17} /> أمر شراء جديد</Button></div></div>
    <section className="panel table-panel">{loading ? <Loading /> : error ? <ErrorBox message={error} /> : pos?.length ? <TableWrap><table><thead><tr><th>الرقم</th><th>المورد</th><th>الإجمالي</th><th>التاريخ المتوقع</th><th>الحالة</th><th /></tr></thead><tbody>{pos.map((p) => <tr key={p.id}><td><code>{p.po_number}</code></td><td>{suppliers?.find((s) => s.id === p.supplier_id)?.name ?? '—'}</td><td>{formatCurrency(p.total_amount)}</td><td>{p.expected_date ? formatDateShort(p.expected_date) : '—'}</td><td><span className={`badge ${p.status === 'received' ? 'success' : p.status === 'cancelled' ? 'danger' : 'warning'}`}>{({ draft: 'مسودة', submitted: 'مرسل', received: 'مستلم', cancelled: 'ملغي' }[p.status] ?? p.status)}</span></td><td>{p.status === 'submitted' && <Button variant="outline" onClick={() => receive(p.id)}><Check size={15} /> استلام</Button>}</td></tr>)}</tbody></table></TableWrap> : <Empty text="لا توجد أوامر شراء بعد" />}</section>
    {modal && <PurchaseOrderModal suppliers={suppliers ?? []} onClose={() => setModal(false)} onSaved={() => { setModal(false); refetch(); onNotice('تم إنشاء أمر الشراء'); }} />}
  </>;
}

function PurchaseOrderModal({ suppliers, onClose, onSaved }: { suppliers: Supplier[]; onClose: () => void; onSaved: () => void }) {
  const { data: products } = useFetch(fetchProducts);
  const [supplierId, setSupplierId] = useState('');
  const [expected, setExpected] = useState('');
  const [lines, setLines] = useState<{ product: ProductWithInventory; quantity: string; cost: string }[]>([]);
  const [pick, setPick] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addLine() {
    const product = products?.find((p) => p.id === pick);
    if (!product || lines.some((l) => l.product.id === product.id)) return;
    setLines((prev) => [...prev, { product, quantity: '1', cost: String(product.cost_price ?? product.base_price) }]);
    setPick('');
  }
  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.cost) || 0), 0);

  async function save() {
    if (!lines.length) { setError('أضف صنفاً واحداً على الأقل'); return; }
    setSaving(true); setError('');
    try {
      await createPurchaseOrder({
        supplier_id: supplierId || null, expected_date: expected || null,
        items: lines.map((l) => ({ product_id: l.product.id, item_code: l.product.item_code, product_name: l.product.name, unit: l.product.unit, quantity: Number(l.quantity) || 0, unit_cost: Number(l.cost) || 0 })),
      });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر الحفظ'); } finally { setSaving(false); }
  }

  return <Modal title="أمر شراء جديد" onClose={onClose}>
    <div className="form-grid">
      <Field label="المورد"><select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">بدون مورد محدد</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      <Field label="التاريخ المتوقع للاستلام"><input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
    </div>
    <Field label="إضافة صنف"><div className="inline-form" style={{ borderTop: 0, padding: 0 }}><select value={pick} onChange={(e) => setPick(e.target.value)}><option value="">اختر منتجاً...</option>{products?.map((p) => <option key={p.id} value={p.id}>{p.name} — متاح {formatNumber(p.inventory?.quantity_available ?? 0)}</option>)}</select><Button onClick={addLine} disabled={!pick}><Plus size={15} /> إضافة</Button></div></Field>
    {lines.length > 0 && <div className="po-lines">{lines.map((l, i) => <div className="po-line" key={l.product.id}><span>{l.product.name}</span><input type="number" min="1" value={l.quantity} onChange={(e) => setLines((prev) => prev.map((x, xi) => xi === i ? { ...x, quantity: e.target.value } : x))} /><input type="number" min="0" value={l.cost} onChange={(e) => setLines((prev) => prev.map((x, xi) => xi === i ? { ...x, cost: e.target.value } : x))} /><button onClick={() => setLines((prev) => prev.filter((_, xi) => xi !== i))}><X size={14} /></button></div>)}</div>}
    {lines.length > 0 && <div className="payment-party-note">الإجمالي: <strong>{formatCurrency(total)}</strong></div>}
    {error && <div className="form-error">{error}</div>}
    <div className="modal-actions"><Button variant="outline" onClick={onClose}>إلغاء</Button><Button onClick={save} disabled={saving}>{saving ? 'جار الحفظ...' : 'إنشاء الأمر'}</Button></div>
  </Modal>;
}

function ReplenishmentView({ onNotice }: { onNotice: (m: string) => void }) {
  const { data: suggestions, loading, error } = useFetch(fetchReplenishmentSuggestions);
  const [creating, setCreating] = useState<string | null>(null);

  async function act(productId: string) {
    const suggestion = suggestions?.find((s) => s.product.id === productId);
    if (!suggestion || suggestion.suggestedQty <= 0) return;
    setCreating(productId);
    try {
      await createPurchaseOrder({
        supplier_id: null, notes: 'مقترح آلي من محرك إعادة التوريد',
        items: [{ product_id: suggestion.product.id, item_code: suggestion.product.item_code, product_name: suggestion.product.name, unit: suggestion.product.unit, quantity: suggestion.suggestedQty, unit_cost: suggestion.product.cost_price ?? suggestion.product.base_price }],
      });
      onNotice(`تم إنشاء أمر شراء آلي لـ ${suggestion.product.name}`);
    } catch (e) { onNotice(e instanceof Error ? e.message : 'تعذر إنشاء الأمر'); } finally { setCreating(null); }
  }

  return <>
    <div className="toolbar"><span className="toolbar-note">{suggestions?.length ?? 0} صنف تحت حد إعادة الطلب — الترتيب حسب شدة النقص</span></div>
    {loading ? <Loading /> : error ? <ErrorBox message={error} /> : suggestions?.length ? <div className="rule-grid">
      {suggestions.map((s) => <article className="rule-card" key={s.product.id}>
        <div><div><span className="rule-number"><Package size={14} /></span><h2>{s.product.name}</h2></div><span className={`badge ${s.currentStock <= 0 ? 'danger' : 'warning'}`}>{s.currentStock <= 0 ? 'نفد' : 'منخفض'}</span></div>
        <p>{s.reason}</p>
        <div className="replen-facts">
          <div><strong>المتاح</strong><span>{formatNumber(s.currentStock)} {s.product.unit}</span></div>
          <div><strong>حد الطلب</strong><span>{formatNumber(s.reorderPoint)}</span></div>
          <div><strong>قادم</strong><span>{formatNumber(s.incomingQty)}</span></div>
          {s.daysOfCover !== null && <div><strong>التغطية</strong><span>{formatNumber(s.daysOfCover)} يوم</span></div>}
        </div>
        {s.suggestedQty > 0
          ? <div style={{ marginTop: 14 }}><Button disabled={creating === s.product.id} onClick={() => act(s.product.id)}>{creating === s.product.id ? 'جار الإنشاء...' : <><ShoppingCart size={15} /> إنشاء أمر شراء ({formatNumber(s.suggestedQty)} {s.product.unit})</>}</Button></div>
          : <div className="replen-ok"><Check size={15} /> الكمية القادمة تكفي لتغطية الحد</div>}
      </article>)}
    </div> : <div className="sf-empty" style={{ padding: '40px 0' }}><Check size={30} /><span>المخزون ضمن الحدود الآمنة</span><small>لا توجد أصناف تحتاج إعادة توريد الآن</small></div>}
  </>;
}

export function BackChevron() { return <ChevronLeft size={15} />; }
export const FinanceIcons = { AlertTriangle, Banknote };
