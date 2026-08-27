FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3001

ENV PORT=3001
ENV NODE_ENV=production

CMD ["node", "src/server.js"]
