# Build context: repo root (docker build -f website/Dockerfile .)
FROM nginx:alpine

# Template is processed at container start — nginx replaces ${IMPERIUM_API_URL}
# with the env var value. All other $nginx_vars are left intact (not in the env).
COPY website/nginx.conf /etc/nginx/templates/default.conf.template

# Static assets
COPY website/index.html /usr/share/nginx/html/index.html
COPY games/imperium/ui/ /usr/share/nginx/html/imperium/

EXPOSE 80
