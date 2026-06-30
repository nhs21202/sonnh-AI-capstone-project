package handlers

import (
	"strconv"
	"strings"

	"announcementbar/internal/models"
	"announcementbar/internal/validate"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func okEnvelope(data interface{}) fiber.Map { return fiber.Map{"error": false, "msg": "success", "data": data} }
func errEnvelope(msg string) fiber.Map      { return fiber.Map{"error": true, "msg": msg, "data": nil} }

const (
	defaultPageSize = 10
	maxPageSize     = 100
)

// escapeLike neutralizes LIKE wildcards in user input so a literal "%" or "_" can't widen the
// search (backslash is MySQL's default LIKE escape char).
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// atoiDefault parses s, falling back to def on any non-numeric/empty value.
func atoiDefault(s string, def int) int {
	if n, err := strconv.Atoi(s); err == nil {
		return n
	}
	return def
}

// sortClause maps a client "<field> <dir>" string to a safe ORDER BY. Only whitelisted fields and
// directions are ever interpolated — the raw sort param never reaches SQL (prevents injection).
// Bars without a countdown always sort last; ties break by title for a stable order.
func sortClause(sort string) string {
	parts := strings.Fields(sort)
	field, dir := "title", "asc"
	if len(parts) >= 1 {
		switch parts[0] {
		case "title", "status", "countdown":
			field = parts[0]
		}
	}
	if len(parts) >= 2 && parts[1] == "desc" {
		dir = "desc"
	}
	switch field {
	case "status":
		// "status asc" means active-first (enabled rows on top), so invert to enabled DESC.
		if dir == "asc" {
			return "enabled DESC, title ASC"
		}
		return "enabled ASC, title ASC"
	case "countdown":
		return "countdown_end_at IS NULL, countdown_end_at " + dir + ", title ASC"
	default:
		return "title " + dir
	}
}

// ListBars returns one page of the shop's bars after applying search (q), a status filter, and a
// whitelisted sort. The meta block carries the pagination state for the admin list UI.
func ListBars(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		shop := c.Params("shop")

		q := db.Model(&models.AnnouncementBar{}).Where("shop = ?", shop)
		if term := strings.TrimSpace(c.Query("q")); term != "" {
			like := "%" + escapeLike(term) + "%"
			q = q.Where("title LIKE ? OR message LIKE ?", like, like)
		}
		switch c.Query("status") {
		case "active":
			q = q.Where("enabled = ?", true)
		case "draft":
			q = q.Where("enabled = ?", false)
		}

		var total int64
		if err := q.Count(&total).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(errEnvelope("db error"))
		}

		page := atoiDefault(c.Query("page"), 1)
		if page < 1 {
			page = 1
		}
		pageSize := atoiDefault(c.Query("page_size"), defaultPageSize)
		if pageSize < 1 {
			pageSize = defaultPageSize
		}
		if pageSize > maxPageSize {
			pageSize = maxPageSize
		}
		totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
		if totalPages < 1 {
			totalPages = 1
		}

		bars := []models.AnnouncementBar{}
		if err := q.Order(sortClause(c.Query("sort"))).
			Limit(pageSize).Offset((page - 1) * pageSize).
			Find(&bars).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(errEnvelope("db error"))
		}

		return c.JSON(fiber.Map{
			"error": false, "msg": "success", "data": bars,
			"meta": fiber.Map{
				"total":       total,
				"page":        page,
				"page_size":   pageSize,
				"total_pages": totalPages,
			},
		})
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
