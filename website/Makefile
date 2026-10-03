PROJECT          ?= sri-experiments-01
IMPERIUM_API_URL ?=
REGION    ?= europe-west4
REPO      ?= web-game-factory
SERVICE   ?= wgf-website
IMAGE     = $(REGION)-docker.pkg.dev/$(PROJECT)/$(REPO)/website
GIT_SHA  := $(shell git rev-parse --short HEAD)

.PHONY: build push deploy all

build:
	docker build -t $(IMAGE):$(GIT_SHA) -f website/Dockerfile ..

push: build
	gcloud auth configure-docker $(REGION)-docker.pkg.dev --quiet
	docker push $(IMAGE):$(GIT_SHA)

deploy: push
	@[ -n "$(IMPERIUM_API_URL)" ] || { echo "Error: IMPERIUM_API_URL must be set (e.g. make deploy IMPERIUM_API_URL=https://...)"; exit 1; }
	gcloud run deploy $(SERVICE) \
		--image $(IMAGE):$(GIT_SHA) \
		--region $(REGION) \
		--project $(PROJECT) \
		--platform managed \
		--port 80 \
		--allow-unauthenticated \
		--set-env-vars "IMPERIUM_API_URL=$(IMPERIUM_API_URL)"

all: deploy
