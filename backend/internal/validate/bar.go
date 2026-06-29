package validate

import (
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"announcementbar/internal/models"
)

var hexColor = regexp.MustCompile(`^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`)

// Length caps (counted in runes). Title fits the DB column (size:120); message matches the
// documented 1–200 limit and the admin help text.
const (
	MaxTitle   = 120
	MaxMessage = 200
)

// Bar validates a bar before persisting (the admin form mirrors these rules in barValidation.ts).
func Bar(b *models.AnnouncementBar) error {
	if strings.TrimSpace(b.Title) == "" {
		return errors.New("title is required")
	}
	if utf8.RuneCountInString(b.Title) > MaxTitle {
		return errors.New("title must be 120 characters or fewer")
	}
	if strings.TrimSpace(b.Message) == "" {
		return errors.New("message is required")
	}
	if utf8.RuneCountInString(b.Message) > MaxMessage {
		return errors.New("message must be 200 characters or fewer")
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
