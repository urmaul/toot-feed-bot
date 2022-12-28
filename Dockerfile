# FROM node:lts-alpine
FROM node:lts

# RUN apk add --update --no-cache libc6-compat openssl openssl-dev
# RUN cp /lib64/ld-linux-x86-64.so.2 /lib/

RUN mkdir /app
WORKDIR /app

ADD package*.json ./

RUN npm install

ADD src/* ./src/
ADD .* ./
ADD tsconfig.json ./
RUN npm run build-tsc

RUN npm prune --omit=dev

ENTRYPOINT node ./dist/index.js
