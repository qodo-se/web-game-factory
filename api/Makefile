PROJECT   ?= sri-experiments-01
REGION    ?= europe-west4
REPO      ?= web-game-factory
SERVICE   ?= wgf-api
IMAGE     = $(REGION)-docker.pkg.dev/$(PROJECT)/$(REPO)/api
CLOUD_SQL_INSTANCE ?= $(PROJECT):$(REGION):test-postgres-instance
DATABASE_URL_SECRET ?= wgf-api-database-url:1
RUNTIME_SERVICE_ACCOUNT ?= wgf-api-runtime@$(PROJECT).iam.gserviceaccount.com
GIT_SHA  := $(shell git rev-parse --short HEAD)

.PHONY: build push deploy all

build:
	docker build -t $(IMAGE):$(GIT_SHA) -f Dockerfile ..

push: build
	gcloud auth configure-docker $(REGION)-docker.pkg.dev --quiet
	docker push $(IMAGE):$(GIT_SHA)

deploy: push
	gcloud run deploy $(SERVICE) \
		--image $(IMAGE):$(GIT_SHA) \
		--region $(REGION) \
		--project $(PROJECT) \
		--platform managed \
		--allow-unauthenticated \
		--max-instances 1 \
		--service-account $(RUNTIME_SERVICE_ACCOUNT) \
		--add-cloudsql-instances $(CLOUD_SQL_INSTANCE) \
		--update-secrets DATABASE_URL=$(DATABASE_URL_SECRET)

all: deploy

# The scheduled workflow runs this independently of service traffic/scaling.
.PHONY: deploy-cleanup
deploy-cleanup:
	gcloud run jobs deploy wgf-campaign-cleanup \
		--image $(IMAGE):$(GIT_SHA) \
		--region $(REGION) \
		--project $(PROJECT) \
		--service-account $(RUNTIME_SERVICE_ACCOUNT) \
		--set-cloudsql-instances $(CLOUD_SQL_INSTANCE) \
		--set-secrets DATABASE_URL=$(DATABASE_URL_SECRET) \
		--command python \
		--args=-m,games.borderstrife.api.cleanup \
		--tasks 1 --max-retries 1 --task-timeout 900s
