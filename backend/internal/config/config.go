package config

import (
	"fmt"
	"os"
)

// Config holds the backend's runtime settings, read from the environment
// (init.sh sources the root .env before boot).
type Config struct {
	Stage      string
	ServerHost string
	ServerPort string
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string

	// Shopify app settings. The secret authenticates OAuth + session tokens; it is never
	// logged. The app is stateless: no access token is stored (see docs/ARCHITECTURE.md).
	ShopifyAPIKey    string
	ShopifyAPISecret string
	Scopes           string
	AppURL           string
	AppAPIVersion    string
}

// Load reads settings from the environment, falling back to local defaults
// that match docker-compose.yml / .env.example.
func Load() Config {
	return Config{
		Stage:      env("STAGE_STATUS", "dev"),
		ServerHost: env("SERVER_HOST", "127.0.0.1"),
		ServerPort: env("SERVER_PORT", "5005"),
		DBHost:     env("DB_HOST", "127.0.0.1"),
		DBPort:     env("DB_PORT", "3307"),
		DBUser:     env("DB_USER", "app"),
		DBPassword: env("DB_PASSWORD", "app_pass"),
		DBName:     env("DB_NAME", "announcement_bar"),

		ShopifyAPIKey:    env("SHOPIFY_API_KEY", ""),
		ShopifyAPISecret: env("SHOPIFY_API_SECRET", ""),
		Scopes:           env("SCOPES", ""),
		AppURL:           env("APP_URL", ""),
		AppAPIVersion:    env("APP_API_VERSION", "2025-07"),
	}
}

// DSN builds the GORM/MySQL connection string.
func (c Config) DSN() string {
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName,
	)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
