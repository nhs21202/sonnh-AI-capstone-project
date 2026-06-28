package shopify

import "testing"

// ShopIsValid guards against open-redirect / SSRF: only real *.myshopify.com shop domains pass.
func TestShopIsValid(t *testing.T) {
	valid := []string{
		"acme.myshopify.com",
		"ACME.myshopify.com", // case-insensitive
		"sonnh-dev-store-3.myshopify.com",
	}
	invalid := []string{
		"evil.com",
		"acme.myshopify.com.evil.com", // suffix smuggling
		"foo.bar.myshopify.com",       // multi-label
		"-acme.myshopify.com",         // leading hyphen
		"acme.myshopify.io",
		"",
	}
	for _, s := range valid {
		if !ShopIsValid(s) {
			t.Errorf("ShopIsValid(%q) = false, want true", s)
		}
	}
	for _, s := range invalid {
		if ShopIsValid(s) {
			t.Errorf("ShopIsValid(%q) = true, want false", s)
		}
	}
}
