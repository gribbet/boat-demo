FROM node:18 as build

WORKDIR /app

COPY package*.json ./
COPY ui/package.json ./ui/

RUN npm install

COPY tsconfig.json .
COPY ui ./ui

ARG VITE_ENDPOINT=""
RUN cd ui && npm run build

FROM nginx:1.25
COPY infrastructure/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/ui/dist /usr/share/nginx/html