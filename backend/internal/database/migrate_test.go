package database

import (
	"testing"

	"announcementbar/internal/config"
	"announcementbar/internal/models"
)

// Integration (feat-002): AutoMigrate creates announcement_bars; many bars per shop coexist;
// WHERE shop=? returns that shop's set; a fresh shop is empty. Run by `bash init.sh`.
func TestMigrateAndShopScoping(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB integration test in -short mode")
	}

	db, err := Connect(config.Load())
	if err != nil {
		t.Fatalf("Connect: %v (run via `bash init.sh`)", err)
	}
	if err := Migrate(db); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	const shopA = "test-feat002-a.myshopify.com"
	const shopB = "test-feat002-b.myshopify.com"
	db.Where("shop IN ?", []string{shopA, shopB}).Delete(&models.AnnouncementBar{})
	t.Cleanup(func() {
		db.Where("shop IN ?", []string{shopA, shopB}).Delete(&models.AnnouncementBar{})
	})

	// Two bars for the same shop coexist (shop index is NOT unique).
	if err := db.Create(&models.AnnouncementBar{Shop: shopA, Title: "Bar 1"}).Error; err != nil {
		t.Fatalf("create bar 1: %v", err)
	}
	if err := db.Create(&models.AnnouncementBar{Shop: shopA, Title: "Bar 2"}).Error; err != nil {
		t.Fatalf("create bar 2: %v", err)
	}

	var barsA []models.AnnouncementBar
	db.Where("shop = ?", shopA).Find(&barsA)
	if len(barsA) != 2 {
		t.Errorf("shopA bars = %d, want 2", len(barsA))
	}

	// A fresh shop yields an empty list.
	var barsB []models.AnnouncementBar
	db.Where("shop = ?", shopB).Find(&barsB)
	if len(barsB) != 0 {
		t.Errorf("fresh shopB bars = %d, want 0", len(barsB))
	}
}
