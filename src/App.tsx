import { useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Bell, Bot, Box, Check, ChevronLeft,
  CircleDollarSign, Database, FileText, LayoutDashboard, LogOut, Menu, Package,
  Pencil, Plus, RefreshCw, Search, Settings, ShoppingCart, SlidersHorizontal,
  Smartphone, Store, Tag, Trash2, TrendingUp, Users, Zap,
} from 'lucide-react';
import {
  createCategory, createCustomer, createProduct, deleteProduct, fetchAiAlerts,
  fetchCategories, fetchCustomers, fetchDashboardStats, fetchOrders, fetchPricingRules,
  fetchProducts, fetchPromotions, togglePricingRule, togglePromotion,
  updateCustomerStatus, updateProduct,
} from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { formatCurrency, formatDateShort, formatNumber } from '@/lib/format';
import type { Category, PricingRule, ProductWithInventory, Promotion } from '@/lib/types';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Login } from '@/components/Login';
import { Storefront } from '@/components/Storefront';
import {
  AiCenter, Devices, Field, Loading, ErrorBox, Empty, Button,
  TableWrap, Modal, Notifications, OrderDetail, SettingsPage, Suppliers,
} from '@/components/AdminPages';
import { OperationsCenter } from '@/components/OperationsCenter';

type View = 'dashboard' | 'products' | 'customers' | 'orders' | 'pricing' | 'offers' | 'reports' | 'data' | 'operations' | 'notifications' | 'ai' | 'suppliers' | 'devices' | 'settings';
type IconType = typeof LayoutDashboard;

const nav: { id: View; label: string; icon: IconType }[] = [
  { id: 'dashboard', label: 'لوحة المعلومات', icon: LayoutDashboard },
  { id: 'products', label: 'إدارة المنتجات', icon: Box },
  { id: 'customers', label: 'العملاء', icon: Users },
  { id: 'orders', label: 'الطلبات', icon: ShoppingCart },
  { id: 'pricing', label: 'التسعير والمخزون', icon: SlidersHorizontal },
  { id: 'offers', label: 'العروض', icon: Tag },
  { id: 'suppliers', label: 'الموردون', icon: Package },
  { id: 'devices', label: 'أجهزة العملاء', icon: Smartphone },
  { id: 'reports', label: 'التقارير الذكية', icon: BarChart3 },
  { id: 'ai', label: 'مركز الذكاء', icon: Bot },
  { id: 'notifications', label: 'التنبيهات', icon: Bell },
  { id: 'data', label: 'مركز البيانات', icon: Database },
  { id: 'operations', label: 'العمليات الذكية', icon: Zap },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
];

function AppContent() {
  const { user, signOut } = useAuth();
  const [mode, setMode] = useState<'admin' | 'storefront'>('admin');
  const [view, setView] = useState<View>('dashboard');
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [orderDetailId, setOrderDetailId] = useState<string | null>(null);
  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(null), 2800); };

  if (!user) return <Login />;

  if (mode === 'storefront') return <Storefront onExit={() => setMode('admin')} />;

  return (
    <div className="app-shell" dir="rtl">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand" onClick={() => setMode('storefront')} style={{ cursor: 'pointer' }}><div className="brand-icon"><Activity size={22} /></div><div><strong>الأغبري</strong><span>منصة التوزيع الذكية</span></div></div>
        <div className="user-card"><div className="avatar">{user.name.charAt(0)}</div><div><strong>{user.name}</strong><span>مدير النظام</span></div><span className="online-dot" /></div>
        <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setOrderDetailId(null); setMobileNav(false); }}><Icon size={18} /><span>{label}</span></button>)}</nav>
        <div className="sidebar-bottom"><button onClick={() => setMode('storefront')}><Store size={18} /> عرض المتجر</button><button onClick={signOut}><LogOut size={18} /> خروج</button><div className="secure"><span /> النظام متصل وآمن</div></div>
      </aside>
      <main className="main">
        <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></button><div className="topbar-title"><span className="live" /> مركز تشغيل الأغبري <small>الطلبات والمخزون والأسعار والعملاء</small></div><div className="top-actions"><button className="search-button"><Search size={16} /> بحث سريع <kbd>Ctrl K</kbd></button><button className="notification" onClick={() => setView('notifications')}><Bell size={18} /><b>4</b></button></div></header>
        <div className="page-wrap">
          {view === 'dashboard' && <Dashboard onNavigate={setView} />}
          {view === 'products' && <Products onNotice={showNotice} />}
          {view === 'customers' && <Customers onNotice={showNotice} />}
          {view === 'orders' && !orderDetailId && <Orders onViewDetail={setOrderDetailId} />}
          {view === 'orders' && orderDetailId && <OrderDetail orderId={orderDetailId} onBack={() => setOrderDetailId(null)} onNotice={showNotice} />}
          {view === 'pricing' && <Pricing onNotice={showNotice} />}
          {view === 'offers' && <Offers onNotice={showNotice} />}
          {view === 'suppliers' && <Suppliers onNotice={showNotice} />}
          {view === 'devices' && <Devices onNotice={showNotice} />}
          {view === 'reports' && <Reports />}
          {view === 'ai' && <AiCenter onNotice={showNotice} />}
          {view === 'notifications' && <Notifications onNotice={showNotice} />}
          {view === 'data' && <DataCenter onNotice={showNotice} />}
          {view === 'operations' && <OperationsCenter onNotice={showNotice} />}
          {view === 'settings' && <SettingsPage onNotice={showNotice} />}
        </div>
      </main>
      {notice && <div className="toast"><Check size={17} /> {notice}</div>}
    </div>
  );
}

function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}

function Dashboard({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { data: stats, loading, error, refetch } = useFetch(fetchDashboardStats);
  const { data: alerts } = useFetch(fetchAiAlerts);
  const { data: products } = useFetch(fetchProducts);
  if (loading) return <><Heading eyebrow="مركز التشغيل" title="لوحة المعلومات" description="صورة مباشرة لأداء الأعمال اليومي" icon={LayoutDashboard} /><Loading /></>;
  if (error) return <ErrorBox message={error} />;
  const lowStock = products?.filter((p) => (p.inventory?.quantity_available ?? 0) <= (p.inventory?.reorder_point ?? p.min_stock)).slice(0, 4) ?? [];
  const cards = [
    ['المبيعات المسجلة', formatCurrency(stats?.totalSales ?? 0), 'إجمالي الطلبات', CircleDollarSign, 'teal'],
    ['الطلبات', formatNumber(stats?.orderCount ?? 0), 'كل الطلبات المسجلة', ShoppingCart, 'blue'],
    ['العملاء', formatNumber(stats?.customerCount ?? 0), 'حسابات العملاء', Users, 'cyan'],
    ['المنتجات النشطة', formatNumber(stats?.productCount ?? 0), 'في الكتالوج', Box, 'green'],
    ['قيد المعالجة', formatNumber(stats?.processingCount ?? 0), 'تحتاج متابعة', Activity, 'orange'],
    ['مخزون منخفض', formatNumber(stats?.lowStockCount ?? 0), 'يحتاج إعادة طلب', AlertTriangle, 'red'],
  ] as const;
  return <>
    <div className="hero"><div><span className="hero-kicker">نظرة تنفيذية مباشرة</span><h1>قرارات أفضل، بتشغيل أذكى</h1><p>تتابع الأغبري الطلبات والمخزون والعملاء في مكان واحد، مع مؤشرات واضحة تساعدك على التحرك بسرعة.</p></div><Button onClick={refetch} variant="secondary"><RefreshCw size={16} /> تحديث البيانات</Button></div>
    <div className="stats-grid">{cards.map(([label, value, note, Icon, color]) => <article className={`stat-card ${color}`} key={label}><div className="stat-top"><Icon size={22} /><span>{note}</span></div><small>{label}</small><strong>{value}</strong></article>)}</div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><h2>تنبيهات التشغيل</h2><p>أهم ما يحتاج انتباهك الآن</p></div><Button variant="outline" onClick={() => onNavigate('ai')}>مركز الذكاء <ChevronLeft size={15} /></Button></div>{alerts?.filter((a) => !a.is_resolved).slice(0, 4).map((alert) => <div className="alert-row" key={alert.id}><span className={`severity ${alert.severity}`}><AlertTriangle size={16} /></span><div><strong>{alert.title}</strong><p>{alert.body}</p></div><ChevronLeft size={16} /></div>) ?? <Empty text="لا توجد تنبيهات نشطة" />}</section><section className="panel"><div className="panel-head"><div><h2>الأصناف التي تحتاج متابعة</h2><p>حسب حد إعادة الطلب</p></div><Button variant="outline" onClick={() => onNavigate('products')}>إدارة المنتجات</Button></div>{lowStock.length ? lowStock.map((product) => <div className="stock-row" key={product.id}><div className="product-avatar"><Package size={17} /></div><div><strong>{product.name}</strong><span>{product.item_code}</span></div><b className={(product.inventory?.quantity_available ?? 0) === 0 ? 'critical' : ''}>{formatNumber(product.inventory?.quantity_available ?? 0)} {product.unit}</b></div>) : <Empty text="المخزون ضمن الحدود الآمنة" />}</section></div>
    <section className="quick-panel"><div><Sparkline /><strong>تشغيل مترابط من لوحة واحدة</strong><p>افتح أي وحدة لإدارة التفاصيل وتحديث البيانات مباشرة.</p></div><div className="quick-links">{nav.slice(1, 7).map(({ id, label, icon: Icon }) => <button key={id} onClick={() => onNavigate(id)}><Icon size={17} />{label}</button>)}</div></section>
  </>;
}
function Sparkline() { return <svg className="sparkline" viewBox="0 0 160 52" aria-hidden="true"><path d="M2 42 C25 43 25 28 43 31 S65 42 79 27 S104 25 114 17 S139 24 158 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>; }

function Heading({ eyebrow, title, description, icon: Icon }: { eyebrow: string; title: string; description: string; icon: IconType }) {
  return <div className="heading"><div className="heading-icon"><Icon size={25} /></div><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div>;
}

function Products({ onNotice }: { onNotice: (m: string) => void }) {
  const { data, loading, error, refetch } = useFetch(fetchProducts);
  const [query, setQuery] = useState(''); const [modal, setModal] = useState(false); const [editing, setEditing] = useState<ProductWithInventory | null>(null);
  const rows = (data ?? []).filter((p) => `${p.name} ${p.item_code} ${p.barcode ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  async function remove(product: ProductWithInventory) { if (!window.confirm(`حذف ${product.name}؟`)) return; try { await deleteProduct(product.id); onNotice('تم حذف المنتج'); refetch(); } catch (e) { onNotice(e instanceof Error ? e.message : 'تعذر حذف المنتج'); } }
  return <><Heading eyebrow="الأصناف والمخزون" title="إدارة المنتجات" description="تحكم كامل في الكتالوج والأسعار وحدود المخزون" icon={Box} /><div className="toolbar"><span className="toolbar-note">{data?.length ?? 0} منتج في الكتالوج</span><div className="toolbar-actions"><Button variant="secondary" onClick={refetch}><RefreshCw size={16} /> تحديث</Button><Button onClick={() => { setEditing(null); setModal(true); }}><Plus size={17} /> إضافة منتج</Button></div></div><section className="panel table-panel"><div className="table-head"><h2>كتالوج المنتجات</h2><label className="search-field"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم أو الرمز..." /></label></div>{loading ? <Loading /> : error ? <ErrorBox message={error} /> : <TableWrap><table><thead><tr><th>المنتج</th><th>الرمز</th><th>التصنيف</th><th>السعر</th><th>المتاح</th><th>الحالة</th><th /></tr></thead><tbody>{rows.map((p) => { const qty = p.inventory?.quantity_available ?? 0; const low = qty <= (p.inventory?.reorder_point ?? p.min_stock); return <tr key={p.id}><td><strong>{p.name}</strong><small>{p.description ?? 'بدون وصف'}</small></td><td><code>{p.item_code}</code></td><td>{p.category?.name ?? 'غير مصنف'}</td><td>{formatCurrency(p.base_price)}</td><td>{formatNumber(qty)} {p.unit}</td><td><span className={`badge ${low ? 'warning' : 'success'}`}>{low ? 'منخفض' : 'متوفر'}</span></td><td><div className="row-actions"><button onClick={() => { setEditing(p); setModal(true); }}><Pencil size={15} /></button><button onClick={() => remove(p)}><Trash2 size={15} /></button></div></td></tr>; })}</tbody></table>{!rows.length && <Empty text="لا توجد منتجات مطابقة" />}</TableWrap>}</section>{modal && <ProductModal product={editing} onClose={() => setModal(false)} onSaved={() => { setModal(false); refetch(); onNotice(editing ? 'تم تحديث المنتج' : 'تمت إضافة المنتج'); }} />}</>;
}
function ProductModal({ product, onClose, onSaved }: { product: ProductWithInventory | null; onClose: () => void; onSaved: () => void }) {
  const { data: categories } = useFetch(fetchCategories); const [name, setName] = useState(product?.name ?? ''); const [code, setCode] = useState(product?.item_code ?? ''); const [price, setPrice] = useState(String(product?.base_price ?? '')); const [category, setCategory] = useState(product?.category_id ?? ''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function save() { if (!name.trim() || !code.trim() || !price) { setError('أكمل الحقول المطلوبة'); return; } setSaving(true); setError(''); try { const payload = { name, item_code: code, base_price: Number(price), category_id: category || null, unit: product?.unit ?? 'كرتون', status: product?.status ?? 'active' }; if (product) await updateProduct(product.id, payload); else await createProduct(payload); onSaved(); } catch (e) { setError(e instanceof Error ? e.message : 'تعذر الحفظ'); } finally { setSaving(false); } }
  return <Modal title={product ? 'تعديل المنتج' : 'إضافة منتج'} onClose={onClose}><Field label="اسم المنتج"><input value={name} onChange={(e) => setName(e.target.value)} /></Field><div className="form-grid"><Field label="رمز المنتج"><input value={code} onChange={(e) => setCode(e.target.value)} /></Field><Field label="السعر الأساسي"><input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></Field></div><Field label="التصنيف"><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">غير مصنف</option>{categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><Button variant="outline" onClick={onClose}>إلغاء</Button><Button onClick={save} disabled={saving}>{saving ? 'جار الحفظ...' : 'حفظ المنتج'}</Button></div></Modal>;
}

function Customers({ onNotice }: { onNotice: (m: string) => void }) {
  const { data, loading, error, refetch } = useFetch(fetchCustomers); const [query, setQuery] = useState(''); const [modal, setModal] = useState(false);
  const rows = (data ?? []).filter((c) => `${c.business_name} ${c.phone ?? ''} ${c.customer_code}`.includes(query));
  async function status(id: string, next: string) { try { await updateCustomerStatus(id, next); refetch(); onNotice(next === 'approved' ? 'تم اعتماد العميل' : 'تم تحديث حالة العميل'); } catch (e) { onNotice(e instanceof Error ? e.message : 'تعذر تحديث العميل'); } }
  return <><Heading eyebrow="المبيعات والعملاء" title="إدارة العملاء" description="اعتماد الحسابات ومتابعة الأرصدة وشرائح الأسعار" icon={Users} /><div className="toolbar"><span className="toolbar-note">{data?.length ?? 0} عميل مسجل</span><div className="toolbar-actions"><Button variant="secondary" onClick={refetch}><RefreshCw size={16} /> تحديث</Button><Button onClick={() => setModal(true)}><Plus size={17} /> إضافة عميل</Button></div></div><section className="panel table-panel"><div className="table-head"><h2>دليل العملاء</h2><label className="search-field"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن عميل..." /></label></div>{loading ? <Loading /> : error ? <ErrorBox message={error} /> : <TableWrap><table><thead><tr><th>العميل</th><th>جهة الاتصال</th><th>الشريحة</th><th>الرصيد</th><th>الحد الائتماني</th><th>الحالة</th><th /></tr></thead><tbody>{rows.map((c) => <tr key={c.id}><td><strong>{c.business_name}</strong><small>{c.customer_code}</small></td><td>{c.contact_name ?? '—'}<small>{c.phone ?? '—'}</small></td><td><span className="tier">{c.tier === 'vip' ? 'مميز' : c.tier === 'wholesale' ? 'جملة' : 'تجزئة'}</span></td><td className={c.current_balance > 0 ? 'amount-danger' : ''}>{formatCurrency(c.current_balance)}</td><td>{formatCurrency(c.credit_limit)}</td><td><span className={`badge ${c.status === 'approved' ? 'success' : c.status === 'pending' ? 'warning' : 'danger'}`}>{c.status === 'approved' ? 'معتمد' : c.status === 'pending' ? 'قيد المراجعة' : 'موقوف'}</span></td><td>{c.status === 'pending' && <Button onClick={() => status(c.id, 'approved')}>اعتماد</Button>}</td></tr>)}</tbody></table></TableWrap>}</section>{modal && <CustomerModal onClose={() => setModal(false)} onSaved={() => { setModal(false); refetch(); onNotice('تمت إضافة العميل'); }} />}</>;
}
function CustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) { const [business, setBusiness] = useState(''); const [contact, setContact] = useState(''); const [phone, setPhone] = useState(''); const [tier, setTier] = useState('retail'); const [error, setError] = useState(''); async function save() { if (!business.trim()) { setError('اسم المنشأة مطلوب'); return; } try { await createCustomer({ business_name: business, contact_name: contact, phone, tier, customer_code: `CUST-${Date.now().toString().slice(-6)}`, status: 'pending' }); onSaved(); } catch (e) { setError(e instanceof Error ? e.message : 'تعذر الحفظ'); } } return <Modal title="إضافة عميل" onClose={onClose}><Field label="اسم المنشأة"><input value={business} onChange={(e) => setBusiness(e.target.value)} /></Field><div className="form-grid"><Field label="اسم المسؤول"><input value={contact} onChange={(e) => setContact(e.target.value)} /></Field><Field label="رقم الهاتف"><input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field></div><Field label="شريحة الأسعار"><select value={tier} onChange={(e) => setTier(e.target.value)}><option value="retail">تجزئة</option><option value="wholesale">جملة</option><option value="vip">مميز</option></select></Field>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><Button variant="outline" onClick={onClose}>إلغاء</Button><Button onClick={save}>حفظ العميل</Button></div></Modal>; }

function Orders({ onViewDetail }: { onViewDetail: (id: string) => void }) {
  const { data, loading, error, refetch } = useFetch(fetchOrders);
  return <><Heading eyebrow="المبيعات والعملاء" title="الطلبات" description="متابعة دورة الطلب من الاستلام حتى التسليم" icon={ShoppingCart} /><div className="toolbar"><span className="toolbar-note">{data?.length ?? 0} طلب في النظام</span><div className="toolbar-actions"><Button variant="secondary" onClick={refetch}><RefreshCw size={16} /> تحديث</Button></div></div><section className="panel table-panel">{loading ? <Loading /> : error ? <ErrorBox message={error} /> : <TableWrap><table><thead><tr><th>رقم الطلب</th><th>العميل</th><th>التاريخ</th><th>الأصناف</th><th>الإجمالي</th><th>الحالة</th><th /></tr></thead><tbody>{data?.map((o) => <tr key={o.id}><td><strong>#{o.order_number}</strong></td><td>{o.customer?.business_name ?? '—'}</td><td>{formatDateShort(o.created_at)}</td><td>{formatNumber(o.total_items)}</td><td>{formatCurrency(o.total_amount)}</td><td><span className={`badge ${o.status === 'delivered' ? 'success' : o.status === 'processing' ? 'info' : 'warning'}`}>{orderLabel(o.status)}</span></td><td><Button variant="outline" onClick={() => onViewDetail(o.id)}>تفاصيل</Button></td></tr>)}</tbody></table>{!data?.length && <Empty text="لا توجد طلبات" />}</TableWrap>}</section></>;
}
function orderLabel(status: string) { return ({ draft: 'مسودة', pending: 'جديد', confirmed: 'مؤكد', processing: 'قيد التجهيز', delivered: 'تم التسليم' }[status] ?? status); }

function Pricing({ onNotice }: { onNotice: (m: string) => void }) { const { data, loading, error, refetch } = useFetch(fetchPricingRules); async function toggle(rule: PricingRule) { try { await togglePricingRule(rule.id, !rule.is_active); refetch(); onNotice(rule.is_active ? 'تم إيقاف القاعدة' : 'تم تفعيل القاعدة'); } catch (e) { onNotice(e instanceof Error ? e.message : 'تعذر تحديث القاعدة'); } } return <><Heading eyebrow="الأصناف والمخزون" title="التسعير والمخزون" description="قواعد موحدة لتسعير المنتجات ومتابعة التغطية" icon={SlidersHorizontal} /><div className="toolbar"><span className="toolbar-note">محرك التسعير يعمل وفق الأولوية</span><div className="toolbar-actions"><Button variant="secondary" onClick={refetch}><RefreshCw size={16} /> تحديث</Button><Button><Plus size={17} /> قاعدة جديدة</Button></div></div><div className="rule-grid">{loading ? <Loading /> : error ? <ErrorBox message={error} /> : data?.map((r) => <article className="rule-card" key={r.id}><div><span className="rule-number">{r.priority}</span><h2>{r.name}</h2></div><label className="switch"><input type="checkbox" checked={r.is_active} onChange={() => toggle(r)} /><span /></label><p>{r.adjustment_type === 'percentage' ? `تعديل بنسبة ${r.adjustment_value}%` : `تعديل بقيمة ${r.adjustment_value}`}</p></article>)}</div></>; }

function Offers({ onNotice }: { onNotice: (m: string) => void }) { const { data, loading, error, refetch } = useFetch(fetchPromotions); async function toggle(p: Promotion) { try { await togglePromotion(p.id, !p.is_active); refetch(); onNotice(p.is_active ? 'تم إيقاف العرض' : 'تم تفعيل العرض'); } catch (e) { onNotice(e instanceof Error ? e.message : 'تعذر تحديث العرض'); } } return <><Heading eyebrow="الأصناف والمخزون" title="العروض وشريط اليوم" description="إدارة العروض التي تظهر للعملاء وتحريك المبيعات" icon={Tag} /><div className="toolbar"><span className="toolbar-note">{data?.filter((p) => p.is_active).length ?? 0} عروض نشطة</span><div className="toolbar-actions"><Button variant="secondary" onClick={refetch}><RefreshCw size={16} /> تحديث</Button><Button><Plus size={17} /> عرض جديد</Button></div></div><div className="offer-grid">{loading ? <Loading /> : error ? <ErrorBox message={error} /> : data?.map((p) => <article className="offer-card" key={p.id}><div className="offer-top"><span className="discount">{p.discount_value}%</span><label className="switch"><input type="checkbox" checked={p.is_active} onChange={() => toggle(p)} /><span /></label></div><h2>{p.title}</h2><p>{p.description ?? 'عرض ترويجي لعملاء الأغبري'}</p><div className="offer-date"><span>من {p.start_date}</span><span>إلى {p.end_date}</span></div></article>)}</div></>; }

function Reports() { const { data: stats, loading, error } = useFetch(fetchDashboardStats); const { data: products } = useFetch(fetchProducts); return <><Heading eyebrow="التحليل التنفيذي" title="التقارير الذكية" description="مؤشرات قابلة للتنفيذ مبنية على البيانات التشغيلية الحالية" icon={BarChart3} /><div className="report-hero"><div><span>ملخص الأداء</span><h2>الأغبري في أرقام</h2><p>تتحدث المؤشرات من قاعدة البيانات مباشرة.</p></div><TrendingUp size={50} /></div>{loading ? <Loading /> : error ? <ErrorBox message={error} /> : <div className="report-grid"><ReportMetric label="إجمالي المبيعات" value={formatCurrency(stats?.totalSales ?? 0)} icon={CircleDollarSign} /><ReportMetric label="متوسط قيمة الطلب" value={formatCurrency((stats?.totalSales ?? 0) / Math.max(stats?.orderCount ?? 1, 1))} icon={ShoppingCart} /><ReportMetric label="قيمة المخزون المعروضة" value={formatCurrency((products ?? []).reduce((sum, p) => sum + p.base_price * (p.inventory?.quantity_available ?? 0), 0))} icon={Package} /><ReportMetric label="الأصناف منخفضة المخزون" value={formatNumber(stats?.lowStockCount ?? 0)} icon={AlertTriangle} /></div>}<section className="panel report-note"><FileText size={21} /><div><h2>قرار اليوم</h2><p>{(stats?.lowStockCount ?? 0) > 0 ? 'ابدأ بمراجعة الأصناف منخفضة المخزون قبل استقبال الطلبات الجديدة.' : 'المخزون ضمن الحدود الآمنة. ركّز على نمو المبيعات والعملاء الجدد.'}</p></div></section></>; }
function ReportMetric({ label, value, icon: Icon }: { label: string; value: string; icon: IconType }) { return <article className="report-metric"><Icon size={23} /><span>{label}</span><strong>{value}</strong></article>; }

function DataCenter({ onNotice }: { onNotice: (m: string) => void }) { const { data: categories, loading, refetch } = useFetch(fetchCategories); const [name, setName] = useState(''); async function add() { if (!name.trim()) return; try { await createCategory({ name, is_active: true, sort_order: (categories?.length ?? 0) + 1 }); setName(''); refetch(); onNotice('تمت إضافة التصنيف'); } catch (e) { onNotice(e instanceof Error ? e.message : 'تعذر إضافة التصنيف'); } } return <><Heading eyebrow="إدارة البيانات" title="مركز البيانات الموحد" description="تنظيم التصنيفات ومراجعة البيانات الأساسية من مكان واحد" icon={Database} /><div className="data-layout"><section className="panel"><div className="panel-head"><div><h2>التصنيفات</h2><p>تستخدم لتنظيم المنتجات والتقارير</p></div></div><div className="inline-form"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم التصنيف الجديد" /><Button onClick={add}><Plus size={16} /> إضافة</Button></div>{loading ? <Loading /> : <div className="category-list">{categories?.map((c: Category) => <div key={c.id}><span>{c.name}</span><small>{c.code ?? 'بدون رمز'}</small></div>)}</div>}</section><section className="panel data-info"><Database size={28} /><h2>بيانات موحدة وآمنة</h2><p>تعمل المنتجات والعملاء والطلبات والمخزون من مصدر بيانات واحد، لتقليل التعارض ورفع دقة القرارات.</p><div className="data-status"><Check size={16} /> الاتصال بقاعدة البيانات نشط</div></section></div></>; }

export default App;
