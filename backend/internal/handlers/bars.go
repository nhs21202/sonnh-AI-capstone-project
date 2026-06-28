package handlers

import (
	"announcementbar/internal/models"
	"announcementbar/internal/validate"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func okEnvelope(data interface{}) fiber.Map { return fiber.Map{"error": false, "msg": "success", "data": data} }
func errEnvelope(msg string) fiber.Map      { return fiber.Map{"error": true, "msg": msg, "data": nil} }

// ListBars returns the shop's bars, newest first (empty array if none).
func ListBars(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		bars := []models.AnnouncementBar{}
		if err := db.Where("shop = ?", c.Params("shop")).Order("created_at DESC").Find(&bars).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(errEnvelope("db error"))
		}
		return c.JSON(okEnvelope(bars))
	}
}

// CreateBar creates a bar (new bars default disabled); if it is enabled, the one-active invariant
// disables every other bar of the shop in the same transaction.
func CreateBar(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		shop := c.Params("shop")
		var bar models.AnnouncementBar
		if err := c.BodyParser(&bar); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(errEnvelope("invalid body"))
		}
		bar.ID = 0
		bar.Shop = shop
		if err := validate.Bar(&bar); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(errEnvelope(err.Error()))
		}
		if err := db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(&bar).Error; err != nil {
				return err
			}
			return enforceOneActive(tx, shop, bar.ID, bar.Enabled)
		}); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(errEnvelope("db error"))
		}
		return c.Status(fiber.StatusCreated).JSON(okEnvelope(bar))
	}
}

// UpdateBar updates a bar; 404 if it is not this shop's. Enabling it disables the others.
func UpdateBar(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		shop := c.Params("shop")
		var existing models.AnnouncementBar
		if err := db.Where("id = ? AND shop = ?", c.Params("id"), shop).First(&existing).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(errEnvelope("not found"))
		}
		var input models.AnnouncementBar
		if err := c.BodyParser(&input); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(errEnvelope("invalid body"))
		}
		input.ID = existing.ID
		input.Shop = shop
		input.CreatedAt = existing.CreatedAt
		if err := validate.Bar(&input); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(errEnvelope(err.Error()))
		}
		if err := db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Save(&input).Error; err != nil {
				return err
			}
			return enforceOneActive(tx, shop, input.ID, input.Enabled)
		}); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(errEnvelope("db error"))
		}
		return c.JSON(okEnvelope(input))
	}
}

// DeleteBar deletes a bar; 404 if it is not this shop's. Deleting the active bar simply leaves none.
func DeleteBar(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		res := db.Where("id = ? AND shop = ?", c.Params("id"), c.Params("shop")).Delete(&models.AnnouncementBar{})
		if res.Error != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(errEnvelope("db error"))
		}
		if res.RowsAffected == 0 {
			return c.Status(fiber.StatusNotFound).JSON(errEnvelope("not found"))
		}
		return c.JSON(okEnvelope(nil))
	}
}

// enforceOneActive: when a bar is enabled, set enabled=false on all OTHER bars of the shop.
func enforceOneActive(tx *gorm.DB, shop string, id uint, enabled bool) error {
	if !enabled {
		return nil
	}
	return tx.Model(&models.AnnouncementBar{}).
		Where("shop = ? AND id <> ?", shop, id).
		Update("enabled", false).Error
}
