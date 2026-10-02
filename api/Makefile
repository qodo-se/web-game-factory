PROJECT   ?= sri-experiments-01
REGION    ?= europe-west4
REPO      ?= web-game-factory
SERVICE   ?= wgf-api
IMAGE     = $(REGION)-docker.pkg.dev/$(PROJECT)/$(REPO)/api
GIT_SHA  := $(shell git rev-parse --short HEAD)

.PHONY: build push deploy all

build:
	docker build -t $(IMAGE):$(GIT_SHA) .

push: build
	gcloud auth configure-docker $(REGION)-docker.pkg.dev --quiet
	docker push $(IMAGE):$(GIT_SHA)

deploy: push
	gcloud run deploy $(SERVICE) \
		--image $(IMAGE):$(GIT_SHA) \
		--region $(REGION) \
		--project $(PROJECT) \
		--platform managed \
		--allow-unauthenticated

all: deploy
