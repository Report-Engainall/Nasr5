import { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle, Bell, Bot, Check, ChevronLeft, Database,
  Package, Plus, RefreshCw, Search, Settings, Smartphone,
  X, ExternalLink,
} from 'lucide-react';
import {
  fetchAiAlerts, fetchAiTasks, fetchNotifications, fetchOrders, fetchOrderItems,
  fetchSettings, fetchSuppliers,
  markAllNotificationsRead, markNotificationRead, resolveAiAlert, toggleAiTaskStatus,
  updateOrderStatus, updateSetting, createSupplier,
} from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { formatCurrency, formatDateShort, formatNumber, timeAgo } from '@/lib/format';
import type { AiAlert, AiTask, Notification, Supplier, AdminSetting, OrderItem } from '@/lib/types';

import type { LucideIcon } from 'lucide-react';
import { supabase, ORG_ID } from '@/lib/supabase';
type IconType = LucideIcon;

export function Notifications({ onNotice }: { onNotice: (m: string) => void }) {
  const { data, loading, error, refetch } = useFetch(fetchNotifications);
  const unread = data?.filter((n) => !n.is_read).length ?? 0;
  async function readAll() { try { await markAllNotificationsRead(); refetch(); onNotice('تم تعليم الكل كمقروء'); } catch (e) { onNotice(e instanceof Error ? e.message : 'خطأ'); } }
  async function readOne(id: string) { try { await markNotificationRead(id); refetch(); } catch { /* ignore */ } }
  return <AdminPage eyebrow="النظام" title="التنبيهات" description="كل رسائل النظام والتنبيهات في مكان واحد" icon={Bell} note={`${data?.length ?? 0} تنبيه — ${unread} غير مقروء`} toolbar={<><Button variant="secondary" onClick={refetch}><RefreshCw size={16} /> تحديث</Button>{unread > 0 && <Button onClick={readAll}>تعليم الكل كمقروء</Button>}</>}>
    {loading ? <Loading /> : error ? <ErrorBox message={error} /> : <div className="notif-list">{data?.map((n: Notification) => <div className={`notif-row ${n.is_read ? 'read' : ''}`} key={n.id} onClick={() => !n.is_read && readOne(n.id)}><span className={`notif-type ${n.type}`}><Bell size={16} /></span><div><strong>{n.title}</strong><p>{n.body ?? '—'}</p><small>{timeAgo(n.created_at)}</small></div>{!n.is_read && <span className="notif-dot" />}</div>)}</div>}
  </AdminPage>;
}

export function AiCenter({ onNotice }: { onNotice: (m: string) => void }) {
  const { data: alerts, loading: aLoading, refetch: rAlerts } = useFetch(fetchAiAlerts);
  const { data: tasks, loading: tLoading, refetch: rTasks } = useFetch(fetchAiTasks);
  const [tab, setTab] = useState<'alerts' | 'tasks'>('alerts');
  async function resolve(id: string) { try { await resolveAiAlert(id); rAlerts(); onNotice('تم حل التنبيه'); } catch (e) { onNotice(e instanceof Error ? e.message : 'خطأ'); } }
  async function taskAction(id: string, status: string) { try { await toggleAiTaskStatus(id, status); rTasks(); onNotice(status === 'completed' ? 'تم إنجاز المهمة' : 'تم تحديث المهمة'); } catch (e) { onNotice(e instanceof Error ? e.message : 'خطأ'); } }
  return <AdminPage eyebrow="الذكاء الاصطناعي" title="مركز الذكاء" description="تنبيهات ومهام يولدها النظام تلقائياً" icon={Bot} note={`${alerts?.filter((a) => !a.is_resolved).length ?? 0} تنبيه نشط — ${tasks?.filter((t) => t.status !== 'completed').length ?? 0} مهمة معلقة`} toolbar={<Button variant="secondary" onClick={() => { rAlerts(); rTasks(); }}><RefreshCw size={16} /> تحديث</Button>}>
    <div className="ai-tabs"><button className={tab === 'alerts' ? 'active' : ''} onClick={() => setTab('alerts')}><AlertTriangle size={16} /> التنبيهات</button><button className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}><Check size={16} /> المهام</button></div>
    {tab === 'alerts' ? (aLoading ? <Loading /> : <div className="ai-alert-list">{alerts?.filter((a: AiAlert) => !a.is_resolved).map((a: AiAlert) => <div className="ai-alert-row" key={a.id}><span className={`ai-severity ${a.severity}`}><AlertTriangle size={18} /></span><div><strong>{a.title}</strong><p>{a.body ?? '—'}</p><small>{timeAgo(a.created_at)}</small></div><Button variant="outline" onClick={() => resolve(a.id)}>حل</Button></div>)}{!alerts?.filter((a) => !a.is_resolved).length && <Empty text="لا توجد تنبيهات نشطة" />}</div>) : (tLoading ? <Loading /> : <div className="ai-task-list">{tasks?.filter((t: AiTask) => t.status !== 'completed').map((t: AiTask) => <div className="ai-task-row" key={t.id}><span className={`ai-priority ${t.priority}`} /><div><strong>{t.title}</strong><p>{t.description ?? '—'}</p><small>{timeAgo(t.created_at)}</small></div><div className="ai-task-actions"><Button variant="outline" onClick={() => taskAction(t.id, 'in_progress')}>بدء</Button><Button onClick={() => taskAction(t.id, 'completed')}>إنجاز</Button></div></div>)}{!tasks?.filter((t) => t.status !== 'completed').length && <Empty text="لا توجد مهام معلقة" />}</div>)}
  </AdminPage>;
}

export function OrderDetail({ orderId, onBack, onNotice }: { orderId: string; onBack: () => void; onNotice: (m: string) => void }) {
  const { data: orders } = useFetch(fetchOrders);
  const { data: items, loading, refetch } = useFetch(() => fetchOrderItems(orderId), [orderId]);
  const order = orders?.find((o) => o.id === orderId);
  async function changeStatus(status: string) { try { await updateOrderStatus(orderId, status); refetch(); onNotice(`تم تحديث حالة الطلب إلى: ${status}`); } catch (e) { onNotice(e instanceof Error ? e.message : 'خطأ'); } }
  const statuses = ['pending', 'confirmed', 'processing', 'delivered'];
  return <AdminPage eyebrow="المبيعات والعملاء" title={`الطلب #${order?.order_number ?? ''}`} description="تفاصيل الطلب وبنوده وحالة التجهيز" icon={Package} note="" toolbar={<Button variant="secondary" onClick={onBack}><ChevronLeft size={16} /> رجوع</Button>}>
    {order && <div className="order-detail-grid"><div className="order-info-panel"><div className="order-info-row"><span>العميل</span><strong>{order.customer?.business_name ?? '—'}</strong></div><div className="order-info-row"><span>التاريخ</span><strong>{formatDateShort(order.created_at)}</strong></div><div className="order-info-row"><span>الإجمالي</span><strong>{formatCurrency(order.total_amount)}</strong></div><div className="order-info-row"><span>عدد البنود</span><strong>{formatNumber(order.total_items)}</strong></div><div className="order-info-row"><span>الحالة الحالية</span><span className={`badge ${order.status === 'delivered' ? 'success' : 'info'}`}>{order.status}</span></div></div><div className="order-status-panel"><h3>تغيير الحالة</h3><div className="order-status-btns">{statuses.map((s) => <button key={s} className={order.status === s ? 'active' : ''} onClick={() => changeStatus(s)}>{s}</button>)}</div></div></div>}
    <section className="panel table-panel" style={{ marginTop: 16 }}><div className="table-head"><h2>بنود الطلب</h2></div>{loading ? <Loading /> : <TableWrap><table><thead><tr><th>المنتج</th><th>الرمز</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>{items?.map((it: OrderItem) => <tr key={it.id}><td><strong>{it.product_name_snapshot}</strong></td><td><code>{it.item_code}</code></td><td>{formatNumber(it.quantity)} {it.unit_snapshot ?? ''}</td><td>{formatCurrency(it.unit_price_snapshot)}</td><td>{formatCurrency(it.line_total)}</td></tr>)}</tbody></table></TableWrap>}</section>
  </AdminPage>;
}

export function Suppliers({ onNotice }: { onNotice: (m: string) => void }) {
  const { data, loading, error, refetch } = useFetch(fetchSuppliers);
  const [modal, setModal] = useState(false);
  return <AdminPage eyebrow="إدارة البيانات" title="الموردون" description="إدارة دليل الموردين وجهات الاتصال" icon={Package} note={`${data?.length ?? 0} مورد`} toolbar={<><Button variant="secondary" onClick={refetch}><RefreshCw size={16} /> تحديث</Button><Button onClick={() => setModal(true)}><Plus size={17} /> إضافة مورد</Button></>}>
    {loading ? <Loading /> : error ? <ErrorBox message={error} /> : <TableWrap><table><thead><tr><th>المورد</th><th>جهة الاتصال</th><th>الهاتف</th><th>البريد</th><th>الحالة</th></tr></thead><tbody>{data?.map((s: Supplier) => <tr key={s.id}><td><strong>{s.name}</strong><small>{s.supplier_code}</small></td><td>{s.contact_name ?? '—'}</td><td>{s.phone ?? '—'}</td><td>{s.email ?? '—'}</td><td><span className={`badge ${s.status === 'active' ? 'success' : 'warning'}`}>{s.status}</span></td></tr>)}</tbody></table></TableWrap>}
    {modal && <SupplierModal onClose={() => setModal(false)} onSaved={() => { setModal(false); refetch(); onNotice('تمت إضافة المورد'); }} />}
  </AdminPage>;
}
function SupplierModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(''); const [contact, setContact] = useState(''); const [phone, setPhone] = useState(''); const [error, setError] = useState('');
  async function save() { if (!name.trim()) { setError('اسم المورد مطلوب'); return; } try { await createSupplier({ name, contact_name: contact, phone, supplier_code: `SUP-${Date.now().toString().slice(-5)}`, status: 'active' }); onSaved(); } catch (e) { setError(e instanceof Error ? e.message : 'خطأ'); } }
  return <Modal title="إضافة مورد" onClose={onClose}><Field label="اسم المورد"><input value={name} onChange={(e) => setName(e.target.value)} /></Field><div className="form-grid"><Field label="جهة الاتصال"><input value={contact} onChange={(e) => setContact(e.target.value)} /></Field><Field label="الهاتف"><input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field></div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><Button variant="outline" onClick={onClose}>إلغاء</Button><Button onClick={save}>حفظ</Button></div></Modal>;
}

export function Devices({ onNotice }: { onNotice: (m: string) => void }) {
  const { data: customers } = useFetch(async () => { const { data } = await supabase.from('customers').select('*').eq('organization_id', ORG_ID).order('created_at', { ascending: false }); return data ?? []; });
  const [query, setQuery] = useState('');
  const rows = (customers ?? []).filter((c: { business_name: string; customer_code: string; phone: string | null }) => `${c.business_name} ${c.customer_code} ${c.phone ?? ''}`.includes(query));
  return <AdminPage eyebrow="المبيعات والعملاء" title="أجهزة العملاء" description="متابعة أجهزة البيع لدى العملاء" icon={Smartphone} note={`${customers?.length ?? 0} جهاز مسجل`} toolbar={<Button variant="secondary" onClick={() => onNotice('تم تحديث الحالة')}><RefreshCw size={16} /> تحديث</Button>}>
    <div className="table-head"><h2>قائمة الأجهزة</h2><label className="search-field"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث..." /></label></div>
    <TableWrap><table><thead><tr><th>العميل</th><th>الكود</th><th>الهاتف</th><th>الحالة</th><th /></tr></thead><tbody>{rows.map((c: { id: string; business_name: string; customer_code: string; phone: string | null; status: string }) => <tr key={c.id}><td><strong>{c.business_name}</strong></td><td><code>{c.customer_code}</code></td><td>{c.phone ?? '—'}</td><td><span className={`badge ${c.status === 'approved' ? 'success' : 'warning'}`}>{c.status}</span></td><td><button className="row-action"><ExternalLink size={15} /></button></td></tr>)}</tbody></table></TableWrap>
  </AdminPage>;
}

export function SettingsPage({ onNotice }: { onNotice: (m: string) => void }) {
  const { data: settings, loading, refetch } = useFetch(fetchSettings);
  const [tab, setTab] = useState<'general' | 'storefront' | 'appearance'>('general');
  const [saving, setSaving] = useState(false);
  const map = useMemo(() => { const m: Record<string, unknown> = {}; settings?.forEach((s: AdminSetting) => m[s.key] = s.value); return m; }, [settings]);

  async function save(key: string, value: unknown, category: string) { setSaving(true); try { await updateSetting(key, value, category); refetch(); onNotice('تم حفظ الإعداد'); } catch (e) { onNotice(e instanceof Error ? e.message : 'خطأ'); } finally { setSaving(false); } }

  return <AdminPage eyebrow="النظام" title="الإعدادات العامة" description="تحكم كامل في إعدادات المتجر والمظهر" icon={Settings} note="" toolbar={<Button variant="secondary" onClick={refetch}><RefreshCw size={16} /> تحديث</Button>}>
    {loading ? <Loading /> : <>
      <div className="settings-tabs"><button className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>عام</button><button className={tab === 'storefront' ? 'active' : ''} onClick={() => setTab('storefront')}>المتجر</button><button className={tab === 'appearance' ? 'active' : ''} onClick={() => setTab('appearance')}>المظهر</button></div>
      {tab === 'general' && <SettingsPanel title="معلومات المتجر"><SettingInput label="اسم المتجر" value={(map.store_name as string) ?? ''} onSave={(v) => save('store_name', v, 'general')} saving={saving} /><SettingInput label="الوصف المختصر" value={(map.store_tagline as string) ?? ''} onSave={(v) => save('store_tagline', v, 'general')} saving={saving} /><SettingInput label="الهاتف" value={(map.store_phone as string) ?? ''} onSave={(v) => save('store_phone', v, 'general')} saving={saving} /><SettingInput label="البريد" value={(map.store_email as string) ?? ''} onSave={(v) => save('store_email', v, 'general')} saving={saving} /><SettingInput label="العنوان" value={(map.store_address as string) ?? ''} onSave={(v) => save('store_address', v, 'general')} saving={saving} /></SettingsPanel>}
      {tab === 'storefront' && <SettingsPanel title="إعدادات المتجر"><SettingInput label="عنوان البانر" value={(map.hero_title as string) ?? ''} onSave={(v) => save('hero_title', v, 'storefront')} saving={saving} /><SettingInput label="نص البانر الفرعي" value={(map.hero_subtitle as string) ?? ''} onSave={(v) => save('hero_subtitle', v, 'storefront')} saving={saving} /><SettingToggle label="شريط العرض المتحرك" value={(map.ticker_enabled as boolean) ?? true} onSave={(v) => save('ticker_enabled', v, 'storefront')} saving={saving} /><SettingToggle label="إظهار المنتجات النافدة" value={(map.show_out_of_stock as boolean) ?? true} onSave={(v) => save('show_out_of_stock', v, 'storefront')} saving={saving} /></SettingsPanel>}
      {tab === 'appearance' && <SettingsPanel title="ألوان النظام"><SettingColor label="اللون الأساسي" value={(map.theme_primary as string) ?? '#087f8d'} onSave={(v) => save('theme_primary', v, 'appearance')} saving={saving} /><SettingColor label="لون التمييز" value={(map.theme_accent as string) ?? '#0eaa97'} onSave={(v) => save('theme_accent', v, 'appearance')} saving={saving} /></SettingsPanel>}
    </>}
  </AdminPage>;
}

function SettingsPanel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="panel settings-panel"><div className="panel-head"><div><h2>{title}</h2></div></div><div className="settings-body">{children}</div></section>; }
function SettingInput({ label, value, onSave, saving }: { label: string; value: string; onSave: (v: string) => void; saving: boolean }) { const [v, setV] = useState(value); useEffect(() => setV(value), [value]); return <div className="setting-row"><label><span>{label}</span><input value={v} onChange={(e) => setV(e.target.value)} /></label><Button variant="outline" onClick={() => onSave(v)} disabled={saving}>حفظ</Button></div>; }
function SettingToggle({ label, value, onSave, saving }: { label: string; value: boolean; onSave: (v: boolean) => void; saving: boolean }) { return <div className="setting-row"><div className="setting-label"><span>{label}</span><label className="switch"><input type="checkbox" checked={value} onChange={(e) => onSave(e.target.checked)} disabled={saving} /><span /></label></div></div>; }
function SettingColor({ label, value, onSave, saving }: { label: string; value: string; onSave: (v: string) => void; saving: boolean }) { return <div className="setting-row"><label><span>{label}</span><input type="color" value={value} onChange={(e) => onSave(e.target.value)} disabled={saving} /></label></div>; }

// ─── Shared components ───
export function AdminPage({ eyebrow, title, description, icon: Icon, note, toolbar, children }: { eyebrow: string; title: string; description: string; icon: IconType; note: string; toolbar?: React.ReactNode; children: React.ReactNode }) {
  return <><div className="heading"><div className="heading-icon"><Icon size={25} /></div><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div>{(note || toolbar) && <div className="toolbar"><span className="toolbar-note">{note}</span><div className="toolbar-actions">{toolbar}</div></div>}{children}</>;
}
export function Loading() { return <div className="loading"><RefreshCw size={20} className="spin" /> جار تحميل البيانات...</div>; }
export function ErrorBox({ message }: { message: string }) { return <div className="error-box"><AlertTriangle size={19} /> تعذر تحميل البيانات. {message}</div>; }
export function Empty({ text }: { text: string }) { return <div className="empty"><Database size={26} /><span>{text}</span></div>; }
export function Button({ children, variant = 'primary', onClick, disabled }: { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'outline' | 'danger'; onClick?: () => void; disabled?: boolean }) { return <button className={`btn ${variant}`} onClick={onClick} disabled={disabled}>{children}</button>; }
export function TableWrap({ children }: { children: React.ReactNode }) { return <div className="table-wrap">{children}</div>; }
export function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button onClick={onClose}><X size={19} /></button></div>{children}</div></div>; }
