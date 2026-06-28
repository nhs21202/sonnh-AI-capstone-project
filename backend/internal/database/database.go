package database

import (
	"announcementbar/internal/config"
	"announcementbar/internal/models"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// Connect opens a GORM connection to MySQL using the config DSN.
func Connect(cfg config.Config) (*gorm.DB, error) {
	return gorm.Open(mysql.Open(cfg.DSN()), &gorm.Config{})
}

// Migrate creates/updates the schema. The only table is announcement_bars (GORM AutoMigrate,
// run on boot and in DB tests — no separate migration step).
func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(&models.AnnouncementBar{})
}
