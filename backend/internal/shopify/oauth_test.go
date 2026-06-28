package shopify

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"strings"
	"testing"
)

func TestAuthorizeURL(t *testing.T) {
	got := AuthorizeURL("demo.myshopify.com", "key123", "write_themes", "https://app.example/auth/callback", "nonce")
	for _, want := range []string{
		"https://demo.myshopify.com/admin/oauth/authorize?",
		"client_id=key123",
		"scope=write_themes",
		"state=nonce",
		"redirect_uri=https%3A%2F%2Fapp.example%2Fauth%2Fcallback",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("AuthorizeURL missing %q in %q", want, got)
		}
	}
}

func TestVerifyHMAC(t *testing.T) {
	secret := "shhh"
	params := url.Values{}
	params.Set("code", "abc")
	params.Set("shop", "demo.myshopify.com")
	params.Set("state", "nonce")
	params.Set("timestamp", "1700000000")

	// Reference HMAC over the sorted, &-joined message (independent of the implementation).
	msg := "code=abc&shop=demo.myshopify.com&state=nonce&timestamp=1700000000"
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(msg))
	params.Set("hmac", hex.EncodeToString(mac.Sum(nil)))

	if !VerifyHMAC(params, secret) {
		t.Error("VerifyHMAC rejected a valid signature")
	}

	// Tampering with a signed param must invalidate it.
	params.Set("shop", "evil.myshopify.com")
	if VerifyHMAC(params, secret) {
		t.Error("VerifyHMAC accepted a tampered signature")
	}
}
