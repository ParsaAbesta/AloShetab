package ir.aloshetab.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/**
 * پوستهٔ اندروید سامانهٔ الو شتاب — نسخهٔ ۱٫۱٫۰
 * نمایشگر امن وب‌اپ؛ آدرس سرویس از assets/config.json خوانده می‌شود (فقط https).
 * مجوزها: اینترنت + موقعیت مکانی (برای ثبت مختصات GPS مهندس/مشتری در پنل مدیریت).
 * طبق قاعدهٔ محرمانگی کارفرما، این پوسته صرفاً نمایشگر است و هیچ منطق مالی ندارد.
 */
public class MainActivity extends Activity {

    private static final String FALLBACK_URL = "https://preview-chat-22c14f58-87b5-4b90-9644-cdda6c3f3645.space-z.ai/";
    private static final int REQ_LOC = 101;
    private static final int REQ_FILE = 102;

    private WebView web;
    private String serviceUrl;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestLocationIfNeeded();

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                // لینک‌های داخلی در همین WebView باز می‌شوند؛ tel:/mailto: و… به اپ‌های سیستمی
                if (url.startsWith("http://") || url.startsWith("https://")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { }
                return true;
            }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) showErrorPage(v);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                cb.invoke(origin, true, false);
            }
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    startActivityForResult(Intent.createChooser(i, "انتخاب فایل"), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.setBackgroundColor(Color.parseColor("#FFFFFF"));
        setContentView(web);

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            loadService();
        }
    }

    private void loadService() {
        web.loadUrl(loadUrl());
    }

    private void requestLocationIfNeeded() {
        if (Build.VERSION.SDK_INT >= 23) {
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOC);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        // رد شدن مجوز GPS مانع کارکرد سرویس نمی‌شود؛ فقط ثبت مختصات خاموش می‌ماند.
    }

    /** خواندن آدرس سرویس از assets/config.json — فقط https پذیرفته می‌شود */
    private String loadUrl() {
        try (InputStream in = getAssets().open("config.json")) {
            byte[] buf = new byte[8192];
            StringBuilder sb = new StringBuilder();
            int n;
            while ((n = in.read(buf)) > 0) sb.append(new String(buf, 0, n, StandardCharsets.UTF_8));
            JSONObject o = new JSONObject(sb.toString());
            String url = o.optString("url", FALLBACK_URL).trim();
            serviceUrl = url.startsWith("https://") ? url : FALLBACK_URL;
        } catch (Exception e) {
            serviceUrl = FALLBACK_URL;
        }
        return serviceUrl;
    }

    /** صفحهٔ خطای فارسی برای قطع شبکه یا دامنهٔ غیرفعال، با دکمهٔ تلاش دوباره */
    private void showErrorPage(WebView v) {
        String target = (serviceUrl == null ? FALLBACK_URL : serviceUrl);
        String html = "<!doctype html><html dir=\"rtl\" lang=\"fa\"><head><meta charset=\"utf-8\">"
            + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            + "<style>body{font-family:sans-serif;background:linear-gradient(160deg,#177A67,#0B3D34);color:#fff;"
            + "display:flex;align-items:center;justify-content:center;height:100vh;margin:0}div{text-align:center;padding:24px}"
            + "h2{font-size:20px;margin:0 0 12px}p{font-size:14px;opacity:.85;margin:0 0 24px;line-height:1.9}"
            + "button{background:#fff;color:#177A67;border:0;border-radius:24px;padding:12px 36px;font-size:15px;font-weight:bold}</style></head>"
            + "<body><div><h2>اتصال برقرار نشد</h2>"
            + "<p>لطفاً اتصال اینترنت را بررسی کنید.<br>"
            + "اگر دامنهٔ سرویس به‌تازگی تغییر کرده، مقدار url در فایل config.json را به‌روزرسانی کنید.</p>"
            + "<button onclick=\"location.href='" + target + "'\">تلاش دوباره</button></div></body></html>";
        v.loadDataWithBaseURL(target, html, "text/html", "utf-8", null);
    }

    @Override
    protected void onActivityResult(int code, int res, Intent data) {
        if (code == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fileCallback = null;
        } else {
            super.onActivityResult(code, res, data);
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }
}
