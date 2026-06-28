# Announcement Bar App — root Makefile (Environment subsystem).
# DB lifecycle targets + tier targets that delegate to each tier when present.
# Schema is created by GORM AutoMigrate when the backend boots.

# DB_NAME (used by db.shell) can be overridden via backend/.env.
-include backend/.env
DB_NAME ?= announcement_bar

.PHONY: db.up db.down db.admin db.shell check test build

db.up:
	docker compose up -d db

db.down:
	docker compose down

# phpMyAdmin web UI at http://localhost:8081 (auto-login, no password prompt).
db.admin:
	docker compose up -d phpmyadmin
	@echo "phpMyAdmin: http://localhost:8081  (auto-login as root - no login screen)"

# Drop into an interactive MySQL shell inside the db container.
db.shell:
	docker compose exec db mysql -uapp -papp_pass $(DB_NAME)

check:
	@if [ -d frontend ]; then cd frontend && npm run check; else echo "frontend/ absent - skipping check"; fi
	@if [ -d storefront ]; then cd storefront && npm run check; else echo "storefront/ absent - skipping check"; fi

test:
	@if [ -d backend ]; then cd backend && go test ./...; else echo "backend/ absent - skipping test"; fi
	@if [ -d frontend ]; then cd frontend && npm test; else echo "frontend/ absent - skipping test"; fi
	@if [ -d storefront ]; then cd storefront && npm test; else echo "storefront/ absent - skipping test"; fi

build:
	@if [ -d backend ]; then cd backend && go build ./...; else echo "backend/ absent - skipping build"; fi
	@if [ -d frontend ]; then cd frontend && npm run build; else echo "frontend/ absent - skipping build"; fi
	@if [ -d storefront ]; then cd storefront && npm run build; else echo "storefront/ absent - skipping build"; fi
