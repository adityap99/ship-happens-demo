FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

# Source is mounted as a volume so Vite HMR picks up changes made by the
# repair engine without rebuilding the container.
COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
