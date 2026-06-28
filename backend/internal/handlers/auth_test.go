package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"announcementbar/internal/config"

	"github.com/gofiber/fiber/v2"
)

func TestAuthInstallRedirectsToShopify(t *testing.T) {
	cfg := config.Config{ShopifyAPIKey: "key123", Scopes: "write_themes", AppURL: "https://app.example"}
	app := fiber.New()
	app.Get("/auth", AuthInstall(cfg))

	resp, err := app.Test(httptest.NewRequest("GET", "/auth?shop=demo.myshopify.com", nil))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusFound {
		t.Fatalf("status = %d, want 302", resp.StatusCode)
	}
	loc := resp.Header.Get("Location")
	if !strings.Contains(loc, "demo.myshopify.com/admin/oauth/authorize") || !strings.Contains(loc, "client_id=key123") {
		t.Errorf("redirect Location = %q", loc)
	}
}

// Open-redirect/SSRF guard: an invalid shop is rejected before any redirect.
func TestAuthInstallRejectsInvalidShop(t *testing.T) {
	cfg := config.Config{ShopifyAPIKey: "key123", AppURL: "https://app.example"}
	app := fiber.New()
	app.Get("/auth", AuthInstall(cfg))

	resp, err := app.Test(httptest.NewRequest("GET", "/auth?shop=evil.com", nil))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (invalid shop)", resp.StatusCode)
	}
}

// Security gate: a callback with an invalid HMAC must be rejected (no token exchange).
func TestAuthCallbackRejectsBadHMAC(t *testing.T) {
	cfg := config.Config{ShopifyAPISecret: "secret"}
	app := fiber.New()
	app.Get("/auth/callback", AuthCallback(cfg))

	resp, err := app.Test(httptest.NewRequest("GET", "/auth/callback?shop=demo.myshopify.com&code=abc&hmac=deadbeef", nil))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

// Open-redirect/SSRF guard on the callback: invalid shop rejected before use.
func TestAuthCallbackRejectsInvalidShop(t *testing.T) {
	cfg := config.Config{ShopifyAPISecret: "secret"}
	app := fiber.New()
	app.Get("/auth/callback", AuthCallback(cfg))

	resp, err := app.Test(httptest.NewRequest("GET", "/auth/callback?shop=acme.myshopify.com.evil.com&code=abc&hmac=x", nil))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (invalid shop)", resp.StatusCode)
	}
}

// CSRF: a callback whose state query param does not match the state cookie is rejected.
func TestAuthCallbackRejectsStateMismatch(t *testing.T) {
	cfg := config.Config{ShopifyAPISecret: "secret"}
	app := fiber.New()
	app.Get("/auth/callback", AuthCallback(cfg))

	params := url.Values{}
	params.Set("shop", "demo.myshopify.com")
	params.Set("code", "abc")
	params.Set("state", "query-state")
	params.Set("timestamp", "1700000000")
	msg := "code=abc&shop=demo.myshopify.com&state=query-state&timestamp=1700000000"
	mac := hmac.New(sha256.New, []byte("secret"))
	mac.Write([]byte(msg))
	params.Set("hmac", hex.EncodeToString(mac.Sum(nil)))

	req := httptest.NewRequest("GET", "/auth/callback?"+params.Encode(), nil)
	req.AddCookie(&http.Cookie{Name: "oauth_state", Value: "different-state"})

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (state mismatch)", resp.StatusCode)
	}
}
