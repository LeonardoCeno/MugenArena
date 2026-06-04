dev:
	docker compose -f compose.dev.yaml up

dev-build:
	docker compose -f compose.dev.yaml up --build

prod:
	docker compose up --build

down:
	docker compose down
	docker compose -f compose.dev.yaml down

.PHONY: dev dev-build prod down
