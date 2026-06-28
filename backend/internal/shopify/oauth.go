package shopify

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"net/url"
	"sort"
	"strings"
)

// AuthorizeURL builds the Shopify OAuth authorize URL that starts the app install.
func AuthorizeURL(shop, apiKey, scopes, redirectURI, state string) string {
	q := url.Values{}
	q.Set("client_id", apiKey)
	q.Set("scope", scopes)
	q.Set("redirect_uri", redirectURI)
	q.Set("state", state)
	return "https://" + shop + "/admin/oauth/authorize?" + q.Encode()
}

// VerifyHMAC validates the HMAC of a Shopify OAuth callback per Shopify's spec: drop `hmac`
// (and legacy `signature`), sort the remaining params, join as "k=v&k=v", HMAC-SHA256 with the
// app secret, and compare (constant-time) to the supplied hmac hex.
func VerifyHMAC(params url.Values, secret string) bool {
	given := params.Get("hmac")
	if given == "" {
		return false
	}

	keys := make([]string, 0, len(params))
	for k := range params {
		if k == "hmac" || k == "signature" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var b strings.Builder
	for i, k := range keys {
		if i > 0 {
			b.WriteByte('&')
		}
		b.WriteString(k)
		b.WriteByte('=')
		b.WriteString(params.Get(k))
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(b.String()))
	expected := hex.EncodeToString(mac.Sum(nil))

	return subtle.ConstantTimeCompare([]byte(expected), []byte(given)) == 1
}
