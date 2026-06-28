package shopify

import "regexp"

// shopPattern matches a single-label Shopify shop domain (case-insensitive). The anchors prevent
// suffix smuggling like "acme.myshopify.com.evil.com".
var shopPattern = regexp.MustCompile(`(?i)^[a-z0-9][a-z0-9-]*\.myshopify\.com$`)

// ShopIsValid reports whether shop is a legitimate *.myshopify.com domain. Always validate the
// shop before redirecting to it or building a request URL from it (open-redirect / SSRF guard).
func ShopIsValid(shop string) bool {
	return shopPattern.MatchString(shop)
}
