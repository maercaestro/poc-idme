FROM mcr.microsoft.com/playwright:v1.45.0-jammy

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

CMD ["node", "src/index.js"]
