PROJECT   ?= sri-experiments-01
REGION    ?= europe-west4
REPO      ?= web-game-factory
SERVICE   ?= wgf-website
IMAGE     = $(REGION)-docker.pkg.dev/$(PROJECT)/$(REPO)/website

.PHONY: build push deploy all

build:
	docker build -t $(IMAGE) .

push:
	docker push $(IMAGE)

deploy:
	gcloud run deploy $(SERVICE) \
		--image $(IMAGE) \
		--region $(REGION) \
		--project $(PROJECT) \
		--platform managed \
		--allow-unauthenticated

all: build push deploy
