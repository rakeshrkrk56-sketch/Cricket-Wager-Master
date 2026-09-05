import { Download } from 'lucide-react';

const APK_DOWNLOAD_URL = 'https://jazment.online/api/app/apk';

function BrandMark() {
  return (
    <span className="apk-download-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export function LandingPage() {
  return (
    <main className="apk-download-page">
      <a className="apk-download-brand" href="/" aria-label="Jazment home">
        <BrandMark />
        <span>jazment</span>
      </a>

      <section className="apk-download-content" aria-labelledby="apk-download-title">
        <h1 id="apk-download-title">Download Jazment App</h1>
        <a
          className="apk-download-button"
          href={APK_DOWNLOAD_URL}
          download="Jazment.apk"
          data-testid="link-download-apk"
        >
          <Download size={22} aria-hidden="true" />
          <span>DOWNLOAD APK</span>
        </a>
        <p>Android APK</p>
      </section>
    </main>
  );
}