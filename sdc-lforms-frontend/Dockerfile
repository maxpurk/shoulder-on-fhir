FROM alpine:3.20 AS assets
RUN apk add --no-cache curl
WORKDIR /src
COPY fetch-assets.sh .
RUN mkdir -p web && ./fetch-assets.sh

FROM nginx:alpine AS production
COPY web/ /usr/share/nginx/html/
COPY --from=assets /src/web/lforms-assets /usr/share/nginx/html/lforms-assets
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
