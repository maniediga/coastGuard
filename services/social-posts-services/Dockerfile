# Step 1: Build stage
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
RUN npm install

COPY ./src ./src

# Build TypeScript → JavaScript
RUN npm run build

# Step 2: Production stage
FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 4010

CMD ["npm", "start"]

