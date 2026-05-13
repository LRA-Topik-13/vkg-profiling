clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

.PHONY: help \
        up up-healthy up-defected up-accuracy up-blanknode up-scalable up-shared \
        down down-healthy down-defected down-accuracy down-blanknode down-scalable down-shared \
        restart restart-healthy restart-defected restart-accuracy restart-blanknode restart-scalable \
        build build-healthy build-defected build-accuracy build-blanknode build-scalable pull \
        logs logs-healthy logs-defected logs-accuracy logs-blanknode logs-scalable logs-shared \
        ps \
        shell-api shell-mysql shell-pgsql shell-mssql shell-mysql-defected shell-pgsql-defected \
        shell-mysql-accuracy shell-pgsql-accuracy \
        shell-mysql-blanknode shell-pgsql-blanknode \
        shell-mysql-scalable shell-pgsql-scalable \
        clean clean-healthy clean-defected clean-all

COMPOSE           := docker compose
PROFILE_HEALTHY   := --profile healthy
PROFILE_DEFECTED  := --profile defected
PROFILE_ACCURACY  := --profile accuracy
PROFILE_BLANKNODE := --profile blanknode
PROFILE_SCALABLE  := --profile scalable
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
 
up-defected: ## Start shared + defected data stack
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_DEFECTED) up -d --build
 
up-accuracy: ## Start shared + accuracy data stack
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_ACCURACY) up -d --build

up-blanknode: ## Start shared + blank node data stack
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_BLANKNODE) up -d --build

up-scalable: ## Start shared + scalable demo data stack (many properties)
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_SCALABLE) up -d --build
 
# ── Down ──────────────────────────────────────────────────────────────────────
down: ## Stop all profiles
	$(COMPOSE) $(PROFILE_ALL) down -v
 
down-shared: ## Stop shared services only (api)
	$(COMPOSE) $(PROFILE_SHARED) down -v
 
down-healthy: ## Stop healthy data stack only (leaves shared running)
	$(COMPOSE) $(PROFILE_HEALTHY) down -v
 
down-defected: ## Stop defected data stack only (leaves shared running)
	$(COMPOSE) $(PROFILE_DEFECTED) down -v
 
down-accuracy: ## Stop accuracy data stack only (leaves shared running)
	$(COMPOSE) $(PROFILE_ACCURACY) down -v

down-blanknode: ## Stop blank node data stack only (leaves shared running)
	$(COMPOSE) $(PROFILE_BLANKNODE) down -v

down-scalable: ## Stop scalable data stack only (leaves shared running)
	$(COMPOSE) $(PROFILE_SCALABLE) down -v
 
# ── Restart ───────────────────────────────────────────────────────────────────
restart: down up ## Restart all profiles
 
restart-healthy: down-healthy up-healthy ## Restart healthy data stack
 
restart-defected: down-defected up-defected ## Restart defected data stack
 
restart-accuracy: down-accuracy up-accuracy ## Restart accuracy data stack

restart-blanknode: down-blanknode up-blanknode ## Restart blank node data stack

restart-scalable: down-scalable up-scalable ## Restart scalable data stack
 
# ── Build & Pull ──────────────────────────────────────────────────────────────
build: ## Build all service images
	$(COMPOSE) $(PROFILE_ALL) build
 
build-healthy: ## Build healthy stack images
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_HEALTHY) build
 
build-defected: ## Build defected stack images
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_DEFECTED) build
 
build-accuracy: ## Build accuracy stack images
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_ACCURACY) build

build-blanknode: ## Build blank node stack images
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_BLANKNODE) build

build-scalable: ## Build scalable stack images
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_SCALABLE) build
 
pull: ## Pull latest base images
	$(COMPOSE) $(PROFILE_ALL) pull
 
# ── Logs ──────────────────────────────────────────────────────────────────────
logs: ## Tail logs for all services
	$(COMPOSE) $(PROFILE_ALL) logs -f
 
logs-shared: ## Tail logs for shared services (api)
	$(COMPOSE) $(PROFILE_SHARED) logs -f
 
logs-healthy: ## Tail logs for shared + healthy stack
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_HEALTHY) logs -f
 
logs-defected: ## Tail logs for shared + defected stack
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_DEFECTED) logs -f
 
logs-accuracy: ## Tail logs for shared + accuracy stack
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_ACCURACY) logs -f

logs-blanknode: ## Tail logs for shared + blank node stack
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_BLANKNODE) logs -f

logs-scalable: ## Tail logs for shared + scalable stack
	$(COMPOSE) $(PROFILE_SHARED) $(PROFILE_SCALABLE) logs -f
 
# ── Status ────────────────────────────────────────────────────────────────────
ps: ## List running containers across all profiles
	$(COMPOSE) $(PROFILE_ALL) $(PROFILE_ACCURACY) ps

shell-mysql-accuracy: ## Open MySQL shell (accuracy dataset)
	$(COMPOSE) $(PROFILE_ACCURACY) exec mysql-accuracy mysql -u uni1 -puni1pwd uni1

shell-pgsql-accuracy: ## Open PostgreSQL shell (accuracy dataset)
	$(COMPOSE) $(PROFILE_ACCURACY) exec pgsql-accuracy psql -U uni2 uni2

shell-mysql-blanknode: ## Open MySQL shell (blank node dataset)
	$(COMPOSE) $(PROFILE_BLANKNODE) exec mysql-blanknode mysql -u uni1 -puni1pwd uni1

shell-pgsql-blanknode: ## Open PostgreSQL shell (blank node dataset)
	$(COMPOSE) $(PROFILE_BLANKNODE) exec pgsql-blanknode psql -U uni2 uni2

shell-mysql-scalable: ## Open MySQL shell (scalable dataset)
	$(COMPOSE) $(PROFILE_SCALABLE) exec mysql-scalable mysql -u uni1 -puni1pwd uni1

shell-pgsql-scalable: ## Open PostgreSQL shell (scalable dataset)
	$(COMPOSE) $(PROFILE_SCALABLE) exec pgsql-scalable psql -U uni2 uni2

shell-mssql: ## Open MSSQL shell (healthy dataset)
	$(COMPOSE) $(PROFILE_HEALTHY) exec mssql /opt/mssql-tools/bin/sqlcmd -S localhost -U uni3 -P uni3pwd
