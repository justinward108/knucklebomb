(function () {
  'use strict';
  if (window.PoorCampAnalytics) return;
  var hosts = ['poor.camp', 'www.poor.camp', 'champions.poor.camp', 'leadershand.poor.camp', 'dosa.poor.camp', 'makingof.poor.camp', 'usingtoolstocreate.poor.camp', 'paradiselost.poor.camp', 'nirvanasales.poor.camp', 'therecord.poor.camp', 'newsletters.poor.camp', 'gumroad.poor.camp', 'shopify.poor.camp'];
  var guideHosts = ['makingof.poor.camp', 'usingtoolstocreate.poor.camp'];
  var wikiHost = location.hostname === 'therecord.poor.camp';
  var wikiArticleId = wikiHost ? document.querySelector('meta[name="poorcamp-wiki-article-id"]')?.content || '' : '';
  var blocked = wikiHost && !/^[1-9][0-9]*$/.test(wikiArticleId) || !hosts.includes(location.hostname) || navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || /\/(?:operations|newsroom|messages|sso)(?:\/|\.)/.test(location.pathname);
  var measurementId = document.querySelector('meta[name="poorcamp-analytics-id"]')?.content || '';
  var configured = /^G-[A-Z0-9]+$/.test(measurementId);
  var enabled = false;
  var loaded = false;
  var experienceActive = false;
  var events = ['page_view', 'portal_handoff', 'download_opened', 'discord_handoff_opened', 'experience_started', 'experience_completed', 'guide_started', 'chapter_progress'];
  var fileTypes = ['pdf', 'epub', 'zip', 'xlsx', 'csv', 'md'];
  var chapterProgress = new Set();
  // Report only known source categories, never a referrer's URL or search terms.
  var sourceHosts = { 'google.com': 'google', 'www.google.com': 'google', 'bing.com': 'bing', 'www.bing.com': 'bing', 'duckduckgo.com': 'duckduckgo', 'www.duckduckgo.com': 'duckduckgo', 'discord.com': 'discord', 'discord.gg': 'discord', 'facebook.com': 'facebook', 'www.facebook.com': 'facebook', 'l.facebook.com': 'facebook', 'instagram.com': 'instagram', 'www.instagram.com': 'instagram', 't.co': 'x', 'bsky.app': 'bluesky' };
  function acquisition() {
    var source = 'direct_or_unknown';
    try {
      var referrer = new URL(document.referrer);
      source = hosts.includes(referrer.hostname) ? 'portal' : sourceHosts[referrer.hostname] || 'other_referral';
    } catch (_) {}
    var safe = { entry_source: source };
    // Only these authored campaign names are accepted. Arbitrary UTM values,
    // click IDs, search terms and unrecognized URL parameters are discarded.
    try {
      var query = new URL(location.href).searchParams;
      var campaign = query.get('utm_campaign');
      if (['portal-launch', 'makingof-launch', 'reader-resources'].includes(campaign)) {
        var campaignSource = query.get('utm_source');
        var campaignMedium = query.get('utm_medium');
        if (['newsletter', 'discord', 'facebook', 'instagram', 'bluesky', 'x', 'poorcamp'].includes(campaignSource) && ['email', 'social', 'referral'].includes(campaignMedium)) {
          safe.campaign_name = campaign;
          safe.campaign_source = campaignSource;
          safe.campaign_medium = campaignMedium;
        }
      }
    } catch (_) {}
    return safe;
  }
  function consent() {
    try { return localStorage.getItem('poorcamp.analytics.consent') === 'granted'; } catch (_) { return false; }
  }
  function path() {
    return location.pathname.replace(/\/index\.html$/, '/');
  }
  function section() {
    var first = path().split('/').filter(Boolean)[0] || 'home';
    // Only authored public section labels; never dynamic IDs or private paths.
    if (wikiHost) return 'the-record';
    return ['atlas', 'beyond-our-borders', 'contraband', 'restoration-placement', 'testament-drawing', 'you', 'household', 'angel', 'unity', 'halcyon', 'fbn', 'dgcn', 'beauty-in-motion', 'starwire', 'greateramerica', 'arcade', 'gaming-hall', 'nirvana', 'the-record', 'passage', 'civic-exchange', 'community', 'corporations', 'free-downloads', 'discord', 'contact', 'privacy', 'terms', 'case-studies', 'downloads'].includes(first) ? first : first === 'home' ? 'home' : 'other';
  }
  function track(name, properties) {
    if (!enabled || !consent() || !events.includes(name)) return false;
    if (name === 'experience_completed' && !experienceActive) return false;
    var safe = { site: location.hostname, section: section(), content_group: section(), page_path: path(), page_location: location.origin + path(), page_referrer: '', page_title: '' };
    if (wikiHost) {
      safe.article_id = wikiArticleId;
      safe.page_location = location.origin + '/index.php?curid=' + wikiArticleId;
    }
    if (name === 'page_view') Object.assign(safe, acquisition());
    if (name === 'portal_handoff' && properties && hosts.includes(properties.destination_site)) safe.destination_site = properties.destination_site;
    if (name === 'download_opened' && properties && fileTypes.includes(properties.file_type)) safe.file_type = properties.file_type;
    if (name === 'chapter_progress') {
      if (![25, 50, 75, 100].includes(properties?.progress_percent)) return false;
      safe.progress_percent = properties.progress_percent;
    }
    try { window.gtag('event', name, safe); } catch (_) { return false; }
    if (name === 'experience_started') experienceActive = true;
    if (name === 'experience_completed') experienceActive = false;
    return true;
  }
  function activate() {
    enabled = configured && consent() && !blocked;
    if (!enabled) experienceActive = false;
    window['ga-disable-' + measurementId] = !enabled;
    if (!enabled || loaded) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, { send_page_view: false, content_group: section(), page_location: wikiHost ? location.origin + '/index.php?curid=' + wikiArticleId : location.origin + path(), page_referrer: '', page_title: '', cookie_domain: 'poor.camp', cookie_prefix: 'pc_analytics', cookie_expires: 7776000, allow_google_signals: false, allow_ad_personalization_signals: false });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(script);
    loaded = true;
    track('page_view');
    if (guideHosts.includes(location.hostname) && /^\/case-studies\/[^/]+\/(?:index\.html)?$/.test(location.pathname)) track('guide_started');
  }
  function setConsent(granted) {
    try { localStorage.setItem('poorcamp.analytics.consent', granted ? 'granted' : 'denied'); } catch (_) { return; }
    if (!granted && loaded) {
      experienceActive = false;
      window.gtag('consent', 'update', { analytics_storage: 'denied' });
      document.cookie.split(';').forEach(function (cookie) {
        var name = cookie.trim().split('=')[0];
        if (!name.startsWith('pc_analytics')) return;
        ['', '; Domain=poor.camp', '; Domain=' + location.hostname].forEach(function (domain) {
          document.cookie = name + '=; Max-Age=0; Path=/' + domain + '; Secure; SameSite=Lax';
        });
      });
    } else if (granted && loaded && !blocked) window.gtag('consent', 'update', { analytics_storage: 'granted' });
    activate();
  }
  window.PoorCampAnalytics = Object.freeze({ track: track, setConsent: setConsent });
  document.addEventListener('poorcamp:milestone', function (event) {
    if (['experience_started', 'experience_completed'].includes(event.detail)) track(event.detail);
  });
  document.addEventListener('click', function (event) {
    var anchor = event.target.closest?.('a[href]');
    if (!anchor) return;
    var destination;
    try { destination = new URL(anchor.href, location.href); } catch (_) { return; }
    if (!['http:', 'https:'].includes(destination.protocol)) return;
    if (hosts.includes(destination.hostname) && destination.hostname !== location.hostname) track('portal_handoff', { destination_site: destination.hostname });
    if (['discord.gg', 'discord.com'].includes(destination.hostname)) track('discord_handoff_opened');
    var extension = destination.pathname.match(/\.(pdf|epub|zip|xlsx|csv|md)$/i)?.[1].toLowerCase();
    if (extension) track('download_opened', { file_type: extension });
  });
  window.addEventListener('storage', function (event) { if (event.key === 'poorcamp.analytics.consent') activate(); });
  // Reading depth is a viewport milestone, not proof that a chapter was read.
  if (guideHosts.includes(location.hostname) && /^\/case-studies\/[^/]+\/(?:index\.html)?$/.test(location.pathname)) {
    window.addEventListener('scroll', function () {
      if (!enabled || !consent()) return;
      var article = document.querySelector('article.learn-prose');
      if (!article || article.getBoundingClientRect().height < window.innerHeight) return;
      var box = article.getBoundingClientRect();
      var percent = Math.max(0, Math.min(100, (window.innerHeight - box.top) / box.height * 100));
      [25, 50, 75, 100].forEach(function (threshold) {
        if (percent >= threshold && !chapterProgress.has(threshold) && track('chapter_progress', { progress_percent: threshold })) chapterProgress.add(threshold);
      });
    }, { passive: true });
  }
  function controls() {
    if (!configured || blocked) return;
    var panel = document.createElement('aside');
    panel.setAttribute('aria-label', 'Optional audience measurement');
    panel.id = 'audience-measurement';
    var fullscreen = ['paradiselost.poor.camp', 'nirvanasales.poor.camp'].includes(location.hostname);
    var content = panel;
    var details;
    if (fullscreen) {
      details = document.createElement('details');
      var summary = document.createElement('summary');
      summary.textContent = 'Audience measurement';
      summary.style.cssText = 'cursor:pointer;font-weight:600;';
      details.appendChild(summary);
      content = document.createElement('div');
      details.appendChild(content);
      panel.appendChild(details);
    }
    panel.style.cssText = 'position:relative;padding:16px;background:#fff;color:#111;border:2px solid #555;font:16px/1.5 system-ui;';
    if (fullscreen) panel.style.cssText += 'position:fixed;bottom:8px;right:8px;max-width:min(380px,calc(100vw - 16px));max-height:45vh;overflow:auto;z-index:100000;';
    var message = document.createElement('p');
    message.textContent = 'Optional Google Analytics measurement helps improve Poor Camp. It records page visits, broad traffic sources and selected milestones, never your messages or typed text. Your choice applies to this site; analytics cookies can span participating Poor Camp sites. Advertising features are disabled.';
    content.appendChild(message);
    var privacy = document.createElement('a');
    privacy.href = 'https://poor.camp/privacy/';
    privacy.textContent = 'Privacy and audience measurement';
    content.appendChild(privacy);
    [['Allow analytics', true], ['Decline / withdraw analytics', false]].forEach(function (choice) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = choice[0];
      button.style.cssText = 'margin:4px;padding:10px;font:inherit;';
      button.addEventListener('click', function () { setConsent(choice[1]); status.textContent = choice[1] ? 'Analytics allowed.' : 'Analytics disabled.'; if (details) details.open = false; });
      content.appendChild(button);
    });
    var status = document.createElement('p');
    status.setAttribute('role', 'status');
    content.appendChild(status);
    document.body.appendChild(panel);
  }
  activate();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', controls); else controls();
})();
