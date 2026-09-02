FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# Which Angular build configuration to compile. `production` (default) targets
# api.crmbento.com; CI passes `dev` for the dev branch, which swaps in
# src/environments/environment.dev.ts (-> apidev.crmbento.com).
ARG BUILD_CONFIGURATION=production

RUN npx ng build --configuration "${BUILD_CONFIGURATION}"


FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY server/package.json ./
RUN npm install --omit=dev

COPY server/server.js ./server.js
COPY --from=build /app/dist/app/browser ./dist

EXPOSE 4000

CMD ["node", "server.js"]
