import { useState } from 'react';
import { Activity, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function Login() {
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState('admin@aghbari.ye');
  const [password, setPassword] = useState('admin123');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { setError('أدخل البريد وكلمة المرور'); return; }
    setError('');
    try {
      await signIn(email, password);
    } catch {
      setError('تعذر تسجيل الدخول. تحقق من البيانات.');
    }
  }

  return (
    <div className="login-screen" dir="rtl">
      <div className="login-left">
        <div className="login-brand"><div className="login-brand-icon"><Activity size={28} /></div><div><strong>الأغبري</strong><span>منصة التوزيع الذكية</span></div></div>
        <div className="login-hero"><h2>نظام تشغيل متكامل لإدارة المواد الغذائية بالجملة</h2><p>تتبع الطلبات والمخزون والعملاء والأسعار من لوحة واحدة ذكية ومترابطة.</p></div>
        <div className="login-features"><div className="login-feature"><ShieldCheck size={20} /> <span>بيانات محمية بنظام صلاحيات متكامل</span></div><div className="login-feature"><Activity size={20} /> <span>تحديث فوري للمخزون والطلبات</span></div><div className="login-feature"><Lock size={20} /> <span>وصول آمن لكل أعضاء الفريق</span></div></div>
      </div>
      <div className="login-right">
        <form className="login-form" onSubmit={handleSubmit}>
          <h1>تسجيل الدخول</h1>
          <p>أدخل بياناتك للوصول إلى لوحة التحكم</p>
          <label className="login-field"><span>البريد الإلكتروني</span><div className="login-input-wrap"><Mail size={18} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@aghbari.ye" /></div></label>
          <label className="login-field"><span>كلمة المرور</span><div className="login-input-wrap"><Lock size={18} /><input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          {error && <div className="login-error">{error}</div>}
          <button className="login-submit" type="submit" disabled={loading}>{loading ? 'جار الدخول...' : 'دخول'}</button>
          <div className="login-hint">بيانات تجريبية: admin@aghbari.ye / admin123</div>
        </form>
      </div>
    </div>
  );
}
