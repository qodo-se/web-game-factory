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
	gcloud run deploy $(SERVICE) \
		--image $(IMAGE):$(GIT_SHA) \
		--region $(REGION) \
		--project $(PROJECT) \
		--platform managed \
		--port 80 \
		--allow-unauthenticated \
		--set-env-vars "IMPERIUM_API_URL=$(IMPERIUM_API_URL)"

all: deploy
