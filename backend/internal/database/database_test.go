package database

import (
	"testing"

	"announcementbar/internal/config"
)

// Integration: proves the backend actually connects to MySQL.
// Skipped in -short mode; run for real by `bash init.sh` (which brings MySQL up first).
func TestConnectPingsRealDatabase(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB integration test in -short mode")
	}

	db, err := Connect(config.Load())
	if err != nil {
		t.Fatalf("Connect() error: %v (is MySQL up? run via `bash init.sh`)", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("db.DB(): %v", err)
	}
	defer sqlDB.Close()

	if err := sqlDB.Ping(); err != nil {
		t.Fatalf("ping failed: %v", err)
	}
}
