package shopify

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func signSessionToken(t *testing.T, secret, dest string) string {
	t.Helper()
	claims := jwt.MapClaims{
		"dest": dest,
		"exp":  time.Now().Add(time.Minute).Unix(),
		"nbf":  time.Now().Add(-time.Minute).Unix(),
	}
	s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return s
}

func TestShopFromSessionToken(t *testing.T) {
	secret := "app_secret"
	token := signSessionToken(t, secret, "https://demo.myshopify.com")

	shop, err := ShopFromSessionToken(token, secret)
	if err != nil {
		t.Fatalf("ShopFromSessionToken: %v", err)
	}
	if shop != "demo.myshopify.com" {
		t.Errorf("shop = %q, want demo.myshopify.com", shop)
	}

	// A token signed with a different secret must be rejected (never trust an unverified token).
	if _, err := ShopFromSessionToken(token, "wrong_secret"); err == nil {
		t.Error("expected error for wrong secret, got nil")
	}
}
