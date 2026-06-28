package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http/httptest"
	"strconv"
	"testing"

	"announcementbar/internal/config"
	"announcementbar/internal/database"
	"announcementbar/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

const testShop = "test-feat003.myshopify.com"

func testApp(t *testing.T) (*fiber.App, *gorm.DB) {
	t.Helper()
	db, err := database.Connect(config.Load())
	if err != nil {
		t.Fatalf("Connect: %v (run via bash init.sh)", err)
	}
	if err := database.Migrate(db); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	db.Where("shop = ?", testShop).Delete(&models.AnnouncementBar{})
	t.Cleanup(func() { db.Where("shop = ?", testShop).Delete(&models.AnnouncementBar{}) })

	app := fiber.New()
	app.Get("/api/v1/announcement-bars/:shop", ListBars(db))
	app.Post("/api/v1/announcement-bars/:shop", CreateBar(db))
	app.Put("/api/v1/announcement-bars/:shop/:id", UpdateBar(db))
	app.Delete("/api/v1/announcement-bars/:shop/:id", DeleteBar(db))
	return app, db
}

func do(t *testing.T, app *fiber.App, method, url, body string) (int, map[string]any) {
	t.Helper()
	req := httptest.NewRequest(method, url, bytes.NewBufferString(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("%s %s: %v", method, url, err)
	}
	b, _ := io.ReadAll(resp.Body)
	var env map[string]any
	_ = json.Unmarshal(b, &env)
	return resp.StatusCode, env
}

func validBar(title string, enabled bool) string {
	return `{"title":"` + title + `","enabled":` + boolStr(enabled) + `,"message":"Hello",` +
		`"background_color":"#1A1A1A","text_color":"#FFFFFF",` +
		`"countdown_bg_color":"#000000","countdown_text_color":"#FFFFFF","countdown_enabled":false}`
}
func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
func itoa(id uint) string { return strconv.FormatUint(uint64(id), 10) }

func TestBarsCRUDRoundTrip(t *testing.T) {
	if testing.Short() {
		t.Skip("DB integration")
	}
	app, db := testApp(t)
	base := "/api/v1/announcement-bars/" + testShop

	// create -> 201
	st, env := do(t, app, "POST", base, validBar("First", false))
	if st != 201 {
		t.Fatalf("create status = %d, want 201 (env=%v)", st, env)
	}
	// list -> 1 row
	st, env = do(t, app, "GET", base, "")
	if st != 200 {
		t.Fatalf("list status = %d", st)
	}
	if arr, _ := env["data"].([]any); len(arr) != 1 {
		t.Fatalf("list len = %d, want 1", len(arr))
	}
	// fetch the id
	var bar models.AnnouncementBar
	db.Where("shop = ?", testShop).First(&bar)
	idStr := itoa(bar.ID)

	// update -> 200
	st, _ = do(t, app, "PUT", base+"/"+idStr, validBar("Renamed", false))
	if st != 200 {
		t.Fatalf("update status = %d, want 200", st)
	}
	// delete -> 200
	st, _ = do(t, app, "DELETE", base+"/"+idStr, "")
	if st != 200 {
		t.Fatalf("delete status = %d, want 200", st)
	}
}

func TestEnablingOneDisablesOthers(t *testing.T) {
	if testing.Short() {
		t.Skip("DB integration")
	}
	app, db := testApp(t)
	base := "/api/v1/announcement-bars/" + testShop

	do(t, app, "POST", base, validBar("A", true))
	do(t, app, "POST", base, validBar("B", true)) // enabling B must disable A

	var enabledCount int64
	db.Model(&models.AnnouncementBar{}).Where("shop = ? AND enabled = ?", testShop, true).Count(&enabledCount)
	if enabledCount != 1 {
		t.Fatalf("enabled bars = %d, want exactly 1 (one-active invariant)", enabledCount)
	}
}

func TestForeignIDReturns404(t *testing.T) {
	if testing.Short() {
		t.Skip("DB integration")
	}
	app, _ := testApp(t)
	base := "/api/v1/announcement-bars/" + testShop
	st, _ := do(t, app, "DELETE", base+"/999999", "")
	if st != 404 {
		t.Fatalf("delete foreign id status = %d, want 404", st)
	}
	st, _ = do(t, app, "PUT", base+"/999999", validBar("X", false))
	if st != 404 {
		t.Fatalf("update foreign id status = %d, want 404", st)
	}
}

func TestInvalidBodyReturns400(t *testing.T) {
	if testing.Short() {
		t.Skip("DB integration")
	}
	app, _ := testApp(t)
	base := "/api/v1/announcement-bars/" + testShop
	// missing title
	st, _ := do(t, app, "POST", base, `{"enabled":false,"background_color":"#1A1A1A","text_color":"#FFFFFF","countdown_bg_color":"#000000","countdown_text_color":"#FFFFFF"}`)
	if st != 400 {
		t.Fatalf("missing title status = %d, want 400", st)
	}
	// bad hex
	st, _ = do(t, app, "POST", base, `{"title":"X","background_color":"red","text_color":"#FFFFFF","countdown_bg_color":"#000000","countdown_text_color":"#FFFFFF"}`)
	if st != 400 {
		t.Fatalf("bad hex status = %d, want 400", st)
	}
}
