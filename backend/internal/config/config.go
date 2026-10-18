package config

import "os"

type Config struct {
	Address, DatabaseURL, UploadDir, StaticDir, OllamaURL, Model, FallbackModel string
	EKTUser, EKTPassword                                                        string
}

func value(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func Load() Config {
	return Config{
		Address: value("HTTP_ADDR", "127.0.0.1:8080"), DatabaseURL: os.Getenv("DATABASE_URL"),
		UploadDir: value("UPLOAD_DIR", "../data/uploads"), StaticDir: value("STATIC_DIR", "../frontend/dist"),
		OllamaURL: value("OLLAMA_URL", "http://127.0.0.1:11434"), Model: value("OLLAMA_MODEL", "qwen3.5:4b-q4_K_M"),
		FallbackModel: value("OLLAMA_FALLBACK_MODEL", "qwen3.5:2b"), EKTUser: os.Getenv("EKT_USER"), EKTPassword: os.Getenv("EKT_PASSWORD"),
	}
}
