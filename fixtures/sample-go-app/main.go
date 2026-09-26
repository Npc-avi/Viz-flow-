package main

import (
	"github.com/gin-gonic/gin"
	"net/http"
)

func main() {
	r := gin.Default()

	// Public routes
	r.GET("/healthz", healthCheck)
	r.POST("/login", handleLogin)

	// API Grouping
	api := r.Group("/api/v1")
	{
		api.GET("/users", listUsers)
		api.POST("/users", createUser)
		api.GET("/users/:id", getUserById)
		api.DELETE("/users/:id", deleteUser)
	}

	// Standard net/http handler
	http.HandleFunc("/metrics", metricsHandler)

	r.Run(":8080")
}

func healthCheck(c *gin.Context) {
	c.JSON(200, gin.H{"status": "ok"})
}

func handleLogin(c *gin.Context) {
	verifyCredentials(c)
	generateToken(c)
	c.JSON(200, gin.H{"token": "jwt-token"})
}

func listUsers(c *gin.Context) {
	users := fetchAllUsersFromDb()
	c.JSON(200, users)
}

func createUser(c *gin.Context) {
	validateUserPayload(c)
	insertUserToDb(c)
	c.JSON(201, gin.H{"created": true})
}

func getUserById(c *gin.Context) {
	user := findUserById(c.Param("id"))
	c.JSON(200, user)
}

func deleteUser(c *gin.Context) {
	removeUserFromDb(c.Param("id"))
	c.Status(204)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("ok"))
}
