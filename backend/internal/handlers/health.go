package handlers

import "github.com/gofiber/fiber/v2"

// Health reports that the server is up, using the standard {error,msg,data} envelope.
func Health(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"error": false,
		"msg":   "ok",
		"data":  fiber.Map{"status": "up"},
	})
}
