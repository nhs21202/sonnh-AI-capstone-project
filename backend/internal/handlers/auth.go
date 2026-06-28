package handlers

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"net/url"

	"announcementbar/internal/config"
	"announcementbar/internal/shopify"

	"github.com/gofiber/fiber/v2"
)

const oauthStateCookie = "oauth_state"

// AuthInstall starts the OAuth install: validate the shop, set a short-lived CSRF state cookie,
// and redirect to Shopify's authorize screen with that state.
func AuthInstall(cfg config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		shop := c.Query("shop")
		if !shopify.ShopIsValid(shop) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "msg": "invalid shop", "data": nil})
		}
		nonce, err := randomNonce()
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "msg": "nonce error", "data": nil})
		}
		c.Cookie(&fiber.Cookie{
			Name:     oauthStateCookie,
			Value:    nonce,
			Path:     "/",
			MaxAge:   300,
			HTTPOnly: true,
			Secure:   true,
			SameSite: "Lax",
		})
		redirectURI := cfg.AppURL + "/auth/callback"
		authURL := shopify.AuthorizeURL(shop, cfg.ShopifyAPIKey, cfg.Scopes, redirectURI, nonce)
		return c.Redirect(authURL, fiber.StatusFound)
	}
}

// AuthCallback completes the install handshake: validate shop, verify HMAC, check the CSRF state
// (constant-time vs the cookie), exchange the code for an access token, then DISCARD it (stateless),
// and redirect into the embedded admin.
func AuthCallback(cfg config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		shop := c.Query("shop")
		if !shopify.ShopIsValid(shop) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "msg": "invalid shop", "data": nil})
		}
		if !shopify.VerifyHMAC(queryValues(c), cfg.ShopifyAPISecret) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": true, "msg": "invalid hmac", "data": nil})
		}
		// CSRF: the `state` query param must match the state cookie (constant-time).
		cookieState := c.Cookies(oauthStateCookie)
		queryState := c.Query("state")
		if cookieState == "" || subtle.ConstantTimeCompare([]byte(cookieState), []byte(queryState)) != 1 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "msg": "invalid state", "data": nil})
		}
		c.ClearCookie(oauthStateCookie)

		code := c.Query("code")
		if code == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "msg": "missing code", "data": nil})
		}
		// Complete the handshake, then DISCARD the token (no shop/session/token table).
		if _, err := shopify.ExchangeCodeForToken(shop, cfg.ShopifyAPIKey, cfg.ShopifyAPISecret, code); err != nil {
			return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": true, "msg": "token exchange failed", "data": nil})
		}
		return c.Redirect("https://"+shop+"/admin/apps/"+cfg.ShopifyAPIKey, fiber.StatusFound)
	}
}

// randomNonce returns a 128-bit hex-encoded CSRF nonce.
func randomNonce() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// queryValues converts Fiber's query args into url.Values for HMAC verification.
func queryValues(c *fiber.Ctx) url.Values {
	v := url.Values{}
	c.Context().QueryArgs().VisitAll(func(k, val []byte) {
		v.Set(string(k), string(val))
	})
	return v
}
