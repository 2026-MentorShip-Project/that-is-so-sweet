export function isRestrictedBrowser(): boolean {
  const ua = navigator.userAgent;
  const isLine = /Line\//i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isLine || isSafari;
}

export function buildChromeUrl(href: string): string {
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    const url = new URL(href);
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(':', '')};package=com.android.chrome;end`;
  }
  return href.replace(/^https:\/\//, 'googlechromes://').replace(/^http:\/\//, 'googlechrome://');
}
