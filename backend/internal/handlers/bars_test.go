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

// seedBar inserts a bar directly (bypassing the one-active invariant) so read-path tests can
// control exactly which rows and statuses exist.
func seedBar(t *testing.T, db *gorm.DB, title string, enabled bool, message string) {
	t.Helper()
	b := models.AnnouncementBar{
		Shop: testShop, Title: title, Enabled: enabled, Message: message,
		BackgroundColor: "#1A1A1A", TextColor: "#FFFFFF",
		CountdownBgColor: "#000000", CountdownTextColor: "#FFFFFF", CountdownFormat: "dd:hh:mm:ss",
	}
	if err := db.Create(&b).Error; err != nil {
		t.Fatalf("seedBar(%q): %v", title, err)
	}
}

// metaInt reads env["meta"][key] as an int (JSON numbers decode to float64).
func metaInt(t *testing.T, env map[string]any, key string) int {
	t.Helper()
	m, ok := env["meta"].(map[string]any)
	if !ok {
		t.Fatalf("response has no meta object: %v", env)
	}
	f, ok := m[key].(float64)
	if !ok {
		t.Fatalf("meta.%s missing or not a number: %v", key, m)
	}
	return int(f)
}

func dataLen(env map[string]any) int {
	arr, _ := env["data"].([]any)
	return len(arr)
}

func TestListBarsSearchMatchesTitleOrMessage(t *testing.T) {
	if testing.Short() {
		t.Skip("DB integration")
	}
	app, db := testApp(t)
	base := "/api/v1/announcement-bars/" + testShop
	seedBar(t, db, "Summer Sale", true, "Big discounts")
	seedBar(t, db, "Winter Clearance", false, "Cold deals")
	seedBar(t, db, "Spring Promo", false, "Flowers and sale") // matches via message

	st, env := do(t, app, "GET", base+"?q=sale", "")
	if st != 200 {
		t.Fatalf("status = %d (env=%v)", st, env)
	}
	if n := dataLen(env); n != 2 {
		t.Fatalf("q=sale returned %d rows, want 2 (title 'Summer Sale' + message '...sale')", n)
	}
	if got := metaInt(t, env, "total"); got != 2 {
		t.Fatalf("meta.total = %d, want 2", got)
	}
}

func TestListBarsStatusFilter(t *testing.T) {
	if testing.Short() {
		t.Skip("DB integration")
	}
	app, db := testApp(t)
	base := "/api/v1/announcement-bars/" + testShop
	seedBar(t, db, "Active One", true, "x")
	seedBar(t, db, "Draft One", false, "x")
	seedBar(t, db, "Draft Two", false, "x")

	if _, env := do(t, app, "GET", base+"?status=active", ""); dataLen(env) != 1 {
		t.Fatalf("status=active returned %d, want 1", dataLen(env))
	}
	if _, env := do(t, app, "GET", base+"?status=draft", ""); dataLen(env) != 2 {
		t.Fatalf("status=draft returned %d, want 2", dataLen(env))
	}
}

func TestListBarsSortTitleDesc(t *testing.T) {
	if testing.Short() {
		t.Skip("DB integration")
	}
	app, db := testApp(t)
	base := "/api/v1/announcement-bars/" + testShop
	seedBar(t, db, "Apple", false, "x")
	seedBar(t, db, "Mango", false, "x")
	seedBar(t, db, "Banana", false, "x")

	_, env := do(t, app, "GET", base+"?sort=title%20desc", "")
	arr, _ := env["data"].([]any)
	if len(arr) != 3 {
		t.Fatalf("got %d rows, want 3", len(arr))
	}
	first, _ := arr[0].(map[string]any)
	if first["title"] != "Mango" {
		t.Fatalf("sort=title desc first title = %v, want Mango", first["title"])
	}
}

func TestListBarsPaginationMeta(t *testing.T) {
	if testing.Short() {
		t.Skip("DB integration")
	}
	app, db := testApp(t)
	base := "/api/v1/announcement-bars/" + testShop
	for _, name := range []string{"b1", "b2", "b3", "b4", "b5"} {
		seedBar(t, db, name, false, "x")
	}

	_, env := do(t, app, "GET", base+"?page=1&page_size=2", "")
	if n := dataLen(env); n != 2 {
		t.Fatalf("page_size=2 returned %d rows, want 2", n)
	}
	if got := metaInt(t, env, "total"); got != 5 {
		t.Fatalf("meta.total = %d, want 5", got)
	}
	if got := metaInt(t, env, "total_pages"); got != 3 {
		t.Fatalf("meta.total_pages = %d, want 3 (ceil(5/2))", got)
	}
	if got := metaInt(t, env, "page"); got != 1 {
		t.Fatalf("meta.page = %d, want 1", got)
	}
	if got := metaInt(t, env, "page_size"); got != 2 {
		t.Fatalf("meta.page_size = %d, want 2", got)
	}
}

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
