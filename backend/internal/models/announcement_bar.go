package models

import "time"

// AnnouncementBar is one saved bar. Many bars share a shop (non-unique index); at most one
// may have Enabled=true per shop (API-enforced invariant, not a DB constraint).
type AnnouncementBar struct {
	ID                 uint       `gorm:"primaryKey" json:"id"`
	Shop               string     `gorm:"size:255;not null;index" json:"shop"`
	Title              string     `gorm:"size:120;not null" json:"title"`
	Enabled            bool       `gorm:"not null;default:false" json:"enabled"`
	Message            string     `gorm:"size:255" json:"message"`
	BackgroundColor    string     `gorm:"size:9;not null;default:'#1A1A1A'" json:"background_color"`
	TextColor          string     `gorm:"size:9;not null;default:'#FFFFFF'" json:"text_color"`
	CountdownEnabled   bool       `gorm:"not null;default:false" json:"countdown_enabled"`
	CountdownEndAt     *time.Time `json:"countdown_end_at"`
	CountdownBgColor   string     `gorm:"size:9;not null;default:'#000000'" json:"countdown_bg_color"`
	CountdownTextColor string     `gorm:"size:9;not null;default:'#FFFFFF'" json:"countdown_text_color"`
	CountdownFormat    string     `gorm:"size:20;not null;default:'dd:hh:mm:ss'" json:"countdown_format"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// TableName pins the table name (the only table in this app).
func (AnnouncementBar) TableName() string { return "announcement_bars" }
