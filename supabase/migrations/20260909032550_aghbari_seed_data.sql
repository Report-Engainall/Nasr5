/*
# Seed Data for Aghbari Platform

Populates all tables with demo data. Uses only valid hex UUIDs.
UUID prefix mapping:
- a0 = organization, b0 = branches, d0 = warehouses, f0 = profile
- c0 = customers, a2 = suppliers, ca = categories, a1 = products, a3 = orders
*/

DO $$
DECLARE
  v_org uuid := 'a0000000-0000-0000-0000-000000000001';
  v_br1 uuid := 'b0000000-0000-0000-0000-000000000001';
  v_br2 uuid := 'b0000000-0000-0000-0000-000000000002';
  v_wh1 uuid := 'd0000000-0000-0000-0000-000000000001';
  v_wh2 uuid := 'd0000000-0000-0000-0000-000000000002';
  v_prof uuid := 'f0000000-0000-0000-0000-000000000001';
  v_cat1 uuid := 'ca000000-0000-0000-0000-000000000001';
  v_cat2 uuid := 'ca000000-0000-0000-0000-000000000002';
  v_cat3 uuid := 'ca000000-0000-0000-0000-000000000003';
  v_cat4 uuid := 'ca000000-0000-0000-0000-000000000004';
  v_cat10 uuid := 'ca000000-0000-0000-0000-000000000010';
  v_cat11 uuid := 'ca000000-0000-0000-0000-000000000011';
BEGIN
  INSERT INTO organizations (id, name, legal_name, currency, phone, email, address)
  VALUES (v_org, 'الأغبري للمواد الغذائية', 'شركة الأغبري للمواد الغذائية ذ.م.م', 'YER', '+967-1-234567', 'info@aghbari.ye', 'صنعاء - اليمن')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO branches (id, organization_id, name, code, address, phone) VALUES
  (v_br1, v_org, 'الفرع الرئيسي - صنعاء', 'BR-SANA', 'صنعاء - شارع حدة', '+967-1-234567'),
  (v_br2, v_org, 'فرع عدن', 'BR-ADEN', 'عدن - خور مكسر', '+967-2-345678')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO warehouses (id, organization_id, branch_id, name, code) VALUES
  (v_wh1, v_org, v_br1, 'مخزن صنعاء الرئيسي', 'WH-SANA-01'),
  (v_wh2, v_org, v_br2, 'مخزن عدن', 'WH-ADEN-01')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO profiles (id, organization_id, full_name, email, phone) VALUES
  (v_prof, v_org, 'محمد الأغبري', 'admin@aghbari.ye', '+967-777-123456')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_roles (profile_id, role) VALUES (v_prof, 'admin') ON CONFLICT DO NOTHING;

  INSERT INTO customers (id, organization_id, customer_code, business_name, contact_name, phone, tier, credit_limit, current_balance, status, approved_at) VALUES
  ('c0000000-0000-0000-0000-000000000001', v_org, 'CUST-001', 'سوق العامري - فرع صنعاء', 'عامر محمد', '+967-777-111111', 'wholesale', 5000000, 1250000, 'approved', now()),
  ('c0000000-0000-0000-0000-000000000002', v_org, 'CUST-002', 'سوق العامري - فرع عدن', 'أحمد عامر', '+967-777-222222', 'wholesale', 3000000, 850000, 'approved', now()),
  ('c0000000-0000-0000-0000-000000000003', v_org, 'CUST-003', 'بقالة النور', 'سعيد النور', '+967-777-333333', 'retail', 500000, 0, 'approved', now()),
  ('c0000000-0000-0000-0000-000000000004', v_org, 'CUST-004', 'مجمّع الأغبري التجاري', 'فهد الأغبري', '+967-777-444444', 'vip', 10000000, 3200000, 'approved', now()),
  ('c0000000-0000-0000-0000-000000000005', v_org, 'CUST-005', 'سوبر ماركت الأمل', 'منى الأمل', '+967-777-555555', 'wholesale', 2000000, 0, 'pending', NULL)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO suppliers (id, organization_id, supplier_code, name, contact_name, phone, email) VALUES
  ('a2000000-0000-0000-0000-000000000001', v_org, 'SUP-001', 'مصنع السكر البرازيلي', 'Carlos Silva', '+55-11-12345678', 'sales@brasilsugar.br'),
  ('a2000000-0000-0000-0000-000000000002', v_org, 'SUP-002', 'شركة الأرز الباكستاني', 'Imran Khan', '+92-21-1234567', 'export@rice.pk'),
  ('a2000000-0000-0000-0000-000000000003', v_org, 'SUP-003', 'مطاحن اليمن للدقيق', 'عبدالله المطحن', '+967-1-987654', 'sales@yemenflour.ye')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO categories (id, organization_id, parent_id, name, code, sort_order) VALUES
  (v_cat1, v_org, NULL, 'المواد الغذائية الأساسية', 'FOOD', 1),
  (v_cat2, v_org, NULL, 'المشروبات', 'BEV', 2),
  (v_cat3, v_org, NULL, 'المنظفات', 'CLEAN', 3),
  (v_cat4, v_org, NULL, 'المعلبات', 'CANNED', 4),
  (v_cat10, v_org, v_cat1, 'الحبوب والبقول', 'GRAINS', 1),
  (v_cat11, v_org, v_cat1, 'الزيوت', 'OILS', 2)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO products (id, organization_id, category_id, name, item_code, barcode, description, unit, base_price, cost_price, min_stock, status) VALUES
  ('a1000000-0000-0000-0000-000000000001', v_org, v_cat10, 'سكر برازيلي 50ك', '10301002', '6001234500017', 'سكر أبيض مكرر برازيلي - كيس 50 كجم', 'كرتون', 38500, 35000, 50, 'active'),
  ('a1000000-0000-0000-0000-000000000002', v_org, v_cat10, 'أرز بسمتي فاخر', '10301015', '6001234500024', 'أرز بسمتي باكستاني فاخر - كيس 25 كجم', 'كرتون', 28000, 24000, 30, 'active'),
  ('a1000000-0000-0000-0000-000000000003', v_org, v_cat11, 'زيت دوار الشمس 1 لتر', '10301028', '6001234500031', 'زيت دوار شمس مكرر - عبوة 1 لتر', 'كرتون', 12500, 10000, 100, 'active'),
  ('a1000000-0000-0000-0000-000000000004', v_org, v_cat10, 'دقيق أبيض 50 كجم', '10301041', '6001234500048', 'دقيق قمح أبيض فاخر - كيس 50 كجم', 'كرتون', 17500, 15000, 40, 'active'),
  ('a1000000-0000-0000-0000-000000000005', v_org, v_cat2, 'معكرونة إيطالية 500ج', '10301054', '6001234500055', 'معكرونة إيطالية درجة أولى - عبوة 500 جم', 'كرتون', 4200, 3500, 80, 'active'),
  ('a1000000-0000-0000-0000-000000000006', v_org, v_cat2, 'عصير برتقال 1 لتر', '10301067', '6001234500062', 'عصير برتقال طبيعي 100% - عبوة 1 لتر', 'كرتون', 8500, 7000, 60, 'active'),
  ('a1000000-0000-0000-0000-000000000007', v_org, v_cat3, 'مسحوق غسيل 5ك', '10301070', '6001234500079', 'مسحوق غسيل أوتوماتيك - كيس 5 كجم', 'كرتون', 15000, 12000, 25, 'active'),
  ('a1000000-0000-0000-0000-000000000008', v_org, v_cat4, 'تونة قطع 185ج', '10301083', '6001234500086', 'تونة مصبرة قطع في زيت - علبة 185 جم', 'كرتون', 9500, 7500, 100, 'active'),
  ('a1000000-0000-0000-0000-000000000009', v_org, v_cat10, 'عدس أحمر 25ك', '10301096', '6001234500093', 'عدس أحمر مصري فاخر - كيس 25 كجم', 'كرتون', 22000, 18000, 35, 'active'),
  ('a1000000-0000-0000-0000-000000000010', v_org, v_cat11, 'زيت زيتون بكر 1 لتر', '10301109', '6001234500109', 'زيت زيتون بكر ممتاز - عبوة 1 لتر', 'كرتون', 35000, 28000, 20, 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO product_prices (product_id, tier, price, min_quantity) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'retail', 38500, 1),
  ('a1000000-0000-0000-0000-000000000001', 'wholesale', 37000, 10),
  ('a1000000-0000-0000-0000-000000000001', 'vip', 35500, 20),
  ('a1000000-0000-0000-0000-000000000002', 'retail', 28000, 1),
  ('a1000000-0000-0000-0000-000000000002', 'wholesale', 26500, 10),
  ('a1000000-0000-0000-0000-000000000002', 'vip', 25000, 20),
  ('a1000000-0000-0000-0000-000000000003', 'retail', 12500, 1),
  ('a1000000-0000-0000-0000-000000000003', 'wholesale', 11500, 10),
  ('a1000000-0000-0000-0000-000000000004', 'retail', 17500, 1),
  ('a1000000-0000-0000-0000-000000000004', 'wholesale', 16500, 10),
  ('a1000000-0000-0000-0000-000000000005', 'retail', 4200, 1),
  ('a1000000-0000-0000-0000-000000000006', 'retail', 8500, 1),
  ('a1000000-0000-0000-0000-000000000007', 'retail', 15000, 1),
  ('a1000000-0000-0000-0000-000000000008', 'retail', 9500, 1),
  ('a1000000-0000-0000-0000-000000000009', 'retail', 22000, 1),
  ('a1000000-0000-0000-0000-000000000010', 'retail', 35000, 1)
  ON CONFLICT (product_id, tier) DO NOTHING;

  INSERT INTO inventory_balances (product_id, warehouse_id, quantity_on_hand, quantity_reserved, reorder_point) VALUES
  ('a1000000-0000-0000-0000-000000000001', v_wh1, 548, 0, 50),
  ('a1000000-0000-0000-0000-000000000002', v_wh1, 324, 0, 30),
  ('a1000000-0000-0000-0000-000000000003', v_wh1, 89, 0, 100),
  ('a1000000-0000-0000-0000-000000000004', v_wh1, 276, 0, 40),
  ('a1000000-0000-0000-0000-000000000005', v_wh1, 12, 0, 80),
  ('a1000000-0000-0000-0000-000000000006', v_wh1, 450, 0, 60),
  ('a1000000-0000-0000-0000-000000000007', v_wh1, 180, 0, 25),
  ('a1000000-0000-0000-0000-000000000008', v_wh1, 620, 0, 100),
  ('a1000000-0000-0000-0000-000000000009', v_wh1, 95, 0, 35),
  ('a1000000-0000-0000-0000-000000000010', v_wh1, 45, 0, 20),
  ('a1000000-0000-0000-0000-000000000001', v_wh2, 320, 0, 50),
  ('a1000000-0000-0000-0000-000000000002', v_wh2, 210, 0, 30)
  ON CONFLICT (product_id, warehouse_id) DO NOTHING;

  INSERT INTO pricing_rules (organization_id, name, scope_type, adjustment_type, adjustment_value, is_active, priority) VALUES
  (v_org, 'تسعير تلقائي حسب التغطية', 'default', 'percentage', 2, true, 100),
  (v_org, 'خصم الكميات الكبيرة', 'default', 'percentage', -5, true, 200),
  (v_org, 'تسعير العملاء المميزين', 'tier', 'percentage', -3, false, 300),
  (v_org, 'تسعير حسب المواسم', 'seasonal', 'percentage', 5, true, 400)
  ON CONFLICT DO NOTHING;

  INSERT INTO promotions (organization_id, title, description, discount_type, discount_value, start_date, end_date, is_active) VALUES
  (v_org, 'عرض رمضان الكريم', 'خصم على المواد الغذائية الأساسية', 'percentage', 25, '2026-03-01', '2026-03-30', true),
  (v_org, 'خصم نهاية الأسبوع', 'خصم أسبوعي على المشروبات', 'percentage', 15, '2026-01-01', '2026-12-31', true),
  (v_org, 'عرض الأصناف الجديدة', 'خصم على المنتجات الجديدة', 'percentage', 10, '2026-09-01', '2026-09-15', false)
  ON CONFLICT DO NOTHING;

  INSERT INTO orders (id, organization_id, customer_id, order_number, status, total_amount, total_items, created_by, created_at) VALUES
  ('a3000000-0000-0000-0000-000000000001', v_org, 'c0000000-0000-0000-0000-000000000001', 'ORD-2026-001', 'processing', 84750, 3, v_prof, '2026-09-08T08:00:00Z'),
  ('a3000000-0000-0000-0000-000000000002', v_org, 'c0000000-0000-0000-0000-000000000002', 'ORD-2026-002', 'confirmed', 56000, 2, v_prof, '2026-09-08T09:30:00Z'),
  ('a3000000-0000-0000-0000-000000000003', v_org, 'c0000000-0000-0000-0000-000000000004', 'ORD-2026-003', 'delivered', 192500, 5, v_prof, '2026-09-07T14:00:00Z'),
  ('a3000000-0000-0000-0000-000000000004', v_org, 'c0000000-0000-0000-0000-000000000003', 'ORD-2026-004', 'draft', 0, 0, v_prof, '2026-09-08T10:00:00Z'),
  ('a3000000-0000-0000-0000-000000000005', v_org, 'c0000000-0000-0000-0000-000000000001', 'ORD-2026-005', 'pending', 125000, 4, v_prof, '2026-09-08T11:00:00Z')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO order_items (order_id, product_id, item_code, product_name_snapshot, unit_snapshot, quantity, unit_price_snapshot, line_total) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '10301002', 'سكر برازيلي 50ك', 'كرتون', 2, 38500, 77000),
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', '10301028', 'زيت دوار الشمس 1 لتر', 'كرتون', 1, 7750, 7750),
  ('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', '10301015', 'أرز بسمتي فاخر', 'كرتون', 2, 28000, 56000),
  ('a3000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', '10301002', 'سكر برازيلي 50ك', 'كرتون', 3, 38500, 115500),
  ('a3000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004', '10301041', 'دقيق أبيض 50 كجم', 'كرتون', 2, 17500, 35000),
  ('a3000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000008', '10301083', 'تونة قطع 185ج', 'كرتون', 4, 9500, 38000),
  ('a3000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', '10301002', 'سكر برازيلي 50ك', 'كرتون', 2, 38500, 77000),
  ('a3000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', '10301054', 'معكرونة إيطالية 500ج', 'كرتون', 5, 4200, 21000),
  ('a3000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000006', '10301067', 'عصير برتقال 1 لتر', 'كرتون', 3, 8500, 25500)
  ON CONFLICT DO NOTHING;

  INSERT INTO ai_alerts (organization_id, alert_type, severity, title, body) VALUES
  (v_org, 'low_stock', 'critical', 'مخزون منخفض: معكرونة إيطالية', 'الكمية المتبقية 12 كرتون — أقل من حد إعادة الطلب (80)'),
  (v_org, 'low_stock', 'warning', 'مخزون منخفض: زيت دوار الشمس', 'الكمية المتبقية 89 كرتون — اقترب من حد إعادة الطلب (100)'),
  (v_org, 'price_change', 'info', 'توصية تسعير: سكر برازيلي', 'محرك التسعير يقترح رفع السعر 2% بسبب انخفاض أيام التغطية'),
  (v_org, 'payment', 'warning', 'متابعة دفع: سوق العامري - صنعاء', 'فاتورة مستحقة بقيمة 1,250,000 ر.ي متأخرة 5 أيام')
  ON CONFLICT DO NOTHING;

  INSERT INTO ai_tasks (organization_id, title, description, task_type, priority, status) VALUES
  (v_org, 'مراجعة طلبات العملاء الجديدة', '5 طلبات جديدة بانتظار المراجعة', 'review', 'high', 'pending'),
  (v_org, 'متابعة مخزون الأصناف المنخفضة', '3 أصناف تحتاج إعادة طلب', 'inventory', 'high', 'in_progress'),
  (v_org, 'مراجعة تقرير السيولة الأسبوعي', 'تقرير السيولة جاهز للمراجعة', 'finance', 'medium', 'pending')
  ON CONFLICT DO NOTHING;

  INSERT INTO notifications (organization_id, profile_id, title, body, type) VALUES
  (v_org, v_prof, 'تنبيه: 3 أصناف اقتربت من النفاد', 'يرجى مراجعة مخزون المعكرونة والزيت', 'warning'),
  (v_org, v_prof, 'تقرير السيولة الأسبوعي جاهز', 'التقرير متاح للمراجعة في قسم التقارير', 'info'),
  (v_org, v_prof, 'طلب جديد من سوق العامري', 'طلب رقم ORD-2026-005 بانتظار المراجعة', 'info'),
  (v_org, v_prof, 'عميل جديد بانتظار الموافقة', 'سوبر ماركت الأمل يطلب التسجيل كعميل', 'info'),
  (v_org, v_prof, 'مزامنة أونكس برو مكتملة', 'تمت مزامنة 120 صنف بنجاح', 'success')
  ON CONFLICT DO NOTHING;

  INSERT INTO admin_settings (organization_id, key, value, category) VALUES
  (v_org, 'brand_name', '"الأغبري للمواد الغذائية"', 'general'),
  (v_org, 'currency', '"YER"', 'general'),
  (v_org, 'default_language', '"ar"', 'general'),
  (v_org, 'low_stock_threshold', '50', 'inventory'),
  (v_org, 'auto_pricing_enabled', 'true', 'pricing'),
  (v_org, 'order_auto_confirm', 'false', 'orders')
  ON CONFLICT DO NOTHING;
END $$;