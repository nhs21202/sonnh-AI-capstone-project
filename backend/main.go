package main

import (
	"log"
	"os"
	"strings"

	"announcementbar/internal/config"
	"announcementbar/internal/database"
	"announcementbar/internal/handlers"
	"announcementbar/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
)

// Announcement Bar App backend: loads config, connects to MySQL, and serves the API.
func main() {
	// Load backend/.env if present; ignore the error so real environment variables still win.
	_ = godotenv.Load()

	cfg := config.Load()

	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("database connect failed: %v", err)
	}
	if err := database.Migrate(db); err != nil { // GORM AutoMigrate on boot (creates announcement_bars)
		log.Fatalf("auto-migrate failed: %v", err)
	}
	if sqlDB, err := db.DB(); err == nil {
		defer sqlDB.Close()
	}

	app := fiber.New(fiber.Config{AppName: "Announcement Bar App"})
	app.Get("/health", handlers.Health)
	app.Get("/auth", handlers.AuthInstall(cfg))                   // OAuth install start
	app.Get("/auth/callback", handlers.AuthCallback(cfg))         // OAuth callback (verify -> exchange -> discard)

	// Admin CRUD API (behind session-token auth + anti-IDOR).
	api := app.Group("/api/v1")
	api.Get("/announcement-bars/:shop", middleware.AdminAuth(cfg), handlers.ListBars(db))
	api.Post("/announcement-bars/:shop", middleware.AdminAuth(cfg), handlers.CreateBar(db))
	api.Put("/announcement-bars/:shop/:id", middleware.AdminAuth(cfg), handlers.UpdateBar(db))
	api.Delete("/announcement-bars/:shop/:id", middleware.AdminAuth(cfg), handlers.DeleteBar(db))

	// Public storefront endpoint (no auth, CORS *). CORS as path middleware so it also answers the
	// OPTIONS preflight (the storefront sends the custom ngrok-skip-browser-warning header).
	app.Use("/web/public", cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,OPTIONS",
		AllowHeaders: "ngrok-skip-browser-warning, Content-Type",
	}))
	app.Get("/web/public/bar", handlers.PublicBar(db))

	// Serve the built admin SPA. Registered LAST so it never shadows the API/auth/health routes.
	distDir := os.Getenv("FRONTEND_DIST")
	if distDir == "" {
		distDir = "../frontend/dist"
	}
	app.Static("/", distDir)
	// SPA fallback: any non-API path returns index.html so App Bridge boots with the ?shop&host params.
	app.Get("/*", func(c *fiber.Ctx) error {
		p := c.Path()
		if strings.HasPrefix(p, "/api") || strings.HasPrefix(p, "/auth") ||
			strings.HasPrefix(p, "/web") || p == "/health" {
			return fiber.ErrNotFound
		}
		return c.SendFile(distDir + "/index.html")
	})

	addr := cfg.ServerHost + ":" + cfg.ServerPort
	log.Printf("backend listening on %s (stage=%s, db=%s)", addr, cfg.Stage, cfg.DBName)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
