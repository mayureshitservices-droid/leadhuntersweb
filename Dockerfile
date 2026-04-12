FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# Build step if needed, but we can just use tsx for now, or build and copy static assets
RUN npm run build
# Copy static assets to dist since tsc doesn't do it
RUN cp -r src/views dist/
RUN cp -r src/public dist/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
