import { Platform } from 'react-native'

import { ANALYTICS_CONFIG, EXTERNAL_ANALYTICS_ENABLED } from '~/lib/analytics/config'

/**
 * Injects Google Tag Manager, GA4, Meta Pixel, and Microsoft Clarity on web.
 * Native platforms use dedicated SDKs via `lib/analytics/external.native.ts`.
 */
export function ExternalAnalyticsScripts() {
  if (Platform.OS !== 'web' || !EXTERNAL_ANALYTICS_ENABLED) return null

  const { googleTagManagerId, googleAnalyticsId, metaPixelId, clarityProjectId } = ANALYTICS_CONFIG

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${googleTagManagerId}');`,
        }}
      />
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${googleAnalyticsId}', { send_page_view: false });
`,
        }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${metaPixelId}');
`,
        }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${clarityProjectId}");
`,
        }}
      />
    </>
  )
}

/** noscript fallbacks belong in `<body>`, not `<head>`. */
export function ExternalAnalyticsNoscript() {
  if (Platform.OS !== 'web' || !EXTERNAL_ANALYTICS_ENABLED) return null

  const { googleTagManagerId, metaPixelId } = ANALYTICS_CONFIG

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${googleTagManagerId}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
        title="Google Tag Manager"
      />
      <img
        height="1"
        width="1"
        style={{ display: 'none' }}
        src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  )
}
