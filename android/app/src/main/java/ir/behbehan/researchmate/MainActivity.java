package ir.behbehan.researchmate;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.Menu;
import android.view.MenuItem;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

/**
 * ResearchMate AI | پژوهش‌یار هوشمند — Android shell.
 *
 * The web app is full-stack (Next.js server + database + AI engine), so this
 * native shell renders the deployed instance in a secure WebView and adds
 * Android-grade file upload, report download and window handling.
 *
 * The server address is stored on the device and can be changed at runtime
 * from the menu (تغییر آدرس سرور) — no rebuild required.
 *
 * Designer: Seyed Mojtaba Kazemi — Faculty of Nursing,
 * Behbahan Faculty of Medical Sciences.
 */
public class MainActivity extends AppCompatActivity {

    /** Default instance — replace with your own deployed URL if needed. */
    private static final String DEFAULT_SERVER_URL =
            "https://preview-chat-a21e4f1b-a2ea-4f2c-8f8a-34c7ac87f3cb.space-z.ai";

    private static final String PREFS = "researchmate_prefs";
    private static final String KEY_SERVER_URL = "server_url";

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> pendingFileChooser;

    private final ActivityResultLauncher<Intent> fileChooserLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (pendingFileChooser != null) {
                    pendingFileChooser.onReceiveValue(
                            WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData()));
                    pendingFileChooser = null;
                }
            });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        progressBar = findViewById(R.id.progress);
        webView = findViewById(R.id.webview);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                Uri base = Uri.parse(currentServerUrl());
                // Keep the app's own host inside the WebView; open anything else externally.
                if (base.getHost() != null && base.getHost().equals(uri.getHost())) return false;
                openExternally(uri);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(ProgressBar.GONE);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress >= 100 ? ProgressBar.GONE : ProgressBar.VISIBLE);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (pendingFileChooser != null) pendingFileChooser.onReceiveValue(null);
                pendingFileChooser = callback;
                try {
                    fileChooserLauncher.launch(params.createIntent());
                } catch (Exception e) {
                    pendingFileChooser = null;
                    Toast.makeText(MainActivity.this, R.string.cannot_open_file_picker, Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture,
                                          android.os.Message resultMsg) {
                // window.open(...) targets (e.g. printable reports) → external browser,
                // where printing / saving as PDF works natively.
                WebView temp = new WebView(view.getContext());
                temp.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, String url) {
                        openExternally(Uri.parse(url));
                        return true;
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(temp);
                resultMsg.sendToTarget();
                return true;
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimeType, long contentLength) {
                try {
                    DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                    req.setMimeType(mimeType);
                    String cookie = CookieManager.getInstance().getCookie(url);
                    if (cookie != null) req.addRequestHeader("Cookie", cookie);
                    req.addRequestHeader("User-Agent", userAgent);
                    String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    req.setTitle(name);
                    req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                    DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    dm.enqueue(req);
                    Toast.makeText(MainActivity.this, R.string.download_started, Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    openExternally(Uri.parse(url));
                }
            }
        });

        webView.loadUrl(currentServerUrl());
    }

    private String currentServerUrl() {
        String saved = getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_SERVER_URL, null);
        String url = (saved == null || saved.trim().isEmpty()) ? DEFAULT_SERVER_URL : saved.trim();
        if (!url.startsWith("http")) url = "https://" + url;
        return url;
    }

    private void openExternally(Uri uri) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, uri);
            ContextCompat.startActivity(this, i, null);
        } catch (Exception ignored) {
        }
    }

    private void promptForServerUrl() {
        final EditText input = new EditText(this);
        input.setText(currentServerUrl());
        input.setHint(R.string.dialog_server_hint);
        input.setSelectAllOnFocus(true);

        new AlertDialog.Builder(this)
                .setTitle(R.string.dialog_server_title)
                .setMessage(R.string.dialog_server_message)
                .setView(input)
                .setPositiveButton(R.string.dialog_ok, (d, which) -> {
                    String url = input.getText().toString().trim();
                    if (!url.isEmpty()) {
                        getSharedPreferences(PREFS, MODE_PRIVATE)
                                .edit().putString(KEY_SERVER_URL, url).apply();
                        webView.loadUrl(currentServerUrl());
                    }
                })
                .setNegativeButton(R.string.dialog_cancel, null)
                .show();
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.main_menu, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.action_change_server) {
            promptForServerUrl();
            return true;
        } else if (id == R.id.action_reload) {
            webView.reload();
            return true;
        } else if (id == R.id.action_open_browser) {
            openExternally(Uri.parse(currentServerUrl()));
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.getOnBackPressedDispatcher().onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
