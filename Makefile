clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

.PHONY: help \
        up up-healthy up-shared up-all \
        down down-healthy down-shared down-all \
        restart restart-healthy restart-all \
        build build-healthy build-all pull \
        logs logs-healthy logs-shared logs-all \
        ps \
        shell-api shell-mysql shell-pgsql shell-mssql \
        clean clean-healthy clean-all

COMPOSE           := docker compose
PROFILE_HEALTHY   := --profile healthy
PROFILE_SHARED    := --profile shared
PROFILE_FRONTEND  := --profile frontend
PROFILE_ALL       := --profile healthy --profile shared
PROFILE_EVERY     := --profile healthy --profile shared --profile frontend
 
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

up-all: ## Start shared + healthy + frontend (everything)
	$(COMPOSE) $(PROFILE_EVERY) up -d --build

# ── Down ──────────────────────────────────────────────────────────────────────
down: ## Stop all profiles
	$(COMPOSE) $(PROFILE_ALL) down -v

down-shared: ## Stop shared services only (api)
	$(COMPOSE) $(PROFILE_SHARED) down -v

down-healthy: ## Stop healthy data stack only (leaves shared running)
	$(COMPOSE) $(PROFILE_HEALTHY) down -v

down-all: ## Stop everything (shared + healthy + frontend)
	$(COMPOSE) $(PROFILE_EVERY) down -v

# ── Restart ───────────────────────────────────────────────────────────────────
restart: down up ## Restart all profiles

restart-healthy: down-healthy up-healthy ## Restart healthy data stack

restart-all: down-all up-all ## Restart everything (shared + healthy + frontend)

# ── Build & Pull ──────────────────────────────────────────────────────────────
build: ## Build all service images
	$(COMPOSE) $(PROFILE_ALL) build

build-healthy: ## Build healthy stack images
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_HEALTHY) build

build-all: ## Build everything (shared + healthy + frontend) images
	$(COMPOSE) $(PROFILE_EVERY) build

pull: ## Pull latest base images
	$(COMPOSE) $(PROFILE_ALL) pull

# ── Logs ──────────────────────────────────────────────────────────────────────
logs: ## Tail logs for all services
	$(COMPOSE) $(PROFILE_ALL) logs -f

logs-shared: ## Tail logs for shared services (api)
	$(COMPOSE) $(PROFILE_SHARED) logs -f

logs-healthy: ## Tail logs for shared + healthy stack
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_HEALTHY) logs -f

logs-all: ## Tail logs for everything (shared + healthy + frontend)
	$(COMPOSE) $(PROFILE_EVERY) logs -f
 
# ── Status ────────────────────────────────────────────────────────────────────
ps: ## List running containers across all profiles
	$(COMPOSE) $(PROFILE_ALL) ps

shell-mssql: ## Open MSSQL shell (healthy dataset)
	$(COMPOSE) $(PROFILE_HEALTHY) exec mssql /opt/mssql-tools/bin/sqlcmd -S localhost -U academics -P academicspwd
