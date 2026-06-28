package middleware

import (
	"net/http/httptest"
	"testing"
	"time"

	"announcementbar/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func token(t *testing.T, secret, dest string) string {
	t.Helper()
	s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"dest": dest,
		"exp":  time.Now().Add(time.Minute).Unix(),
	}).SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return s
}

func appWith(cfg config.Config) *fiber.App {
	app := fiber.New()
	app.Get("/api/v1/announcement-bars/:shop", AdminAuth(cfg), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})
	return app
}

func TestAdminAuthAllowsMatchingShop(t *testing.T) {
	app := appWith(config.Config{ShopifyAPISecret: "secret"})
	req := httptest.NewRequest("GET", "/api/v1/announcement-bars/demo.myshopify.com", nil)
	req.Header.Set("Authorization", "Bearer "+token(t, "secret", "https://demo.myshopify.com"))
	resp, _ := app.Test(req)
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
}

func TestAdminAuthRejectsShopMismatch(t *testing.T) {
	app := appWith(config.Config{ShopifyAPISecret: "secret"})
	// Token dest is demo, but the path shop is evil -> 403 (anti-IDOR; never trust the path param).
	req := httptest.NewRequest("GET", "/api/v1/announcement-bars/evil.myshopify.com", nil)
	req.Header.Set("Authorization", "Bearer "+token(t, "secret", "https://demo.myshopify.com"))
	resp, _ := app.Test(req)
	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("status = %d, want 403", resp.StatusCode)
	}
}

func TestAdminAuthRejectsMissingToken(t *testing.T) {
	app := appWith(config.Config{ShopifyAPISecret: "secret"})
	resp, _ := app.Test(httptest.NewRequest("GET", "/api/v1/announcement-bars/demo.myshopify.com", nil))
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}
