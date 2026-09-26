package main

import "github.com/gofiber/fiber/v2"

func setupFiberApp(app *fiber.App) {
	app.Get("/fiber/ping", func(c *fiber.Ctx) error {
		trackMetric("ping")
		return c.SendString("pong")
	})

	orders := app.Group("/fiber/orders")
	orders.Post("/checkout", checkoutHandler)
	orders.Put("/cancel/:orderId", cancelOrderHandler)
}

func checkoutHandler(c *fiber.Ctx) error {
	chargeCard(c)
	sendReceiptEmail(c)
	return c.JSON(fiber.Map{"status": "paid"})
}

func cancelOrderHandler(c *fiber.Ctx) error {
	refundPayment(c)
	return c.SendStatus(200)
}
