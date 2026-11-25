import { formatCurrency, formatNumber } from './format';
import { supabase, ORG_ID, WAREHOUSE_ID } from './supabase';
import type {
  Product, Category, Customer, Supplier, Order, OrderItem,
  InventoryBalance, PricingRule, Promotion, AiAlert, AiTask, Notification,
  ProductWithInventory, OrderWithCustomer, AdminSetting, ImportJob, ImportJobRow,
  TrackedOrder, CashAccount, CashMovement, Payment, PurchaseOrder, PurchaseOrderItem,
  OrderRevision,
} from './types';

export type {
  TrackedOrder, CashAccount, CashMovement, Payment, PurchaseOrder, PurchaseOrderItem, OrderRevision,
} from './types';

// ─── Products ───
export async function fetchProducts(): Promise<ProductWithInventory[]> {
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('name');
  if (error) throw error;

  const { data: inventory, error: inventoryError } = await supabase
    .from('inventory_balances')
    .select('*')
    .eq('warehouse_id', WAREHOUSE_ID);
  if (inventoryError) throw inventoryError;

  const invMap = new Map<string, InventoryBalance>();
  inventory?.forEach((inv: InventoryBalance) => invMap.set(inv.product_id, inv));

  const { data: categories, error: categoryError } = await supabase
    .from('categories')
    .select('*')
    .eq('organization_id', ORG_ID);
  if (categoryError) throw categoryError;
  const catMap = new Map<string, Category>();
  categories?.forEach((cat: Category) => catMap.set(cat.id, cat));

  return (products as Product[]).map((p) => ({
    ...p,
    inventory: invMap.get(p.id),
    category: catMap.get(p.category_id || ''),
  }));
}

export async function createProduct(p: Partial<Product>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({ ...p, organization_id: ORG_ID })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

// ─── Categories ───
export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('sort_order');
  if (error) throw error;
  return data as Category[];
}

export async function createCategory(c: Partial<Category>): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ ...c, organization_id: ORG_ID })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

// ─── Customers ───
export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Customer[];
}

export async function createCustomer(c: Partial<Customer>): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({ ...c, organization_id: ORG_ID })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomerStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ status, approved_at: status === 'approved' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

// ─── Suppliers ───
export async function fetchSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('name');
  if (error) throw error;
  return data as Supplier[];
}

export async function createSupplier(s: Partial<Supplier>): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...s, organization_id: ORG_ID })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Orders ───
export async function fetchOrders(): Promise<OrderWithCustomer[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('organization_id', ORG_ID);
  const custMap = new Map<string, Customer>();
  customers?.forEach((c: Customer) => custMap.set(c.id, c));

  return (orders as Order[]).map((o) => ({
    ...o,
    customer: custMap.get(o.customer_id),
  }));
}

export async function fetchOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);
  if (error) throw error;
  return data as OrderItem[];
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) throw error;
  await supabase.from('order_status_history').insert({
    order_id: id,
    to_status: status,
    notes: `Status changed to ${status}`,
  });
}

export async function createOrder(order: {
  customer_id: string;
  items: { product_id: string; item_code: string; product_name: string; unit: string; quantity: number; unit_price: number }[];
  notes?: string;
}): Promise<Order> {
  const totalAmount = order.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;

  const { data: newOrder, error: orderError } = await supabase
    .from('orders')
    .insert({
      organization_id: ORG_ID,
      customer_id: order.customer_id,
      order_number: orderNumber,
      status: 'pending',
      total_amount: totalAmount,
      total_items: order.items.length,
      notes: order.notes ?? null,
    })
    .select()
    .single();
  if (orderError) throw orderError;

  const orderItems = order.items.map((item) => ({
    order_id: newOrder.id,
    product_id: item.product_id,
    item_code: item.item_code,
    product_name_snapshot: item.product_name,
    unit_snapshot: item.unit,
    quantity: item.quantity,
    unit_price_snapshot: item.unit_price,
    line_total: item.unit_price * item.quantity,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) throw itemsError;

  return newOrder;
}

// ─── Pricing rules ───
export async function fetchPricingRules(): Promise<PricingRule[]> {
  const { data, error } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('priority');
  if (error) throw error;
  return data as PricingRule[];
}

export async function togglePricingRule(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('pricing_rules').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}

// ─── Promotions ───
export async function fetchPromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Promotion[];
}

export async function togglePromotion(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('promotions').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}

// ─── AI Alerts ───
export async function fetchAiAlerts(): Promise<AiAlert[]> {
  const { data, error } = await supabase
    .from('ai_alerts')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as AiAlert[];
}

export async function resolveAiAlert(id: string): Promise<void> {
  const { error } = await supabase.from('ai_alerts').update({ is_resolved: true }).eq('id', id);
  if (error) throw error;
}

// ─── AI Tasks ───
export async function fetchAiTasks(): Promise<AiTask[]> {
  const { data, error } = await supabase
    .from('ai_tasks')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as AiTask[];
}

export async function toggleAiTaskStatus(id: string, status: string): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === 'completed') updates.completed_at = new Date().toISOString();
  const { error } = await supabase.from('ai_tasks').update(updates).eq('id', id);
  if (error) throw error;
}

// ─── Notifications ───
export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('organization_id', ORG_ID)
    .eq('is_read', false);
  if (error) throw error;
}

// ─── Admin Settings ───
export async function fetchSettings(): Promise<AdminSetting[]> {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('*')
    .eq('organization_id', ORG_ID);
  if (error) throw error;
  return data as AdminSetting[];
}

export async function updateSetting(key: string, value: unknown, category: string): Promise<void> {
  const { error } = await supabase
    .from('admin_settings')
    .upsert(
      { organization_id: ORG_ID, key, value, category, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id,key' }
    );
  if (error) throw error;
}

export async function fetchSettingsMap(): Promise<Record<string, unknown>> {
  const settings = await fetchSettings();
  const map: Record<string, unknown> = {};
  settings.forEach((s) => { map[s.key] = s.value; });
  return map;
}

// ─── Unified import engine ───
export async function createImportJob(input: {
  fileName: string;
  fileHash: string;
  fileSize: number;
  jobType: string;
  totalRows: number;
}): Promise<ImportJob> {
  const { data, error } = await supabase.from('import_jobs').insert({
    organization_id: ORG_ID,
    file_name: input.fileName,
    file_hash: input.fileHash,
    file_size: input.fileSize,
    job_type: input.jobType,
    total_rows: input.totalRows,
    status: 'staging',
    processed_rows: 0,
    success_rows: 0,
    failed_rows: 0,
  }).select().single();
  if (error) throw error;
  return data as ImportJob;
}

export async function insertImportRows(jobId: string, rows: Array<{ rowNumber: number; data: Record<string, unknown>; status: string; errors?: string[] }>): Promise<void> {
  const { error } = await supabase.from('import_job_rows').insert(rows.map((row) => ({
    import_job_id: jobId,
    row_number: row.rowNumber,
    data: row.data,
    status: row.status,
    errors: row.errors ?? null,
  })));
  if (error) throw error;
}

export async function updateImportJob(id: string, updates: Partial<ImportJob>): Promise<void> {
  const { error } = await supabase.from('import_jobs').update(updates).eq('id', id).eq('organization_id', ORG_ID);
  if (error) throw error;
}

export async function fetchImportJobs(): Promise<ImportJob[]> {
  const { data, error } = await supabase.from('import_jobs').select('*').eq('organization_id', ORG_ID).order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return data as ImportJob[];
}

export async function fetchImportRows(jobId: string): Promise<ImportJobRow[]> {
  const { data, error } = await supabase.from('import_job_rows').select('*').eq('import_job_id', jobId).order('row_number').limit(100000);
  if (error) throw error;
  return data as ImportJobRow[];
}

// ─── Server-verified checkout ───
export type PlaceOrderInput = {
  customer_id: string;
  items: { product_id: string; quantity: number }[];
  notes?: string;
  payment_method?: string;
  delivery_address?: string;
  phone?: string;
};

export type PlaceOrderResult = {
  order_id: string;
  order_number: string;
  total_amount: number;
  duplicate: boolean;
};

function checkoutErrorMessage(raw: string): string {
  if (raw.startsWith('INSUFFICIENT_STOCK:')) return `المخزون غير كافٍ للمنتج: ${raw.split(':')[1] ?? ''}`;
  if (raw.startsWith('PRODUCT_UNAVAILABLE:')) return `المنتج غير متاح حالياً: ${raw.split(':')[1] ?? ''}`;
  if (raw === 'INVALID_QUANTITY') return 'الكمية المحددة غير صالحة';
  if (raw === 'EMPTY_ORDER') return 'السلة فارغة';
  return 'تعذر إرسال الطلب، حاول مرة أخرى';
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const { data, error } = await supabase.rpc('place_order', {
    p_organization_id: ORG_ID,
    p_customer_id: input.customer_id,
    p_warehouse_id: WAREHOUSE_ID,
    p_items: input.items,
    p_notes: input.notes ?? null,
    p_payment_method: input.payment_method ?? 'cash_on_delivery',
    p_delivery_address: input.delivery_address ?? null,
    p_phone: input.phone ?? null,
    p_idempotency_key: `web-${crypto.randomUUID()}`,
  });
  if (error) throw new Error(checkoutErrorMessage(error.message));
  return data as PlaceOrderResult;
}

// ─── Order tracking (guest or customer) ───
export async function fetchOrderByNumber(orderNumber: string, phone?: string): Promise<TrackedOrder> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('organization_id', ORG_ID)
    .eq('order_number', orderNumber.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!order) throw new Error('لا يوجد طلب بهذا الرقم');
  if (phone && order.contact_phone && phone.trim() && order.contact_phone !== phone.trim()) {
    throw new Error('رقم الهاتف لا يطابق الطلب');
  }

  const [{ data: items }, { data: history }] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', order.id),
    supabase.from('order_status_history').select('to_status, notes, created_at').eq('order_id', order.id).order('created_at'),
  ]);

  return { ...order, status_history: history ?? [] } as TrackedOrder;
}

// ─── Order revision cycle (customer request → merchant decision) ───
export async function fetchOrderRevisions(orderId: string): Promise<OrderRevision[]> {
  const { data, error } = await supabase
    .from('order_revisions').select('*').eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as OrderRevision[];
}

export async function fetchPendingRevisions(): Promise<OrderRevision[]> {
  const { data, error } = await supabase
    .from('order_revisions').select('*').eq('organization_id', ORG_ID)
    .eq('status', 'pending').order('created_at', { ascending: false });
  if (error) throw error;
  return data as OrderRevision[];
}

export async function requestOrderRevision(input: {
  order_id: string;
  order_number: string;
  reason: string;
  phone: string;
  items: { order_item_id: string; product_name: string; original_qty: number; requested_qty: number }[];
}): Promise<OrderRevision> {
  const { count } = await supabase
    .from('order_revisions').select('id', { count: 'exact', head: true })
    .eq('order_id', input.order_id);
  const { data, error } = await supabase.from('order_revisions').insert({
    organization_id: ORG_ID,
    order_id: input.order_id,
    revision_number: (count ?? 0) + 1,
    reason: input.reason,
    items: input.items,
    requested_phone: input.phone,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function decideOrderRevision(input: {
  revision: OrderRevision;
  approve: boolean;
}): Promise<{ newOrderNumber: string | null }> {
  const { revision, approve } = input;
  const { data: order } = await supabase
    .from('orders').select('*').eq('id', revision.order_id).maybeSingle();
  if (!order) throw new Error('الطلب الأصلي غير موجود');

  const { data: items } = await supabase
    .from('order_items').select('*').eq('order_id', revision.order_id);
  if (!items) throw new Error('تعذر قراءة بنود الطلب');

  let newOrderNumber: string | null = null;

  if (approve) {
    // Build the revised item set: requested quantities replace originals, zero-qty items dropped
    const requested = new Map(revision.items.map((i) => [i.order_item_id, i.requested_qty]));
    const revisedItems = (items as OrderItem[])
      .map((i) => ({ ...i, quantity: requested.get(i.id) ?? Number(i.quantity) }))
      .filter((i) => Number(i.quantity) > 0);
    if (!revisedItems.length) throw new Error('لا توجد بنود بعد التعديل');

    const totalAmount = revisedItems.reduce((s, i) => s + Number(i.unit_price_snapshot) * Number(i.quantity), 0);
    const newOrderNumberGen = `ORD-${Date.now().toString().slice(-8)}`;
    const { data: newOrder, error: insertError } = await supabase.from('orders').insert({
      organization_id: ORG_ID,
      customer_id: order.customer_id,
      order_number: newOrderNumberGen,
      status: 'pending',
      total_amount: totalAmount,
      total_items: revisedItems.length,
      notes: `تعديل للطلب ${order.order_number} — سبب: ${revision.reason}`,
      contact_phone: order.contact_phone,
      delivery_address: order.delivery_address,
      payment_method: order.payment_method,
    }).select().single();
    if (insertError) throw insertError;

    const { error: itemsInsertError } = await supabase.from('order_items').insert(
      revisedItems.map((i) => ({
        order_id: newOrder.id,
        product_id: i.product_id,
        item_code: i.item_code,
        product_name_snapshot: i.product_name_snapshot,
        unit_snapshot: i.unit_snapshot,
        quantity: i.quantity,
        unit_price_snapshot: i.unit_price_snapshot,
        line_total: Number(i.unit_price_snapshot) * Number(i.quantity),
      }))
    );
    if (itemsInsertError) throw itemsInsertError;

    newOrderNumber = newOrder.order_number;
    await supabase.from('orders').update({ status: 'revised' }).eq('id', order.id);
    await supabase.from('order_status_history').insert({
      order_id: order.id, from_status: order.status, to_status: 'revised',
      notes: `اعتُمد التعديل رقم ${revision.revision_number} وأنشئ الطلب ${newOrder.order_number}`,
    });
  }

  const { error: updateError } = await supabase.from('order_revisions').update({
    status: approve ? 'approved' : 'rejected',
    new_order_id: approve ? newOrderNumber : null,
    decided_at: new Date().toISOString(),
  }).eq('id', revision.id);
  if (updateError) throw updateError;

  return { newOrderNumber };
}

// ─── Daily decisions engine ───
export type DailyDecision = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  problem: string;
  cause: string;
  source: string;
  impact: string;
  action: string;
  impactValue: number;
};

export async function fetchDailyDecisions(): Promise<DailyDecision[]> {
  const [products, customers, orders, lowStockInv] = await Promise.all([
    fetchProducts(),
    fetchCustomers(),
    fetchOrders(),
    supabase.from('inventory_balances').select('product_id, quantity_on_hand, quantity_available, reorder_point').eq('warehouse_id', WAREHOUSE_ID),
  ]);
  const decisions: DailyDecision[] = [];

  // 1. Out-of-stock products with demand
  const invByProduct = new Map((lowStockInv.data ?? []).map((i: { product_id: string; quantity_on_hand: number; quantity_available: number; reorder_point: number }) => [i.product_id, i]));
  for (const p of products) {
    const inv = invByProduct.get(p.id);
    const available = inv?.quantity_available ?? 0;
    if (available <= 0 && p.status === 'active') {
      decisions.push({
        id: `oos-${p.id}`, severity: 'critical',
        title: `الصنف "${p.name}" نفد من المخزون`,
        problem: 'الصنف غير قابل للبيع حالياً',
        cause: 'استهلك الرصيد المتاح دون أمر شراء مستلم',
        source: `أرصدة المخزون — ${p.item_code}`,
        impact: 'خسارة مبيعات محتملة على الصنف',
        action: 'افتح المركز المالي → محرك إعادة التوريد وأنشئ أمر شراء',
        impactValue: Number(p.base_price) * 10,
      });
    } else if (inv && available <= inv.reorder_point) {
      decisions.push({
        id: `low-${p.id}`, severity: 'warning',
        title: `الصنف "${p.name}" عند حد إعادة الطلب`,
        problem: `المتاح ${formatNumber(available)} عند حد ${formatNumber(inv.reorder_point)}`,
        cause: 'مبيعات جارية تستهلك الرصيد',
        source: `أرصدة المخزون — ${p.item_code}`,
        impact: 'خطر نفاد قريب',
        action: 'راجع محرك إعادة التوريد وأنشئ أمر شراء قبل النفاد',
        impactValue: Number(p.base_price) * 5,
      });
    }
  }

  // 2. Largest overdue customer balances
  const debtors = customers.filter((c) => c.current_balance > 0).sort((a, b) => b.current_balance - a.current_balance).slice(0, 3);
  for (const c of debtors) {
    decisions.push({
      id: `debtor-${c.id}`, severity: 'warning',
      title: `مستحقات غير محصلة لدى "${c.business_name}"`,
      problem: `رصيد مستحق ${formatCurrency(c.current_balance)}`,
      cause: 'مبيعات آجلة لم تُحصَّل بعد',
      source: `ملف العميل ${c.customer_code}`,
      impact: 'تجميد رأس المال العامل وتزايد مخاطر التحصيل',
      action: 'تواصل مع العميل وسجل التحصيل من شاشة المدفوعات',
      impactValue: Number(c.current_balance),
    });
  }

  // 3. Stalled orders (pending > 24h)
  const stalled = orders.filter((o) => o.status === 'pending' && Date.now() - new Date(o.created_at).getTime() > 86400000);
  for (const o of stalled.slice(0, 3)) {
    decisions.push({
      id: `stalled-${o.id}`, severity: 'critical',
      title: `الطلب #${o.order_number} معلق أكثر من 24 ساعة`,
      problem: `قيمة ${formatCurrency(o.total_amount)} بانتظار التأكيد`,
      cause: 'لم يُعتمد الطلب أو يُتواصل مع العميل',
      source: `سجل الطلبات — ${o.customer?.business_name ?? 'عميل'}`,
      impact: 'خطر إلغاء العميل أو فقدان الثقة',
      action: 'راجع الطلب وأكد تجهيزه أو تواصل مع العميل',
      impactValue: Number(o.total_amount),
    });
  }

  // 4. Payables due to suppliers
  const { data: suppliers } = await supabase.from('suppliers').select('id, name, current_balance').eq('organization_id', ORG_ID);
  for (const s of (suppliers ?? []).filter((s: { current_balance: number }) => Number(s.current_balance) > 0).slice(0, 2)) {
    decisions.push({
      id: `payable-${s.id}`, severity: 'info',
      title: `التزام سداد للمورد "${s.name}"`,
      problem: `مستحق ${formatCurrency(s.current_balance)}`,
      cause: 'مشتريات آجلة مسجلة في الذمم الدائنة',
      source: `ملف المورد`,
      impact: 'تأخر السداد يضعف شروط التوريد',
      action: 'سدد من شاشة المدفوعات وفق الاتفاق',
      impactValue: Number(s.current_balance),
    });
  }

  return decisions.sort((a, b) => (b.severity === 'critical' ? 1 : 0) - (a.severity === 'critical' ? 1 : 0) || b.impactValue - a.impactValue);
}

// ─── Finance: cash accounts, payments ───
export async function fetchCashAccounts(): Promise<CashAccount[]> {
  const { data, error } = await supabase
    .from('cash_accounts').select('*').eq('organization_id', ORG_ID).order('created_at');
  if (error) throw error;
  return data as CashAccount[];
}

export async function createCashAccount(input: { name: string; type: string; currency: string; opening_balance: number }): Promise<CashAccount> {
  const { data, error } = await supabase
    .from('cash_accounts')
    .insert({ ...input, organization_id: ORG_ID }).select().single();
  if (error) throw error;
  return data;
}

export async function fetchCashMovements(limit = 50): Promise<CashMovement[]> {
  const { data, error } = await supabase
    .from('cash_movements').select('*').eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data as CashMovement[];
}

export async function fetchPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments').select('*').eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data as Payment[];
}

function paymentErrorMessage(raw: string): string {
  if (raw.includes('INVALID_AMOUNT')) return 'المبلغ يجب أن يكون أكبر من صفر';
  if (raw.includes('NO_OUTSTANDING_BALANCE')) return 'لا يوجد رصيد مستحق على هذه الجهة';
  if (raw.includes('PARTY_NOT_FOUND')) return 'الجهة غير موجودة';
  if (raw.includes('ACCOUNT_NOT_FOUND')) return 'الصندوق أو الحساب غير صالح';
  return 'تعذر تسجيل الدفعة';
}

export async function recordPayment(input: {
  direction: 'receipt' | 'payment';
  party_type: 'customer' | 'supplier';
  party_id: string;
  amount: number;
  method: string;
  cash_account_id: string | null;
  order_id?: string | null;
  notes?: string;
}): Promise<{ payment_id: string; payment_number?: string; duplicate: boolean }> {
  const { data: accounts } = await supabase
    .from('cash_accounts').select('currency').eq('id', input.cash_account_id ?? '').maybeSingle();
  const { data, error } = await supabase.rpc('record_payment', {
    p_organization_id: ORG_ID,
    p_direction: input.direction,
    p_party_type: input.party_type,
    p_party_id: input.party_id,
    p_amount: input.amount,
    p_currency: accounts?.currency ?? 'YER',
    p_method: input.method,
    p_cash_account_id: input.cash_account_id,
    p_order_id: input.order_id ?? null,
    p_notes: input.notes ?? null,
    p_idempotency_key: `pay-${crypto.randomUUID()}`,
  });
  if (error) throw new Error(paymentErrorMessage(error.message));
  return data as { payment_id: string; payment_number?: string; duplicate: boolean };
}

// ─── Procurement: purchase orders + replenishment engine ───
export async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from('purchase_orders').select('*').eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as PurchaseOrder[];
}

export async function fetchPurchaseOrderItems(poId: string): Promise<PurchaseOrderItem[]> {
  const { data, error } = await supabase
    .from('purchase_order_items').select('*').eq('purchase_order_id', poId);
  if (error) throw error;
  return data as PurchaseOrderItem[];
}

export async function createPurchaseOrder(input: {
  supplier_id: string | null;
  expected_date?: string | null;
  notes?: string;
  items: { product_id: string; item_code: string; product_name: string; unit: string; quantity: number; unit_cost: number }[];
}): Promise<PurchaseOrder> {
  const totalAmount = input.items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);
  let poNumber = `PO-${Date.now().toString().slice(-8)}`;
  const { data: clash } = await supabase
    .from('purchase_orders').select('id').eq('organization_id', ORG_ID).eq('po_number', poNumber).maybeSingle();
  if (clash) poNumber = `PO-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .insert({
      organization_id: ORG_ID, po_number: poNumber, supplier_id: input.supplier_id,
      status: 'submitted', total_amount: totalAmount, currency: 'YER',
      expected_date: input.expected_date ?? null, notes: input.notes ?? null,
    }).select().single();
  if (error) throw error;

  const { error: itemsError } = await supabase.from('purchase_order_items').insert(
    input.items.map((i) => ({
      purchase_order_id: po.id, product_id: i.product_id, item_code: i.item_code,
      product_name_snapshot: i.product_name, unit_snapshot: i.unit,
      quantity: i.quantity, unit_cost: i.unit_cost, line_total: i.quantity * i.unit_cost,
    }))
  );
  if (itemsError) throw itemsError;
  return po;
}

export async function receivePurchaseOrder(poId: string): Promise<void> {
  const { data: items, error: itemsError } = await supabase
    .from('purchase_order_items').select('*').eq('purchase_order_id', poId);
  if (itemsError) throw itemsError;
  const { error } = await supabase
    .from('purchase_orders').update({ status: 'received', updated_at: new Date().toISOString() })
    .eq('id', poId).eq('organization_id', ORG_ID).neq('status', 'received');
  if (error) throw error;

  // Each received item increases on-hand stock at the main warehouse
  for (const item of items ?? []) {
    if (!item.product_id || !item.quantity) continue;
    const { data: balance } = await supabase
      .from('inventory_balances').select('id, quantity_on_hand')
      .eq('product_id', item.product_id).eq('warehouse_id', WAREHOUSE_ID).maybeSingle();
    if (balance) {
      await supabase.from('inventory_balances')
        .update({ quantity_on_hand: Number(balance.quantity_on_hand) + Number(item.quantity), updated_at: new Date().toISOString() })
        .eq('id', balance.id);
    } else {
      await supabase.from('inventory_balances').insert({
        product_id: item.product_id, warehouse_id: WAREHOUSE_ID,
        quantity_on_hand: item.quantity, quantity_reserved: 0, reorder_point: 0,
      });
    }
    await supabase.from('inventory_movements').insert({
      product_id: item.product_id, warehouse_id: WAREHOUSE_ID, movement_type: 'receipt',
      quantity: item.quantity, reference_type: 'purchase_order', reference_id: poId,
      reason: 'استلام أمر شراء',
    });
  }
}

export type ReplenishmentSuggestion = {
  product: ProductWithInventory;
  currentStock: number;
  reorderPoint: number;
  incomingQty: number;
  daysOfCover: number | null;
  suggestedQty: number;
  reason: string;
};

export async function fetchReplenishmentSuggestions(): Promise<ReplenishmentSuggestion[]> {
  const products = await fetchProducts();
  const orders = await fetchOrders();
  const pos = await fetchPurchaseOrders();
  const { data: openPoItems } = await supabase
    .from('purchase_order_items')
    .select('product_id, quantity, purchase_order_id');
  if (!openPoItems) return [];

  const openPoIds = new Set(pos.filter((p) => p.status === 'submitted' || p.status === 'draft').map((p) => p.id));
  const incomingByProduct = new Map<string, number>();
  openPoItems.forEach((i: { product_id: string | null; quantity: number; purchase_order_id: string }) => {
    if (i.product_id && openPoIds.has(i.purchase_order_id)) {
      incomingByProduct.set(i.product_id, (incomingByProduct.get(i.product_id) ?? 0) + Number(i.quantity));
    }
  });

  // Daily demand from delivered + processing orders over the last 30 days
  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const soldByProduct = new Map<string, number>();
  const recentOrders = orders.filter((o) => new Date(o.created_at).getTime() >= thirtyDaysAgo
    && (o.status === 'processing' || o.status === 'confirmed' || o.status === 'delivered'));
  const items = await Promise.all(recentOrders.map((o) => fetchOrderItems(o.id)));
  items.flat().forEach((i) => {
    if (i.product_id) soldByProduct.set(i.product_id, (soldByProduct.get(i.product_id) ?? 0) + Number(i.quantity));
  });

  const suggestions: ReplenishmentSuggestion[] = [];
  for (const product of products) {
    const stock = product.inventory?.quantity_available ?? 0;
    const reorderPoint = product.inventory?.reorder_point ?? product.min_stock ?? 0;
    if (stock > reorderPoint) continue;
    const dailyDemand = (soldByProduct.get(product.id) ?? 0) / 30;
    const incoming = incomingByProduct.get(product.id) ?? 0;
    const daysOfCover = dailyDemand > 0 ? Math.floor(stock / dailyDemand) : null;
    const target = Math.max(reorderPoint * 2, dailyDemand * 30);
    const suggestedQty = Math.max(Math.ceil(target - stock - incoming), 0);
    const reason = stock <= 0
      ? `الصنف نفد من المخزون${incoming > 0 ? `، والقادم قيد الاستلام ${formatNumber(incoming)}` : '، ولا يوجد أمر شراء مفتوح'}`
      : daysOfCover !== null
        ? `الرصيد يكفي ${formatNumber(daysOfCover)} يوماً فقط وفق مبيعات آخر 30 يوماً`
        : `الرصيد ${formatNumber(stock)} عند حد إعادة الطلب ${formatNumber(reorderPoint)} دون مبيعات حديثة موثقة`;
    suggestions.push({ product, currentStock: stock, reorderPoint, incomingQty: incoming, daysOfCover, suggestedQty, reason });
  }
  return suggestions.sort((a, b) => a.currentStock - b.currentStock);
}

// ─── Dashboard stats ───
export async function fetchDashboardStats() {
  const [products, customers, orders, alerts, lowStock] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('organization_id', ORG_ID).eq('status', 'active'),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('organization_id', ORG_ID),
    supabase.from('orders').select('id, status, total_amount', { count: 'exact' }).eq('organization_id', ORG_ID),
    supabase.from('ai_alerts').select('id', { count: 'exact', head: true }).eq('organization_id', ORG_ID).eq('is_resolved', false),
    supabase.from('inventory_balances').select('quantity_on_hand, reorder_point, product_id').eq('warehouse_id', WAREHOUSE_ID),
  ]);

  const lowStockCount = (lowStock.data || []).filter(
    (inv: { quantity_on_hand: number; reorder_point: number }) => inv.quantity_on_hand <= inv.reorder_point
  ).length;

  const ordersData = orders.data || [];
  const totalSales = ordersData.reduce((sum: number, o: { total_amount: number }) => sum + (o.total_amount || 0), 0);
  const processingCount = ordersData.filter((o: { status: string }) => o.status === 'processing' || o.status === 'pending').length;

  return {
    productCount: products.count || 0,
    customerCount: customers.count || 0,
    orderCount: orders.count || 0,
    totalSales,
    processingCount,
    alertCount: alerts.count || 0,
    lowStockCount,
  };
}
