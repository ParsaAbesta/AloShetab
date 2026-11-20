import AsApp from '@/components/as/App';

/**
 * مسیر مستقل پنل مدیریت — پیام ۱۴ (v3.1.0)
 * اپلیکیشن مجزای مدیریت (APK/Windows/iOS) و لینک مستندات به همین مسیر اشاره می‌کنند؛
 * احراز هویت دو سطحی مالک (OWNER) / ادمین (ADMIN) در همین صفحه انجام می‌شود.
 */
export default function AdminPanelPage() {
  return <AsApp initialView="admin" />;
}
