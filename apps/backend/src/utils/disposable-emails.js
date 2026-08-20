/**
 * Curated list of known temporary, burner, and disposable email domains.
 * Used to block automated fake registrations and spam accounts when the
 * `blockDisposableEmails` feature toggle is enabled.
 */

const DISPOSABLE_DOMAINS = new Set([
  // Popular burner & 10-minute mail services
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "10minutemail.co.uk",
  "10minutemail.be",
  "10minmail.com",
  "20minutemail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmail.com",
  "tempmail.net",
  "tempmail.de",
  "tempmailaddress.com",
  "tempail.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.org",
  "guerrillamail.net",
  "guerrillamail.de",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "spam4.me",
  "mailinator.com",
  "mailinator.net",
  "mailinator2.com",
  "mailin8r.com",
  "suremail.info",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "cool.fr.nf",
  "jetable.fr.nf",
  "nospam.ze.tc",
  "nomail.xl.cx",
  "mega.zik.dj",
  "speed.1s.fr",
  "courriel.fr.nf",
  "moncourrier.fr.nf",
  "monemail.fr.nf",
  "monmail.fr.nf",
  "trashmail.com",
  "trashmail.net",
  "trashmail.org",
  "trashmail.me",
  "trashmail.at",
  "trashmail.io",
  "dispostable.com",
  "throwawaymail.com",
  "getairmail.com",
  "airmail.news",
  "inboxkitten.com",
  "burnermail.io",
  "fakeinbox.com",
  "mytemp.email",
  "mailnesia.com",
  "dropmail.me",
  "getnada.com",
  "abcn.ws",
  "givmail.com",
  "inboxbear.com",
  "mohmal.com",
  "mohmal.im",
  "mohmal.in",
  "crazymailing.com",
  "fakemailgenerator.com",
  "emailondeck.com",
  "maildrop.cc",
  "harakirimail.com",
  "discard.email",
  "discardmail.com",
  "spambog.com",
  "spambog.de",
  "spambog.ru",
  "spaml.de",
  "emailfake.com",
  "generator.email",
  "generator-email.com",
  "generator.email.com",
  "mytrashmail.com",
  "mintemail.com",
  "nada.ltd",
  "nada.email",
  "getairmail.cf",
  "getairmail.gq",
  "getairmail.ga",
  "getairmail.ml",
  "getairmail.tk",
  "yopmail.org",
  "yopmail.tk",
  "temp-mail.ru",
  "binkmail.com",
  "bobmail.info",
  "chammy.info",
  "devnullmail.com",
  "letthemeatspam.com",
  "mailinater.com",
  "safetymail.info",
  "tradermail.info",
  "zippymail.info",
  "spamgourmet.com",
  "hidemyass.com",
  "hmamail.com",
  "zoemail.org",
  "trashymail.com",
  "tempr.email",
  "throwaway.email",
  "fakemail.net",
  "tmail.ws",
  "vmani.com",
  "wuzup.net",
  "wuzupmail.net",
  "byom.de",
  "trashmail.ws",
  "trashymail.net",
  "disposable.com",
  "disposablemail.com",
  "disposableinbox.com",
  "trash-mail.com",
  "throwawayemailaddresses.com",
  "temporaryemail.net",
  "temporarymail.com",
  "burneremail.net",
  "10minutemailbox.com",
  "fake-box.com",
  "burner-email.com",
  "trashmail.club",
  "mailhero.io",
  "inboxproxy.com",
  "anonaddy.me",
  "duck.com", // Masked relay, not permanent account
]);

/**
 * Checks if a given email address belongs to a known temporary/disposable domain.
 * @param {string} email
 * @returns {boolean}
 */
export function isDisposableEmail(email) {
  if (!email || typeof email !== "string") return false;
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1].trim();
  if (!domain) return false;

  // Direct domain match
  if (DISPOSABLE_DOMAINS.has(domain)) return true;

  // Subdomain match (e.g. `sub.mailinator.com` -> `mailinator.com`)
  const domainParts = domain.split(".");
  if (domainParts.length > 2) {
    const parentDomain = domainParts.slice(-2).join(".");
    if (DISPOSABLE_DOMAINS.has(parentDomain)) return true;
  }

  return false;
}

export { DISPOSABLE_DOMAINS };
