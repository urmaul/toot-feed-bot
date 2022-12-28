FROM node:lts

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
