package handlers

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// The health endpoint proves the server boots and uses the standard {error,msg,data} envelope.
func TestHealthReturnsOKEnvelope(t *testing.T) {
	app := fiber.New()
	app.Get("/health", Health)

	resp, err := app.Test(httptest.NewRequest("GET", "/health", nil))
	if err != nil {
		t.Fatalf("request error: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var env map[string]any
	if err := json.Unmarshal(body, &env); err != nil {
		t.Fatalf("invalid JSON: %v (body=%s)", err, body)
	}
	if env["error"] != false {
		t.Errorf("error = %v, want false", env["error"])
	}
	if env["msg"] != "ok" {
		t.Errorf("msg = %v, want \"ok\"", env["msg"])
	}
}
