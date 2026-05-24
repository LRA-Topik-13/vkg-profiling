clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

.PHONY: help \
        up up-healthy up-shared \
        down down-healthy down-shared \
        restart restart-healthy \
        build build-healthy pull \
        logs logs-healthy logs-shared \
        ps \
        shell-api shell-mysql shell-pgsql shell-mssql \
        clean clean-healthy clean-all

COMPOSE           := docker compose
PROFILE_HEALTHY   := --profile healthy
PROFILE_SHARED    := --profile shared
PROFILE_ALL       := --profile healthy --profile shared
 
.DEFAULT_GOAL := help
 
help: ## Show this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} \
	      /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-32s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
 
# ── Up ────────────────────────────────────────────────────────────────────────
up: ## Start shared API + healthy data stack
	$(COMPOSE) $(PROFILE_ALL) up -d --build
 
up-shared: ## Start shared services only (api)
	$(COMPOSE) $(PROFILE_SHARED) up -d --build
 
up-healthy: ## Start shared + healthy data stack
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_HEALTHY) up -d --build
 
# ── Down ──────────────────────────────────────────────────────────────────────
down: ## Stop all profiles
	$(COMPOSE) $(PROFILE_ALL) down -v
 
down-shared: ## Stop shared services only (api)
	$(COMPOSE) $(PROFILE_SHARED) down -v
 
down-healthy: ## Stop healthy data stack only (leaves shared running)
	$(COMPOSE) $(PROFILE_HEALTHY) down -v
 
# ── Restart ───────────────────────────────────────────────────────────────────
restart: down up ## Restart all profiles
 
restart-healthy: down-healthy up-healthy ## Restart healthy data stack
 
# ── Build & Pull ──────────────────────────────────────────────────────────────
build: ## Build all service images
	$(COMPOSE) $(PROFILE_ALL) build
 
build-healthy: ## Build healthy stack images
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_HEALTHY) build
 
pull: ## Pull latest base images
	$(COMPOSE) $(PROFILE_ALL) pull
 
# ── Logs ──────────────────────────────────────────────────────────────────────
logs: ## Tail logs for all services
	$(COMPOSE) $(PROFILE_ALL) logs -f
 
logs-shared: ## Tail logs for shared services (api)
	$(COMPOSE) $(PROFILE_SHARED) logs -f
 
logs-healthy: ## Tail logs for shared + healthy stack
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_HEALTHY) logs -f
 
# ── Status ────────────────────────────────────────────────────────────────────
ps: ## List running containers across all profiles
	$(COMPOSE) $(PROFILE_ALL) ps

shell-mssql: ## Open MSSQL shell (healthy dataset)
	$(COMPOSE) $(PROFILE_HEALTHY) exec mssql /opt/mssql-tools/bin/sqlcmd -S localhost -U uni3 -P uni3pwd
