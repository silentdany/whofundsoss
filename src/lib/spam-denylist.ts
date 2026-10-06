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
 * v1 · 2026-10-06 · catalog collectedAt 2026-10-05
 */
export type SpamCategory =
  | "gambling"
  | "fake-engagement"
  | "fake-reviews"
  | "fake-traffic"
  | "link-spam"
  | "piracy"
  | "adult";

export const SPAM_DENYLIST_VERSION = "2026-10-06.1";

export const SPAM_DENYLIST: Readonly<Record<string, { category: SpamCategory; reason: string }>> = {
  // gambling
  "uudetkasinot-com": { category: "gambling", reason: "Finnish online casino listing" },
  "nettikasinot-media": { category: "gambling", reason: "Finnish online casino listing" },
  "nettikasinot-org": { category: "gambling", reason: "Finnish online casino listing" },
  "nettikasinot": { category: "gambling", reason: "Finnish online casino listing" },
  "nettikasinolista-com": { category: "gambling", reason: "Finnish online casino listing" },
  "parhaatnettikasinot-com": { category: "gambling", reason: "Finnish online casino listing" },
  "kasinohai-com": { category: "gambling", reason: "Finnish online casino listing" },
  "kasinot-fi": { category: "gambling", reason: "Finnish online casino listing" },
  "kasinosivut": { category: "gambling", reason: "Finnish online casino listing" },
  "pelisivut": { category: "gambling", reason: "Finnish online casino listing" },
  "ilmaiset-pitk-vetovihjeet": { category: "gambling", reason: "betting tips / betting bonuses" },
  "vedonlyontibonukset-com": { category: "gambling", reason: "betting bonuses" },
  "kasynohex": { category: "gambling", reason: "Polish online casino listing" },
  "topkasynoonline-pl": { category: "gambling", reason: "Polish online casino listing" },
  "plkasynaonline": { category: "gambling", reason: "Polish online casino listing" },
  "netpositive": { category: "gambling", reason: "Polish bookmaker ranking" },
  "voetbalgokken": { category: "gambling", reason: "Dutch sports betting" },
  "hollandsegokken-nl": { category: "gambling", reason: "Dutch online gambling" },
  "spelpaus-co": { category: "gambling", reason: "casinos without Swedish self-exclusion" },
  "automatenspieler": { category: "gambling", reason: "German slot machine site" },
  "book-of-ra-german": { category: "gambling", reason: "German slot machine site" },
  "bonusfinder-canada": { category: "gambling", reason: "casino bonus site" },
  "bonustwist": { category: "gambling", reason: "casino bonus site" },
  "bonusoid": { category: "gambling", reason: "casino bonus site" },
  "fortune-games": { category: "gambling", reason: "sweepstakes casino" },
  "riversweeps-internet-cafe-sweepstakes-software": { category: "gambling", reason: "sweepstakes slot software" },
  "fun88": { category: "gambling", reason: "online casino / sportsbook" },
  "777": { category: "gambling", reason: "Ukrainian online casino" },
  "vegas": { category: "gambling", reason: "Ukrainian online casino" },
  "betking": { category: "gambling", reason: "Ukrainian online casino" },
  "slotoking": { category: "gambling", reason: "Ukrainian online casino" },
  "fruityking-nz": { category: "gambling", reason: "online casino" },
  "au-internet-pokies": { category: "gambling", reason: "online pokies" },
  "payid-pokies": { category: "gambling", reason: "online pokies" },
  "kajino-com": { category: "gambling", reason: "online casino" },
  "parimatch": { category: "gambling", reason: "sportsbook / casino" },
  "1win": { category: "gambling", reason: "online casino / sportsbook" },
  "banzaibet": { category: "gambling", reason: "online casino" },
  "betbry": { category: "gambling", reason: "online betting" },
  "plinko-game": { category: "gambling", reason: "plinko gambling game" },
  "https-chicken-roadd-com": { category: "gambling", reason: "crash gambling game" },
  "fortune-tiger": { category: "gambling", reason: "slot gambling game" },
  "bdg-game": { category: "gambling", reason: "colour prediction gambling app" },
  "tiranga-game": { category: "gambling", reason: "colour prediction gambling app" },
  "daman-game": { category: "gambling", reason: "colour prediction gambling app" },
  "daman-game-login": { category: "gambling", reason: "colour prediction gambling app" },
  "ok-win": { category: "gambling", reason: "colour prediction gambling app" },
  // fake-engagement
  "socialboosting": { category: "fake-engagement", reason: "sells followers / likes" },
  "famoid": { category: "fake-engagement", reason: "sells followers / likes" },
  "blastup": { category: "fake-engagement", reason: "sells followers / likes" },
  "stormlikes": { category: "fake-engagement", reason: "sells followers / likes" },
  "buy-fans": { category: "fake-engagement", reason: "sells followers / likes" },
  "media-mister": { category: "fake-engagement", reason: "sells followers / likes" },
  "buy-youtube-subscribers-media-mister": { category: "fake-engagement", reason: "sells YouTube subscribers" },
  "buzzvoice-com": { category: "fake-engagement", reason: "sells followers / likes" },
  "instant-famous": { category: "fake-engagement", reason: "sells followers / likes" },
  "upgrow": { category: "fake-engagement", reason: "sells Instagram growth" },
  "sidesmedia": { category: "fake-engagement", reason: "sells followers / subscribers" },
  "want-to-boost-your-channel-on-youtube-buy-youtube-subscribers-from-sidesmedia-watch-your-subs-grow": { category: "fake-engagement", reason: "sells YouTube subscribers" },
  "buy-youtube-subscribers": { category: "fake-engagement", reason: "sells YouTube subscribers" },
  "buy-twitter-followers": { category: "fake-engagement", reason: "sells X followers" },
  "buy-twitter-followers-visit-twesocial": { category: "fake-engagement", reason: "sells X followers" },
  "buy-x-twitter-followers-from-bulkoid": { category: "fake-engagement", reason: "sells X followers" },
  "bulkoid": { category: "fake-engagement", reason: "sells followers / likes" },
  "socialdawn": { category: "fake-engagement", reason: "sells followers / likes" },
  "crescitaly": { category: "fake-engagement", reason: "SMM panel" },
  "smm-panel": { category: "fake-engagement", reason: "SMM panel" },
  "my-social-following-is-the-1-source-for-social-media-advertising-on-all-social-networks-instagram-youtube-tiktok-facebook-twitter-x-and-spotify-join-our-500-000-clients-who-have-been-with-us-since-2007": { category: "fake-engagement", reason: "sells followers / likes" },
  "bulkviews": { category: "fake-engagement", reason: "sells YouTube views" },
  "volgersboost": { category: "fake-engagement", reason: "sells followers (NL)" },
  "fameviso-buy-real-followers-and-likes": { category: "fake-engagement", reason: "sells followers / likes" },
  "fameviso-buy-real-followers-likes-views": { category: "fake-engagement", reason: "sells followers / likes" },
  "fameviso-monthly-auto-likes-automated-instagram-engagement": { category: "fake-engagement", reason: "sells automated likes" },
  "purchase-facebook-likes": { category: "fake-engagement", reason: "sells Facebook likes" },
  "buy-facebook-followers": { category: "fake-engagement", reason: "sells Facebook followers" },
  // fake-reviews
  "buy-google-reviews": { category: "fake-reviews", reason: "sells Google reviews" },
  "fameviso-buy-google-reviews-safely": { category: "fake-reviews", reason: "sells Google reviews" },
  "reviewcart": { category: "fake-reviews", reason: "sells reviews" },
  // fake-traffic
  "real-targeted-traffic": { category: "fake-traffic", reason: "sells website traffic" },
  "targeted-web-traffic": { category: "fake-traffic", reason: "sells website traffic" },
  "targetedvisitors": { category: "fake-traffic", reason: "sells website traffic" },
  "targeted-website-traffic": { category: "fake-traffic", reason: "sells website traffic" },
  "targeted-organic-traffic": { category: "fake-traffic", reason: "sells website traffic" },
  "twt-s": { category: "fake-traffic", reason: "sells website traffic" },
  "t-v-services": { category: "fake-traffic", reason: "sells website traffic" },
  "seowebsitetraffic-net": { category: "fake-traffic", reason: "sells website traffic" },
  // link-spam
  "backlink-bento": { category: "link-spam", reason: "sells backlinks" },
  "black-hat-webmasters": { category: "link-spam", reason: "black-hat SEO forum" },
  // piracy
  "fire-stick-tricks": { category: "piracy", reason: "Fire TV Stick sideloading / IPTV guides" },
  "fire-stick-how": { category: "piracy", reason: "Fire TV Stick sideloading / IPTV guides" },
  "piratebay": { category: "piracy", reason: "Pirate Bay proxy" },
  // adult
  "john-s-directory": { category: "adult", reason: "adult directory" },
};

export function isSpamDenylisted(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(SPAM_DENYLIST, slug);
}
