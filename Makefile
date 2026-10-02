.PHONY: deploy-website deploy-api deploy-all

deploy-website:
	$(MAKE) -C website all

deploy-api:
	$(MAKE) -C api all

deploy-all: deploy-website deploy-api
