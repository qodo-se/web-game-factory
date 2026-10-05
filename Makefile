.PHONY: deploy-website deploy-api deploy-all

deploy-website:
	$(MAKE) -C website all

deploy-api:
	$(MAKE) -C api all

deploy-all: deploy-website deploy-api

# Local API: reload Python presets and routes after edits.
.PHONY: dev-api
dev-api:
	.venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8080 --reload --reload-dir api --reload-dir games/borderstrife/engine --reload-dir games/borderstrife/api
