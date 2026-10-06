/**
 * SEO spam denylist (versioned, explicit, no heuristic).
 *
 * Company pages listed here are rendered `noindex,follow` and left out of
 * sitemap.xml. They are NOT removed from the data: they stay in the ranking,
 * the company page still renders, and every number is unchanged.
 *
 * Scope: gambling / casino / betting, sellers of followers, likes, views,
 * reviews or traffic, link spam, piracy guides, adult. Add or remove a slug
 * with a one-line reason; review in PR.
 *
 * Reviewed and NOT listed (not clearly spam): cryptonewsz, cryptomoonpress
 * (crypto news), crypto-tracker (crypto tool), seolead (unclear business),
 * buycheaprdp (RDP hosting), hashtags-for-likes (hashtag tool),
 * open-apk-file (file utility), upgrow (growth agency).
 *
 * v2026-10-06.4 · Data triage + awisee-agency (same agency as awisee)
 */
export type SpamCategory =
  | "gambling"
  | "fake-engagement"
  | "fake-reviews"
  | "fake-traffic"
  | "link-spam"
  | "piracy"
  | "adult";

export const SPAM_DENYLIST_VERSION = "2026-10-06.4";

/** Who flagged it: "qa" = QA sitemap review (2026-10-06), "dev" = Dev pass over the full catalog. */
export type SpamSource = "qa" | "dev" | "data";

export const SPAM_DENYLIST: Readonly<Record<string, { category: SpamCategory; source: SpamSource; reason: string }>> = {
  // gambling
  "uudetkasinot-com": { category: "gambling", source: "qa", reason: "Finnish online casino listing" },
  "nettikasinot-media": { category: "gambling", source: "qa", reason: "Finnish online casino listing" },
  "nettikasinot-org": { category: "gambling", source: "qa", reason: "Finnish online casino listing" },
  "nettikasinot": { category: "gambling", source: "qa", reason: "Finnish online casino listing" },
  "nettikasinolista-com": { category: "gambling", source: "qa", reason: "Finnish online casino listing" },
  "parhaatnettikasinot-com": { category: "gambling", source: "qa", reason: "Finnish online casino listing" },
  "kasinohai-com": { category: "gambling", source: "qa", reason: "Finnish online casino listing" },
  "kasinot-fi": { category: "gambling", source: "qa", reason: "Finnish online casino listing" },
  "kasinosivut": { category: "gambling", source: "qa", reason: "Finnish online casino listing" },
  "pelisivut": { category: "gambling", source: "dev", reason: "Finnish online casino listing" },
  "ilmaiset-pitk-vetovihjeet": { category: "gambling", source: "dev", reason: "betting tips / betting bonuses" },
  "vedonlyontibonukset-com": { category: "gambling", source: "dev", reason: "betting bonuses" },
  "kasynohex": { category: "gambling", source: "dev", reason: "Polish online casino listing" },
  "topkasynoonline-pl": { category: "gambling", source: "dev", reason: "Polish online casino listing" },
  "plkasynaonline": { category: "gambling", source: "dev", reason: "Polish online casino listing" },
  "netpositive": { category: "gambling", source: "dev", reason: "Polish bookmaker ranking" },
  "voetbalgokken": { category: "gambling", source: "dev", reason: "Dutch sports betting" },
  "hollandsegokken-nl": { category: "gambling", source: "dev", reason: "Dutch online gambling" },
  "spelpaus-co": { category: "gambling", source: "dev", reason: "casinos without Swedish self-exclusion" },
  "automatenspieler": { category: "gambling", source: "dev", reason: "German slot machine site" },
  "book-of-ra-german": { category: "gambling", source: "dev", reason: "German slot machine site" },
  "bonusfinder-canada": { category: "gambling", source: "dev", reason: "casino bonus site" },
  "bonustwist": { category: "gambling", source: "dev", reason: "casino bonus site" },
  "bonusoid": { category: "gambling", source: "dev", reason: "casino bonus site" },
  "fortune-games": { category: "gambling", source: "dev", reason: "sweepstakes casino" },
  "riversweeps-internet-cafe-sweepstakes-software": { category: "gambling", source: "dev", reason: "sweepstakes slot software" },
  "fun88": { category: "gambling", source: "dev", reason: "online casino / sportsbook" },
  "777": { category: "gambling", source: "dev", reason: "Ukrainian online casino" },
  "vegas": { category: "gambling", source: "dev", reason: "Ukrainian online casino" },
  "betking": { category: "gambling", source: "dev", reason: "Ukrainian online casino" },
  "slotoking": { category: "gambling", source: "qa", reason: "Ukrainian online casino" },
  "fruityking-nz": { category: "gambling", source: "dev", reason: "online casino" },
  "au-internet-pokies": { category: "gambling", source: "dev", reason: "online pokies" },
  "payid-pokies": { category: "gambling", source: "dev", reason: "online pokies" },
  "kajino-com": { category: "gambling", source: "dev", reason: "online casino" },
  "parimatch": { category: "gambling", source: "dev", reason: "sportsbook / casino" },
  "1win": { category: "gambling", source: "dev", reason: "online casino / sportsbook" },
  "banzaibet": { category: "gambling", source: "qa", reason: "online casino" },
  "betbry": { category: "gambling", source: "dev", reason: "online betting" },
  "plinko-game": { category: "gambling", source: "dev", reason: "plinko gambling game" },
  "https-chicken-roadd-com": { category: "gambling", source: "dev", reason: "crash gambling game" },
  "fortune-tiger": { category: "gambling", source: "dev", reason: "slot gambling game" },
  "bdg-game": { category: "gambling", source: "dev", reason: "colour prediction gambling app" },
  "tiranga-game": { category: "gambling", source: "dev", reason: "colour prediction gambling app" },
  "daman-game": { category: "gambling", source: "dev", reason: "colour prediction gambling app" },
  "daman-game-login": { category: "gambling", source: "dev", reason: "colour prediction gambling app" },
  "ok-win": { category: "gambling", source: "dev", reason: "colour prediction gambling app" },
  // fake-engagement
  "socialboosting": { category: "fake-engagement", source: "qa", reason: "sells followers / likes" },
  "famoid": { category: "fake-engagement", source: "dev", reason: "sells followers / likes" },
  "blastup": { category: "fake-engagement", source: "dev", reason: "sells followers / likes" },
  "stormlikes": { category: "fake-engagement", source: "qa", reason: "sells followers / likes" },
  "buy-fans": { category: "fake-engagement", source: "qa", reason: "sells followers / likes" },
  "media-mister": { category: "fake-engagement", source: "dev", reason: "sells followers / likes" },
  "buy-youtube-subscribers-media-mister": { category: "fake-engagement", source: "qa", reason: "sells YouTube subscribers" },
  "buzzvoice-com": { category: "fake-engagement", source: "dev", reason: "sells followers / likes" },
  "instant-famous": { category: "fake-engagement", source: "dev", reason: "sells followers / likes" },
  "sidesmedia": { category: "fake-engagement", source: "dev", reason: "sells followers / subscribers" },
  "want-to-boost-your-channel-on-youtube-buy-youtube-subscribers-from-sidesmedia-watch-your-subs-grow": { category: "fake-engagement", source: "qa", reason: "sells YouTube subscribers" },
  "buy-youtube-subscribers": { category: "fake-engagement", source: "qa", reason: "sells YouTube subscribers" },
  "buy-twitter-followers": { category: "fake-engagement", source: "qa", reason: "sells X followers" },
  "buy-twitter-followers-visit-twesocial": { category: "fake-engagement", source: "qa", reason: "sells X followers" },
  "buy-x-twitter-followers-from-bulkoid": { category: "fake-engagement", source: "qa", reason: "sells X followers" },
  "bulkoid": { category: "fake-engagement", source: "dev", reason: "sells followers / likes" },
  "socialdawn": { category: "fake-engagement", source: "dev", reason: "sells followers / likes" },
  "crescitaly": { category: "fake-engagement", source: "dev", reason: "SMM panel" },
  "smm-panel": { category: "fake-engagement", source: "dev", reason: "SMM panel" },
  "my-social-following-is-the-1-source-for-social-media-advertising-on-all-social-networks-instagram-youtube-tiktok-facebook-twitter-x-and-spotify-join-our-500-000-clients-who-have-been-with-us-since-2007": { category: "fake-engagement", source: "dev", reason: "sells followers / likes" },
  "bulkviews": { category: "fake-engagement", source: "dev", reason: "sells YouTube views" },
  "volgersboost": { category: "fake-engagement", source: "qa", reason: "sells followers (NL)" },
  "fameviso-buy-real-followers-and-likes": { category: "fake-engagement", source: "qa", reason: "sells followers / likes" },
  "fameviso-buy-real-followers-likes-views": { category: "fake-engagement", source: "qa", reason: "sells followers / likes" },
  "fameviso-monthly-auto-likes-automated-instagram-engagement": { category: "fake-engagement", source: "qa", reason: "sells automated likes" },
  "purchase-facebook-likes": { category: "fake-engagement", source: "qa", reason: "sells Facebook likes" },
  "buy-facebook-followers": { category: "fake-engagement", source: "qa", reason: "sells Facebook followers" },
  // fake-reviews
  "buy-google-reviews": { category: "fake-reviews", source: "qa", reason: "sells Google reviews" },
  "fameviso-buy-google-reviews-safely": { category: "fake-reviews", source: "qa", reason: "sells Google reviews" },
  "reviewcart": { category: "fake-reviews", source: "qa", reason: "sells reviews" },
  // fake-traffic
  "real-targeted-traffic": { category: "fake-traffic", source: "dev", reason: "sells website traffic" },
  "targeted-web-traffic": { category: "fake-traffic", source: "dev", reason: "sells website traffic" },
  "targetedvisitors": { category: "fake-traffic", source: "dev", reason: "sells website traffic" },
  "targeted-website-traffic": { category: "fake-traffic", source: "dev", reason: "sells website traffic" },
  "targeted-organic-traffic": { category: "fake-traffic", source: "dev", reason: "sells website traffic" },
  "twt-s": { category: "fake-traffic", source: "dev", reason: "sells website traffic" },
  "t-v-services": { category: "fake-traffic", source: "dev", reason: "sells website traffic" },
  "seowebsitetraffic-net": { category: "fake-traffic", source: "qa", reason: "sells website traffic" },
  // link-spam
  "backlink-bento": { category: "link-spam", source: "dev", reason: "sells backlinks" },
  "black-hat-webmasters": { category: "link-spam", source: "dev", reason: "black-hat SEO forum" },
  // piracy
  "fire-stick-tricks": { category: "piracy", source: "qa", reason: "Fire TV Stick sideloading / IPTV guides" },
  "fire-stick-how": { category: "piracy", source: "qa", reason: "Fire TV Stick sideloading / IPTV guides" },
  "piratebay": { category: "piracy", source: "dev", reason: "Pirate Bay proxy" },
  // adult
  "john-s-directory": { category: "adult", source: "dev", reason: "adult directory" },
  // WFOSS Data triage 2026-10-06
  "baocasino": { category: "gambling", source: "data", reason: "online casino (baocasino.com + OC)" },
  "bsc-news": { category: "gambling", source: "data", reason: "Thai gambling affiliate (name พนัน)" },
  "w-in-ua": { category: "gambling", source: "data", reason: "Ukrainian online casino listing (w.in.ua)" },
  "spin-paradise": { category: "gambling", source: "data", reason: "casino affiliate / parked lander" },
  "aviator": { category: "gambling", source: "data", reason: "1Win casino / sports betting (techyguy.in)" },
  "writers-per-hour": { category: "link-spam", source: "data", reason: "essay writing / homework mill" },
  "awisee": { category: "link-spam", source: "data", reason: "link building / SEO outreach agency" },
  "awisee-agency": { category: "link-spam", source: "data", reason: "same agency as awisee (awisee.agency / spam_seo)" },
};

export function isSpamDenylisted(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(SPAM_DENYLIST, slug);
}
