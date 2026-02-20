# Vite dev server
FROM node:20-alpine

WORKDIR /app

# Install dependencies (cached layer)
COPY package.json ./
RUN npm install

# Copy source files
COPY index.html ./
COPY vite.config.js ./
COPY public ./public
COPY src ./src

EXPOSE 3030

CMD ["npm", "run", "dev"]
