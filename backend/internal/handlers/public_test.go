package handlers

import (
	"net/http/httptest"
	"testing"
	"time"

	"announcementbar/internal/config"
	"announcementbar/internal/database"
	"announcementbar/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

const pubShop = "test-feat004.myshopify.com"
const otherShop = "test-feat004-other.myshopify.com"

func pubApp(t *testing.T) (*fiber.App, *gorm.DB) {
	t.Helper()
	db, err := database.Connect(config.Load())
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	database.Migrate(db)
	db.Where("shop IN ?", []string{pubShop, otherShop}).Delete(&models.AnnouncementBar{})
	t.Cleanup(func() { db.Where("shop IN ?", []string{pubShop, otherShop}).Delete(&models.AnnouncementBar{}) })
	app := fiber.New()
	app.Get("/web/public/bar", PublicBar(db))
	return app, db
}

func base(shop string, enabled bool) models.AnnouncementBar {
	return models.AnnouncementBar{
		Shop: shop, Title: "secret-title", Enabled: enabled, Message: "Sale",
		BackgroundColor: "#1A1A1A", TextColor: "#FFFFFF",
		CountdownBgColor: "#000000", CountdownTextColor: "#FFFFFF",
	}
}

func TestPublicMissingShop400(t *testing.T) {
	if testing.Short() {
		t.Skip("DB")
	}
	app, _ := pubApp(t)
	resp, _ := app.Test(httptest.NewRequest("GET", "/web/public/bar", nil))
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestPublicNoEnabledBarNull(t *testing.T) {
	if testing.Short() {
		t.Skip("DB")
	}
	app, db := pubApp(t)
	db.Create(&[]models.AnnouncementBar{base(pubShop, false)}[0])
	st, env := do(t, app, "GET", "/web/public/bar?shop="+pubShop, "")
	if st != 200 || env["data"] != nil {
		t.Fatalf("want 200 + data null, got %d data=%v", st, env["data"])
	}
}

func TestPublicActivePayloadNoTitle(t *testing.T) {
	if testing.Short() {
		t.Skip("DB")
	}
	app, db := pubApp(t)
	b := base(pubShop, true)
	db.Create(&b)
	st, env := do(t, app, "GET", "/web/public/bar?shop="+pubShop, "")
	if st != 200 {
		t.Fatalf("status = %d", st)
	}
	data, _ := env["data"].(map[string]any)
	if data == nil {
		t.Fatalf("data nil, want payload")
	}
	if data["message"] != "Sale" {
		t.Errorf("message = %v", data["message"])
	}
	if _, leaked := data["title"]; leaked {
		t.Errorf("title leaked to the storefront payload")
	}
}

func TestPublicExpiredNull(t *testing.T) {
	if testing.Short() {
		t.Skip("DB")
	}
	app, db := pubApp(t)
	past := time.Now().Add(-time.Hour)
	b := base(pubShop, true)
	b.CountdownEnabled = true
	b.CountdownEndAt = &past
	db.Create(&b)
	_, env := do(t, app, "GET", "/web/public/bar?shop="+pubShop, "")
	if env["data"] != nil {
		t.Fatalf("expired: want data null, got %v", env["data"])
	}
}

func TestPublicShopIsolation(t *testing.T) {
	if testing.Short() {
		t.Skip("DB")
	}
	app, db := pubApp(t)
	b := base(pubShop, true)
	db.Create(&b)
	_, env := do(t, app, "GET", "/web/public/bar?shop="+otherShop, "")
	if env["data"] != nil {
		t.Fatalf("shop isolation: other shop must see null, got %v", env["data"])
	}
}
