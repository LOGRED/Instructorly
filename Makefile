# MAKETOR — Makefile
# Next.js 16 (webpack 강제) · better-sqlite3 · SQLite 파일 DB
# 사용법:  make            (도움말)
#          make dev        (개발 서버)
#          make build      (프로덕션 빌드)
#          make run        (빌드 후 프로덕션 실행)

# ── 설정 ─────────────────────────────────────────────────────────
SHELL    := /bin/bash
NPM      := npm
PORT     ?= 3000
DB       := data/maketor.db
# Hangul 경로에서 Turbopack이 깨지므로 dev/build는 package.json에서 --webpack 고정.

# node_modules 존재 여부로 install 선행 판단.
NODE_MODULES := node_modules/.package-lock.json

.DEFAULT_GOAL := help

# ── 도움말 ───────────────────────────────────────────────────────
.PHONY: help
help: ## 사용 가능한 명령 목록
	@echo "MAKETOR — make 명령어"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

# ── 의존성 ───────────────────────────────────────────────────────
.PHONY: install
install: $(NODE_MODULES) ## 의존성 설치 (필요 시에만)

$(NODE_MODULES): package.json package-lock.json
	$(NPM) install
	@touch $(NODE_MODULES)

.PHONY: reinstall
reinstall: ## node_modules 삭제 후 재설치 (네이티브 모듈 재빌드)
	rm -rf node_modules
	$(NPM) install

# ── 개발 ─────────────────────────────────────────────────────────
.PHONY: dev
dev: install ## 개발 서버 (webpack, http://localhost:3000)
	$(NPM) run dev -- --port $(PORT)

# ── 빌드 ─────────────────────────────────────────────────────────
.PHONY: build
build: install ## 프로덕션 빌드 (webpack)
	$(NPM) run build

# ── 실행 ─────────────────────────────────────────────────────────
.PHONY: start
start: ## 프로덕션 서버 (빌드 산출물 필요)
	$(NPM) run start -- --port $(PORT)

.PHONY: run
run: build start ## 빌드 후 프로덕션 실행

# ── 품질 ─────────────────────────────────────────────────────────
.PHONY: lint
lint: install ## ESLint 실행
	$(NPM) run lint

# ── DB ───────────────────────────────────────────────────────────
.PHONY: db-reset
db-reset: ## SQLite DB 삭제 (다음 실행 시 재생성). 주의: 데이터 소실
	rm -f $(DB) $(DB)-shm $(DB)-wal
	@echo "DB 삭제 완료: $(DB)"

# ── 정리 ─────────────────────────────────────────────────────────
.PHONY: clean
clean: ## 빌드 캐시 삭제 (.next, tsbuildinfo)
	rm -rf .next tsconfig.tsbuildinfo

.PHONY: clean-all
clean-all: clean ## 빌드 캐시 + node_modules 전체 삭제
	rm -rf node_modules

# ── 복합 ─────────────────────────────────────────────────────────
.PHONY: all
all: install build ## 의존성 설치 + 빌드
