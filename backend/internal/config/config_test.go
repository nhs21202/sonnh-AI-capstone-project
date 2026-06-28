package config

import (
	"testing"
)

// The config layer reads tier settings from the environment and builds the MySQL DSN.
func TestDSNBuiltFromConfig(t *testing.T) {
	cfg := Config{
		DBUser:     "app",
		DBPassword: "app_pass",
		DBHost:     "127.0.0.1",
		DBPort:     "3307",
		DBName:     "announcement_bar",
	}

	got := cfg.DSN()
	want := "app:app_pass@tcp(127.0.0.1:3307)/announcement_bar?charset=utf8mb4&parseTime=True&loc=Local"

	if got != want {
		t.Fatalf("DSN() = %q, want %q", got, want)
	}
}

// Load falls back to sane local defaults when the environment is empty.
func TestLoadDefaultsWhenEnvEmpty(t *testing.T) {
	t.Setenv("DB_NAME", "")
	t.Setenv("DB_PORT", "")

	cfg := Load()

	if cfg.DBName != "announcement_bar" {
		t.Errorf("default DBName = %q, want announcement_bar", cfg.DBName)
	}
	if cfg.DBPort != "3307" {
		t.Errorf("default DBPort = %q, want 3307", cfg.DBPort)
	}
}

// Config also carries the Shopify/app settings (read from env; secrets never logged).
func TestLoadReadsShopifyConfig(t *testing.T) {
	t.Setenv("SHOPIFY_API_KEY", "test_key_123")
	t.Setenv("APP_API_VERSION", "")

	cfg := Load()

	if cfg.ShopifyAPIKey != "test_key_123" {
		t.Errorf("ShopifyAPIKey = %q, want test_key_123", cfg.ShopifyAPIKey)
	}
	if cfg.AppAPIVersion != "2025-07" {
		t.Errorf("default AppAPIVersion = %q, want 2025-07", cfg.AppAPIVersion)
	}
}
