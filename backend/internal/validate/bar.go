package validate

import (
	"errors"
	"regexp"
	"strings"
	"time"

	"announcementbar/internal/models"
)

var hexColor = regexp.MustCompile(`^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`)

// Bar validates a bar before persisting (the admin form mirrors these rules in Yup).
func Bar(b *models.AnnouncementBar) error {
	if strings.TrimSpace(b.Title) == "" {
		return errors.New("title is required")
	}
	if b.Enabled && strings.TrimSpace(b.Message) == "" {
		return errors.New("message is required when the bar is enabled")
	}
	for _, c := range []string{b.BackgroundColor, b.TextColor, b.CountdownBgColor, b.CountdownTextColor} {
		if !hexColor.MatchString(c) {
			return errors.New("invalid hex color: " + c)
		}
	}
	if b.CountdownEnabled {
		if b.CountdownEndAt == nil || !b.CountdownEndAt.After(time.Now()) {
			return errors.New("countdown_end_at must be a future time when countdown is enabled")
		}
	}
	return nil
}
