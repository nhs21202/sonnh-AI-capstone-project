package validate

import (
	"strings"
	"testing"
	"time"

	"announcementbar/internal/models"
)

func validBar() *models.AnnouncementBar {
	return &models.AnnouncementBar{
		Title:              "Sale",
		Enabled:            false,
		Message:            "Hello",
		BackgroundColor:    "#1A1A1A",
		TextColor:          "#FFFFFF",
		CountdownBgColor:   "#000000",
		CountdownTextColor: "#FFFFFF",
	}
}

func TestBarAcceptsValid(t *testing.T) {
	if err := Bar(validBar()); err != nil {
		t.Fatalf("expected a valid bar, got %v", err)
	}
}

func TestBarRequiresTitle(t *testing.T) {
	b := validBar()
	b.Title = "   "
	if err := Bar(b); err == nil {
		t.Fatal("expected error for blank title")
	}
}

func TestBarRejectsTitleOver120(t *testing.T) {
	b := validBar()
	b.Title = strings.Repeat("a", 121)
	if err := Bar(b); err == nil {
		t.Fatal("expected error for title longer than 120 characters")
	}
}

func TestBarAcceptsTitleExactly120(t *testing.T) {
	b := validBar()
	b.Title = strings.Repeat("a", 120)
	if err := Bar(b); err != nil {
		t.Fatalf("title of exactly 120 characters should be allowed, got %v", err)
	}
}

func TestBarRequiresMessageAlways(t *testing.T) {
	b := validBar() // Enabled == false
	b.Message = "   "
	if err := Bar(b); err == nil {
		t.Fatal("expected error for a blank message even when the bar is disabled")
	}
}

func TestBarRejectsMessageOver200WhenDisabled(t *testing.T) {
	b := validBar() // Enabled == false
	b.Message = strings.Repeat("m", 201)
	if err := Bar(b); err == nil {
		t.Fatal("expected error for message longer than 200 characters, even when the bar is disabled")
	}
}

func TestBarAcceptsMessageExactly200(t *testing.T) {
	b := validBar()
	b.Message = strings.Repeat("m", 200)
	if err := Bar(b); err != nil {
		t.Fatalf("message of exactly 200 characters should be allowed, got %v", err)
	}
}

func TestBarRequiresFutureDeadlineWhenCountdownOn(t *testing.T) {
	b := validBar()
	b.CountdownEnabled = true
	past := time.Now().Add(-time.Hour)
	b.CountdownEndAt = &past
	if err := Bar(b); err == nil {
		t.Fatal("expected error for a past deadline when countdown is enabled")
	}
}
