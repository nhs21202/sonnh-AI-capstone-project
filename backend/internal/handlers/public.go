package handlers

import (
	"time"

	"announcementbar/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// publicBar is the storefront-facing view — display fields only (no id/shop/title/timestamps).
type publicBar struct {
	Message            string     `json:"message"`
	BackgroundColor    string     `json:"background_color"`
	TextColor          string     `json:"text_color"`
	CountdownEnabled   bool       `json:"countdown_enabled"`
	CountdownEndAt     *time.Time `json:"countdown_end_at"`
	CountdownBgColor   string     `json:"countdown_bg_color"`
	CountdownTextColor string     `json:"countdown_text_color"`
	CountdownFormat    string     `json:"countdown_format"`
}

// PublicBar serves the shop's single active, renderable bar (or null). No auth; CORS is set at the
// route. Server-side gate: enabled AND (no countdown OR countdown still in the future).
func PublicBar(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		shop := c.Query("shop")
		if shop == "" {
			return c.Status(fiber.StatusBadRequest).JSON(errEnvelope("missing shop"))
		}
		var bar models.AnnouncementBar
		if err := db.Where("shop = ? AND enabled = ?", shop, true).First(&bar).Error; err != nil {
			return c.JSON(okEnvelope(nil)) // no enabled bar -> nothing renders
		}
		if bar.CountdownEnabled && bar.CountdownEndAt != nil && !bar.CountdownEndAt.After(time.Now()) {
			return c.JSON(okEnvelope(nil)) // already expired -> nothing ships
		}
		return c.JSON(okEnvelope(publicBar{
			Message:            bar.Message,
			BackgroundColor:    bar.BackgroundColor,
			TextColor:          bar.TextColor,
			CountdownEnabled:   bar.CountdownEnabled,
			CountdownEndAt:     bar.CountdownEndAt,
			CountdownBgColor:   bar.CountdownBgColor,
			CountdownTextColor: bar.CountdownTextColor,
			CountdownFormat:    bar.CountdownFormat,
		}))
	}
}
