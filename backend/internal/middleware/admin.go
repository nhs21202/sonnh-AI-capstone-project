package middleware

import (
	"strings"

	"announcementbar/internal/config"
	"announcementbar/internal/shopify"

	"github.com/gofiber/fiber/v2"
)

// AdminAuth verifies the App Bridge session token and enforces anti-IDOR: the shop derived from the
// token's `dest` claim (decoded in ALL modes, dev included) MUST equal the :shop path param, else
// 403. Never trust the path/query param for identity.
func AdminAuth(cfg config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Get("Authorization")
		tok := strings.TrimPrefix(auth, "Bearer ")
		if auth == "" || tok == auth {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": true, "msg": "missing session token", "data": nil})
		}
		shop, err := shopify.ShopFromSessionToken(tok, cfg.ShopifyAPISecret)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": true, "msg": "invalid session token", "data": nil})
		}
		if shop != c.Params("shop") {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": true, "msg": "shop mismatch", "data": nil})
		}
		return c.Next()
	}
}
